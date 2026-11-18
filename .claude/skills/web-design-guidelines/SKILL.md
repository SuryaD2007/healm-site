---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

> Local change for healm-site: the upstream skill fetches its rules from the `main` branch on every
> run. Here they are pinned to a reviewed copy, `guidelines.md`, taken from
> vercel-labs/web-interface-guidelines at commit 434b7f91364665f2f733b310ec54809bf8f37937 (MIT).
> Do not fetch the rules from the network. To update, fetch a new commit, read it, and replace
> `guidelines.md` (see docs/SKILLS.md).

## How It Works

1. Read the rules in `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Project overrides (healm-site)

- Healm writes headings and buttons in sentence case, like the app. Ignore the Title Case rule.
- Healm's voice uses "you" and sometimes "Healm" in the third person. First person ("we") is avoided,
  which matches the guidelines.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
