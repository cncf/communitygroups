# Sessionize New Proposal GitHub Action

This GitHub Action polls the Sessionize API for new session proposals and notifies a Slack channel when new proposals are detected.

## Overview

The action runs on a schedule (every hour between 8 AM and 8 PM CST, Monday to Friday) and can also be triggered manually via workflow dispatch. It performs the following tasks:

1. Retrieves the latest session ID from Sessionize
2. Compares it with the previously stored session ID
3. If new sessions are found, sends notifications to a configured Slack channel
4. Updates the stored session ID for future comparisons

## Configuration

The following secrets and variables need to be configured in your GitHub repository:

To configure these settings:
1. Go to your repository's Settings
2. Navigate to Secrets and variables → Actions
3. Add the following secrets and variables:

### Required Secrets
- `SESSIONIZE_SESSION_LIST_URL`: The URL endpoint for retrieving sessions from Sessionize

> **Note:** To create the Sessionize session list URL:
> 1. Log into your Sessionize account
> 2. Navigate to the API / Embed tab
> 3. Click "Create new endpoint"
> 4. Select JSON as the format
> 5. In the "Includes sessions" dropdown, select "All Except Declined"
> 6. Click "Create"
> 7. Once created, click the "Get Code" button
> 8. Copy the Session List URL (the URL that ends with `/view/Sessions`)

- `SLACK_WEBHOOK_URL`: The webhook URL for your Slack channel
- `REPO_ACCESS_TOKEN`: A GitHub token with permissions to update repository variables

> **Note:** To set up the Slack webhook, create a copy of the Slack automation from [this link](https://slack.com/shortcuts/Ft091QD812HE/e8cce7d6069eb6243181f5050a0f071c). This will provide you with the webhook URL needed for the `SLACK_WEBHOOK_URL` secret.

### Required Variables
- `SESSIONIZE_LATEST_SESSION_ID`: Stores the ID of the most recently processed session

## How It Works

1. The action retrieves all sessions from Sessionize and identifies the latest session ID
2. It compares this ID with the previously stored ID (`SESSIONIZE_LATEST_SESSION_ID`)
3. If new sessions are found, it sends a notification to Slack containing:
    - Session ID
    - Title
    - Description
    - Speaker names
4. Finally, it updates the stored session ID for future comparisons

> **Note** If the previous ID is empty, it will be populated and no notifications sent.

## Schedule

The action runs automatically:
- Every hour between 8 AM and 8 PM CST
- Monday through Friday
- Can be triggered manually via workflow dispatch

## Output Format

The Slack notifications include the following information for each new session:
```json
{
  "id": "session_id",
  "title": "session_title",
  "description": "session_description",
  "speakers": "speaker1, speaker2, ..."
}
```

## Error Handling

- The action skips Slack notifications if the previous session ID is empty
- It continues to update the stored session ID even if no new sessions are found
- A 3-second delay is implemented between Slack notifications to prevent rate limiting
