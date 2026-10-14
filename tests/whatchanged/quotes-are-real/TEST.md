---
name: quotes-are-real
skill: whatchanged
description: Every before-quote is in the old version and every after-quote in the new one, word for word.
tags: [grounding]
check: node ../../../skills/whatchanged/scripts/diff.mjs verify {answer} fixtures/old.md fixtures/new.md --only quotes-are-real
---

## Setup
Same two versions.

## Task
"What changed in the Northwind Notes terms?"

## Pass
- Each `before` is found in `old.md` and each `after` in `new.md` (Markdown, case and spacing ignored).

## Fail
- A quote that paraphrases. `fixtures/bad.json` writes "we may use your notes to train AI".
