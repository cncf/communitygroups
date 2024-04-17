---
name: Community Group Chapter Request
about: This is a request form to begin a new chapter
title: Community Group Chapter Request
labels: ''
assignees: ''

---

name: "Cloud Native Community Group (CNCG) Application"
description: Apply for a new chapter
title: "Cloud Native <City Name>"
labels: [New]
body:
- type: markdown
attributes:
value: | "Thank you for your interest in hosting a community group. Please read the CNCG guidelines and understand what a CNCF chapter is along with the [benefits and expectations](https://github.com/cncf/communitygroups/blob/main/README.md) for city chapters."

label: Name of your chapter name
    description: New chapters should to begin a city level, with the opportunity grow over time.
    placeholder: Cloud Native CITY NAME
  validations:
    required: true
- type: input
  attributes:

label: Application contact emails
    description: Provide the email address(es) of individuals who should be contacted regarding this application. If more than one email is provided, please comma separate them.
    placeholder: Comma-separate multiple emails here
  validations:
    required: true
- type: input
  attributes:
  
label: Chapter Summary
    description: Provide a very brief, single line summary of the chapter and desire for it.
    placeholder: This chapter brings together...
  validations:
    required: true
- type: input
  attributes:

label: Chapter Desription
    description: Provide a brief, 100-300 word description of the chapter that explains what it aims to do, and who it intends to gather.
    placeholder: This chapter brings together...
  validations:
    required: true
- type: input
  attributes:

label: Tell as about yourself and other organizers
    description: Provide the name(s) and email address(es) of yourself and any other individual who should be contacted regarding this application. If more than one email is provided, please comma separate them.
    placeholder: Applicant(s) name and contact email(s)
 validations:
    required: true
 - type: input
    attributes:

label: Your personal URL references
description: Add your LinkedIn profile to showcase your experience with community, and any URL pointing to meetups you may currently be hosting. If you have a GitHub account, please add it as well.]
placeholder: Your community.cncf.io profile URL
validations:
    required: true
 - type: input
    attributes:
  
- propertyName: response to CoC
    name: Agree to CoC
    description: You agree to adhere by the [CNCF Code of Conduct (CoC)](https://github.com/cncf/foundation/blob/main/code-of-conduct.md), and enforce the same upon any co-organizers or speakers onboarded in the future.
    type: boolean
    allowMultiple: false
    defaultValue: false
    optional: true
    sensitive: false

      - propertyName: response to vendor nuetrality
    name: Agree meetup conent is vendor nuetral
    description: You agree to remain [vendor-neutral](https://contribute.cncf.io/maintainers/community/vendor-neutrality) in all content presented in your events or meetups, with the exception of one 5-15 minute sponsored talks that are not the majority of the content.
    type: boolean
    allowMultiple: false
    defaultValue: false
    optional: true
    sensitive: false

  - propertyName: response to inclusivity
    name: Agree to be inclusive
    description: You agree to be welcome to all people who want to attend your meetups, no matter what skill level they are at. With the exception of any Code of Conduct violations.
    type: boolean
    allowMultiple: false
    defaultValue: false
    optional: true
    sensitive: false

  - propertyName: response to open source inclusivity course
    name: Confirm you have take the LFC102 course
    description: To assure inclusivity, please take the the free [Inclusive Open Source Community Orientation (LFC102)](https://training.linuxfoundation.org/training/inclusive-open-source-community-orientation-lfc102/) and provide a link to proof of completion.
    type: boolean
    allowMultiple: false
    defaultValue: false
    optional: true
    sensitive: false
