---
name: quotes-are-real
skill: howlegacy
description: Every quote behind a HowLegacy signal is on the company's site, word for word.
tags: [grounding]
check: node ../../../skills/howlegacy/scripts/check.mjs quotes {answer} fixtures/home.txt fixtures/pricing.txt fixtures/implementation.txt fixtures/careers.txt
---

## Setup
Four pages of a fictional accounting vendor, Ledgerline, in `fixtures/`.

## Task
"How legacy is ledgerline.example?"

## Pass
- Every quote under every signal is found on one of the pages.

## Fail
- A quote that describes the site instead of quoting it. `fixtures/bad.json` writes "priced per seat with expensive annual licences".
