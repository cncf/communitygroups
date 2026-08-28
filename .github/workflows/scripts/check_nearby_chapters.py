#!/usr/bin/env python3
"""
Check for nearby CNCF Community Group chapters when a new chapter request is opened.
"""

import os
import re
import sys
import time
import requests
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# Distance threshold for a chapter to count as "nearby".
DISTANCE_THRESHOLD_KM = 100
DISTANCE_THRESHOLD_M = DISTANCE_THRESHOLD_KM * 1000

# Open Community Groups JSON search API. The CNCF program migrated from
# community.cncf.io to ocgroups.dev. This endpoint can do the distance search
# server-side: given the viewer's coordinates (via CloudFront-Viewer-* headers)
# plus distance + sort_by=distance, it returns only groups within range, already
# sorted nearest-first. That is much lighter than pulling every group and
# measuring distances locally, and it grows well as the chapter list does.
# See https://github.com/cncf/open-community-groups (handler: /explore/groups/search).
CHAPTERS_API_URL = "https://ocgroups.dev/explore/groups/search"
CHAPTERS_COMMUNITY = "cncf"
# Upper bound on results requested. The nearby set is small in practice; this is
# just a safety cap (the server's MAX_PAGINATION_LIMIT is 100).
RESULTS_LIMIT = 100
# API-failure handling. The check is advisory, so on a transient failure we retry
# a few times with a short linear backoff; if it still fails, main() reports a
# `status` of "error" and the workflow invites the submitter to comment /recheck.
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 2
# Header names the OCG server reads viewer coordinates from. (The maintainers
# noted these names may change eventually.)
VIEWER_LATITUDE_HEADER = "CloudFront-Viewer-Latitude"
VIEWER_LONGITUDE_HEADER = "CloudFront-Viewer-Longitude"
# Only region-specific chapters are relevant to a "nearby chapters" check. These
# slugs are sent to the API as group_category filters so the server returns only
# regional groups (see fetch_nearby_chapters); normalize_chapter re-checks them
# as a cheap safety net in case that filter ever stops being honored. Matched on
# the category slug, which is stable across display-name renames.
REGION_SPECIFIC_CATEGORY_SLUGS = {"regional"}

def extract_location_from_issue(issue_body):
    """
    Extract the city/location from the GitHub issue body.
    The location is in the field labeled "City or location name for your CNCG"
    """
    if not issue_body:
        return None

    # Pattern to match the location field in the issue template
    # Looking for "City or location name for your CNCG" section
    pattern = r'###\s*City or location name for your CNCG\s*\n\s*(.+?)(?:\n\n|\n###|$)'
    match = re.search(pattern, issue_body, re.IGNORECASE | re.DOTALL)

    if match:
        location = match.group(1).strip()
        # Remove common prefixes like "e.g." or "Cloud Native"
        location = re.sub(r'^(e\.g\.\s*|Cloud Native\s*)', '', location, flags=re.IGNORECASE)
        return location.strip()

    # Fallback: try to find any location-like text after the first heading
    lines = issue_body.split('\n')
    for i, line in enumerate(lines):
        if 'City or location name' in line or 'location name for your CNCG' in line.lower():
            # Get the next non-empty line
            for j in range(i + 1, len(lines)):
                potential_location = lines[j].strip()
                if potential_location and not potential_location.startswith('#'):
                    potential_location = re.sub(r'^(e\.g\.\s*|Cloud Native\s*)', '', potential_location, flags=re.IGNORECASE)
                    return potential_location.strip()

    return None

def get_coordinates(location):
    """
    Get latitude and longitude for a given location using geopy.
    """
    try:
        geolocator = Nominatim(user_agent="cncf-chapter-checker/1.0")
        location_data = geolocator.geocode(location, timeout=10)

        if location_data:
            return (location_data.latitude, location_data.longitude)
        return None
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        print(f"Geocoding error for '{location}': {e}", file=sys.stderr)
        return None

def normalize_chapter(group):
    """
    Map an Open Community Groups search result to the chapter shape used
    downstream: {name, location, url, latitude, longitude}. Returns None for
    non-region-specific chapters, or those with no usable name or URL.
    """
    # Skip chapters whose category is not region-specific (virtual, topic-based,
    # hosted-project communities); they are not tied to a location. The API query
    # already filters to these categories, so this is just a safety net.
    category_slug = (group.get('category') or {}).get('slug')
    if category_slug not in REGION_SPECIFIC_CATEGORY_SLUGS:
        return None

    name = group.get('name', '')
    city = group.get('city')
    country = group.get('country_name')

    # Human-readable location used as context in the posted comment.
    if city and country:
        location = f"{city}, {country}"
    else:
        location = city or country or ''

    # Public group URL: /{community}/group/{slug}. The admin-managed
    # "pretty" slug takes precedence when present (matches public_slug() server-side).
    community = group.get('community_name') or CHAPTERS_COMMUNITY
    slug = group.get('slug_pretty') or group.get('slug')
    url = f"https://ocgroups.dev/{community}/group/{slug}" if slug else ''

    if not (name and url):
        return None

    return {
        'name': name,
        'location': location,
        'url': url,
        'latitude': group.get('latitude'),
        'longitude': group.get('longitude'),
    }


