---
name: whatdidwedecide
description: Turn a meeting transcript, Slack thread or WhatsApp group into decisions, owners, next steps and open questions, each linked to the exact words it came from. Use when someone shares meeting transcript, chat export or notes and asks: What was decided, who committed to what, and what is still open?
---

# WhatDidWeDecide

The real plan from a messy group conversation. This is the method behind [WhatDidWeDecide](https://mlgxiii.vercel.app/p/whatdidwedecide), the hosted version. Here your agent runs it with its own model.

## Inputs

- **Meeting transcript, chat export or notes**

Save the input as a text file (`source.txt`), so the quotes can be checked against it.

## What to find

What was decided, who committed to what, and what is still open?

Extract only what the conversation supports. A decision is something the group agreed to; an action is a commitment by a person; an open question is raised but unresolved. Assign an owner only when a person clearly committed. Prefer fewer, sharper items.

Each item is one of these kinds:

- `decision`: Decision
- `action`: Action
- `open`: Open question
- `disagreement`: Disagreement

## Rules

- Use only the source text.
- Every item needs a verbatim quote copied exactly from the source: short, one sentence or less. The only exception is an inference about something absent, which gets an empty quote.
- A quote is one continuous passage: never join lines from different places or speakers. Use two items, or put … between the parts, in the order they appear.
- Never write a quote that isn't in the source. Never invent people, dates or numbers.
- Answer in the language of the source.

## Check before you hand it over

Write the result to `answer.json` and run:

```sh
node scripts/check.mjs quotes  answer.json source.txt   # every quote is in the source, word for word
node scripts/check.mjs numbers answer.json source.txt   # every number appears in the source
```

Fix every ✗ by copying the quote exactly, or drop the item. Then run the checks again.

## Output

```json
{ "items": [{ "kind": "decision", "text": "One plain sentence.", "quote": "the exact words from the source" }] }
```

Lead with what the reader most needs. Show each item with its quote.
