# TurboGerrit

## Features

Gerrit Code Review dashboard for VSCode. Supports push to review, inspecting 
changes and reply (+1, +2 and Submit commands).

## Requirements

ssh, git utilities installed.

## Extension Settings

This extension contributes the following settings:

* `turbogerrit.reviewers`: predefined list of reviewers emails.
* `turbogerrit.username`: Gerrit Code Review username.
* `turbogerrit.gitreviewPath`: Custom path to .gitreview file.
* `turbogerrit.email`: Email for filter reviews.

## Release Notes

## 0.0.6
- Separate trees for incoming and outcoming reviews, bugdixing and small 
refactoring in sourcecode

### 0.0.5
- Separate view in SCM panel, provides commits assigned to email (set in config or with initial setup command), diff for changed files, review and open gerrit webview url

### 0.0.4
- global config prioritized for username

### 0.0.3
- correct separator for revirewers attr
- proper success handler

### 0.0.2

- using plain ssh instead git-review
- workspace config added for:
   1. reviewers, 
   2. username
   3. custom .gitreview path

### 0.0.1

Initial release. Push to Gerrit available as command and from vcs context menu.