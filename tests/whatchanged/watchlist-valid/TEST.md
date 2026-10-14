---
name: watchlist-valid
skill: whatchanged
description: Every document someone adds to the watchlist by pull request is a public https page with a unique id, a name and a known kind.
tags: [contributions]
check: node ../../../scripts/validate-watch.mjs {answer}
---

## Setup
Watchlist entries in the format of `watch/<id>.json`.

## Task
A contributor opens a pull request adding a document to watch.

## Pass
- Each entry has a lower-case `id` (matching its file name), a `name`, an `https://` public `url`, and a `kind` from: terms, privacy, ai-policy, pricing, regulation.
- No id is watched twice.

## Fail
- `fixtures/bad.json`: a duplicate id, an id with capitals and spaces, no name, a localhost address over http, an unknown kind.
