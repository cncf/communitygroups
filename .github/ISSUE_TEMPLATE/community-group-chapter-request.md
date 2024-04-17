---
name: Community Group Chapter Request
about: For new chapters to join the CNCF ecosystem to be supported in hosting meetups
  and small events alike.
title: Community Group Chapter Request
labels: ''
assignees: ''

---

name: Cloud Native Community Group (CNCG) Application
description: Apply to host a city-based chapter
title: "[Cloud Native] <City Name>"
labels: [New]
body:
- type: markdown
  attributes:
    value: |
     Thanks for filling out a community group application. Please read the CNCG guidelines and understand what a CNCF chapter is along with the [benefits and expectations](https://github.com/cncf/communitygroups/blob/main/README.md) for city chapters.
- type: textarea
  attributes:
    label: Applicant(s) name and contact email(s)
    description: Provide the name(s) and email address(es) of yourself and any other individual who should be contacted regarding this application. If more than one email is provided, please comma separate them.
    placeholder: Comma-separate multiple emails here
  validations:
    required: true
- type: input
  attributes:
    label: Chapter Summary
    description: Provide a very brief, single line summary of the chapter and desire for it.
    placeholder: One-line summary of the chapter
  validations:
    required: true
- type: textarea
  attributes:
    label: Chapter Description
    description: Provide a brief, 100-300 word description of the chapter that explains what it aims to do, and who it intends to gather.
    placeholder: Describe
  validations:
    required: true
- type: input
  attributes:
    label: Your personal URL references
    description: Add your LinkedIn profile to showcase your experience with community, and any URL pointing to meetups you may currently be hosting. If you have a GitHub account, please add it as well.
    placeholder: Reference URLs
  validations:
    required: true
- type: input
  attributes:
    label: Your community.cncf.io profile
    description: Please confirm that you have already created an account on https://community.cncf.io before submitting this form.
    placeholder: Add profile URL here
  validations:
    required: true
- type: textarea
  attributes:

## Terms and Conditions
* You agree to adhere by the [CNCF Code of Conduct (CoC)](https://github.com/cncf/foundation/blob/main/code-of-conduct.md), and enforce the same upon any co-organizers or speakers onboarded in the future.
* You agree to remain [vendor-neutral](https://contribute.cncf.io/maintainers/community/vendor-neutrality) in all content presented in your events or meetups, with the exception of one 5-15 minute sponsored talks that are not the majority of the content.
* You agree to be welcome to all people who want to attend your meetups, no matter what skill level they are at. With the exception of any Code of Conduct violations.

   label: Completion of Inclusive and Open Source Community Orientation
    description: To assure this, please take the the free [Inclusive Open Source Community Orientation (LFC102)](https://training.linuxfoundation.org/training/inclusive-open-source-community-orientation-lfc102/) and provide a link to proof of completion.
    placeholder: Add URL here
  validations:
    required: true
- type: textarea
  attributes:
