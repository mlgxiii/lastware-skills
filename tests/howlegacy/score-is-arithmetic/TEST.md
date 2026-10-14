---
name: score-is-arithmetic
skill: howlegacy
description: The 0–100 score comes from the six levels by arithmetic, never from the model's opinion.
tags: [consistency]
check: node ../../../skills/howlegacy/scripts/score.mjs fixtures/check.json
expect: "score": 83
---

## Setup
Six signal levels in `fixtures/check.json`: 4, 4, 3, 2, 4, 3.

## Pass
- The score is round(sum of levels / 24 × 100) = 83, tier Fossil.

## Fail
- Any other score, or a score the model wrote itself.
