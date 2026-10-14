---
name: no-invented-numbers
skill: tenderreply
description: Every number in a tender response appears in the tender or the company's documents.
tags: [grounding]
check: node ../../../skills/tenderreply/scripts/check.mjs numbers {answer} fixtures/tender.txt fixtures/case-studies.txt fixtures/company.txt
---

## Setup
Same documents as `quotes-are-real`.

## Task
"Answer Q2 of this tender from our documents."

## Pass
- Every figure in the answer's text (money, counts, percentages) appears in a source. Years and placeholders are ignored.

## Fail
- A rounded, inflated or invented figure. `fixtures/bad.json` turns £180,000 into £250,000 and adds "12 branches".
