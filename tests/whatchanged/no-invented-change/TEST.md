---
name: no-invented-change
skill: whatchanged
description: The explanation cites only changes that exist.
tags: [grounding]
check: node ../../../skills/whatchanged/scripts/diff.mjs verify {answer} fixtures/old.md fixtures/new.md --only no-invented-change
---

## Setup
Same two versions.

## Task
"What changed in the Northwind Notes terms?"

## Pass
- Every id cited in `changes` or `minor` is a real change between the two versions.

## Fail
- An invented change. `fixtures/bad.json` adds a "cancellation fee" (c9) that is in neither version.
