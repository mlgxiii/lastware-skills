---
name: quotes-are-real
skill: tenderreply
description: Every quote in a tender response is in the file it names, word for word.
tags: [grounding]
check: node ../../../skills/tenderreply/scripts/check.mjs quotes {answer} fixtures/tender.txt fixtures/case-studies.txt fixtures/company.txt
---

## Setup
The tender in `fixtures/tender.txt`, the company's documents in `fixtures/case-studies.txt` and `fixtures/company.txt` (a fictional IT company bidding for library IT support).

## Task
"Answer Q2 and Q3 of this tender from our documents."

## Pass
- Every `quote` in the answer is found in a fixture, word for word (Markdown, case and spacing ignored).

## Fail
- Any quote that was paraphrased or invented. `fixtures/bad.json` paraphrases "6 branches and 85 public PCs" as "six library branches with fast on-site response".