def fetch_nearby_chapters(latitude, longitude):
    """
    Ask the Open Community Groups search API for CNCF chapters within
    DISTANCE_THRESHOLD_KM of the given coordinates, sorted nearest-first. The
    server does the distance filtering; we pass the viewer location via headers.
    Retries a few times on failure (the failures are usually transient). Returns
    a list of normalized chapters, or None if every attempt fails.
    """
    headers = {
        VIEWER_LATITUDE_HEADER: str(latitude),
        VIEWER_LONGITUDE_HEADER: str(longitude),
    }
    # community and group_category are array filters; serde_qs expects an indexed
    # form (community[0]=..., group_category[0]=...). Filtering by category here
    # rather than client-side keeps the query light and, more importantly, avoids
    # a page of results filling with non-regional groups (which carry coordinates)
    # and crowding valid regional chapters out of the limit.
    params = [
        ('community[0]', CHAPTERS_COMMUNITY),
        ('distance', DISTANCE_THRESHOLD_M),
        ('sort_by', 'distance'),
        ('limit', RESULTS_LIMIT),
    ]
    params += [
        (f'group_category[{i}]', slug)
        for i, slug in enumerate(sorted(REGION_SPECIFIC_CATEGORY_SLUGS))
    ]

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            response = requests.get(CHAPTERS_API_URL, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            groups = response.json().get('groups', [])
            chapters = [c for c in (normalize_chapter(g) for g in groups) if c]
            print(f"API returned {len(groups)} nearby groups ({len(chapters)} regional)", file=sys.stderr)
            return chapters
        except (requests.RequestException, ValueError) as e:
            print(f"Attempt {attempt}/{RETRY_ATTEMPTS} to reach the chapter API failed: {e}", file=sys.stderr)
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    print(f"Giving up after {RETRY_ATTEMPTS} attempts to reach the chapter API", file=sys.stderr)
    return None

def annotate_distance(requested_coords, chapters):
    """
    Add a 'distance_km' field (distance from requested_coords) to each chapter
    that has coordinates, dropping any without. Used for display; the API has
    already restricted results to within the threshold.
    """
    annotated = []
    for chapter in chapters:
        lat, lon = chapter.get('latitude'), chapter.get('longitude')
        if lat is None or lon is None:
            continue
        distance = geodesic(requested_coords, (lat, lon)).kilometers
        annotated.append({**chapter, 'distance_km': round(distance, 2)})
    return annotated

def format_output(nearby_chapters):
    """
    Format the nearby chapters as markdown for GitHub comment.
    """
    if not nearby_chapters:
        return ""

    output = []
    for chapter in nearby_chapters:
        location = f" — {chapter['location']}" if chapter.get('location') else ""
        output.append(
            f"- **{chapter['name']}**{location} (~{chapter['distance_km']} km away) - {chapter['url']}"
        )

    return '\n'.join(output)

def set_github_output(name, value):
    """
    Set a GitHub Actions output variable.

    Uses the heredoc form required by the $GITHUB_OUTPUT file for multi-line
    values; the older `%0A` percent-encoding is NOT decoded from that file and
    would surface literal `%0A` in the posted comment.
    """
    github_output = os.getenv('GITHUB_OUTPUT')
    if github_output:
        # A delimiter that cannot appear in the value (per Actions guidance).
        delimiter = 'EOF_NEARBY_CHAPTERS'
        with open(github_output, 'a') as f:
            f.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")
    else:
        print(f"{name}={value}")

def report(status, nearby_chapters=''):
    """
    Emit the two GitHub Actions outputs the workflow branches on:
    `status` (found | none | error) and the `nearby_chapters` markdown list.
    """
    set_github_output('status', status)
    set_github_output('nearby_chapters', nearby_chapters)

def main():
    """
    Main function to check for nearby chapters.
    """
    issue_body = os.getenv('ISSUE_BODY', '')
    issue_title = os.getenv('ISSUE_TITLE', '')

    print(f"Issue title: {issue_title}", file=sys.stderr)

    # Extract location from issue. A body we can't parse isn't an API problem and
    # a /recheck won't help, so report "none" (stay silent) rather than "error".
    requested_location = extract_location_from_issue(issue_body)

    if not requested_location:
        print("Could not extract location from issue body", file=sys.stderr)
        report('none')
        return

    print(f"Requested location: {requested_location}", file=sys.stderr)

    # Geocode the requested location so we can hand the coordinates to the API.
    requested_coords = get_coordinates(requested_location)
    if not requested_coords:
        print(f"Could not geocode requested location: {requested_location}", file=sys.stderr)
        report('none')
        return

    print(f"Requested location coordinates: {requested_coords}", file=sys.stderr)

    # Let the API do the distance search. None means it failed after retries;
    # report "error" so the workflow can invite a /recheck.
    chapters = fetch_nearby_chapters(*requested_coords)
    if chapters is None:
        report('error')
        return

    nearby_chapters = annotate_distance(requested_coords, chapters)
    nearby_chapters.sort(key=lambda c: c['distance_km'])

    if nearby_chapters:
        print(f"Found {len(nearby_chapters)} nearby chapters", file=sys.stderr)
        report('found', format_output(nearby_chapters))
    else:
        print("No nearby chapters found", file=sys.stderr)
        report('none')

if __name__ == '__main__':
    main()
