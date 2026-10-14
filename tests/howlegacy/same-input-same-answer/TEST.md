---
name: same-input-same-answer
skill: howlegacy
description: The same pages scored three times land in the same tier.
tags: [consistency]
runs: 3
---

## Setup
The Ledgerline pages in `fixtures/`.

## Task
"How legacy is ledgerline.example?", three separate times.

## Pass
- All three runs give the same tier, and no signal's level differs by more than 1 between runs.

## Fail
- A tier that changes between runs. That's why the skill judges three times and keeps the middle level.

Needs a model, so `npm test` skips it; `npm run try -- howlegacy` runs it.
