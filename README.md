# TurboGerrit

## Features

Provides Push to Gerrit command based on ssh.

## Requirements

ssh utility installed

## Extension Settings

This extension contributes the following settings:

* `turbogerrit.reviewers`: predefined list of reviewers emails.
* `turbogerrit.username`: Gerrit Code Review username.
* `turbogerrit.gitreviewPath`: Custom path to .gitreview file.

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.2

- using plain ssh instead git-review
- workspace config added for:
   1. reviewers, 
   2. username
   3. custom .gitreview path

### 0.0.1

Initial release. Push to Gerrit available as command and from vcs context menu.