---
name: quotes-are-real
skill: whatdidwedecide
description: Every decision, action and open question quotes the conversation word for word.
tags: [grounding]
check: node ../../../skills/whatdidwedecide/scripts/check.mjs quotes {answer} fixtures/source.txt
---

## Setup
The product's own example conversation in `fixtures/source.txt`.

## Task
"What did we decide?"

## Pass
- Every item's quote is in the conversation.

## Fail
- A quote that summarises instead of quoting. `fixtures/bad.json` writes "We agreed to launch on the 14th." (the conversation says "OK, launch on the 14th then.").
