---
name: no-silent-change
skill: whatchanged
description: Every change between two versions is explained, or declared minor with a reason. None is skipped.
tags: [completeness]
check: node ../../../skills/whatchanged/scripts/diff.mjs verify {answer} fixtures/old.md fixtures/new.md --only no-silent-change
---

## Setup
Two versions of a fictional SaaS's terms in `fixtures/` (March 2025 and October 2026). Code finds 8 changed clauses.

## Task
"What changed in the Northwind Notes terms?"

## Pass
- Every change id from `diff.mjs` is either explained in `changes` or listed in `minor` with a reason.

## Fail
- A change left out. `fixtures/bad.json` skips the AI-training clause, the one that matters most.
- A change marked minor with no reason.
