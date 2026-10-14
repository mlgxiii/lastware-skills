# Lastware skills

Lastware's micros as agent skills. Each skill is a folder your agent can use: a `SKILL.md` that teaches it the method, plus small scripts that check its work. Each skill comes with tests that prove it works.

| Skill | What it does | Tests |
| --- | --- | --- |
| [tenderreply](skills/tenderreply/SKILL.md) | Answers a tender from a company's own documents, every line sourced, gaps instead of invented claims | quotes-are-real, no-invented-numbers, gaps-not-claims |
| [howlegacy](skills/howlegacy/SKILL.md) | Scores how legacy a company is (0–100) from its website, six signals, each with a quote | quotes-are-real, score-is-arithmetic, same-input-same-answer |
| [whatdidwedecide](skills/whatdidwedecide/SKILL.md) | Turns a messy conversation into decisions, owners and open questions, each quoted | quotes-are-real |
| [whatchanged](skills/whatchanged/SKILL.md) | Compares two versions of terms, a contract or a rule: code finds every changed clause, the agent explains each with the words before and after | no-silent-change, quotes-are-real, no-invented-change, watchlist-valid |

## Use a skill

Copy a skill's folder to where your agent loads skills from, for example `.claude/skills/tenderreply/` for Claude Code. Or point any agent at its `SKILL.md`. The scripts need only Node 18+: no install, no API key, no network.

```sh
node skills/tenderreply/scripts/check.mjs quotes  answer.json tender.txt docs/*.txt
node skills/tenderreply/scripts/check.mjs numbers answer.json tender.txt docs/*.txt
node skills/howlegacy/scripts/score.mjs screens=3 workflows=4 data=2 people=1 pricing=4 era=3
```

## WhatChanged: the monitor

The `whatchanged` skill also runs as a public monitor of the terms of service and AI rules behind the tools people use.

```sh
npm run watch                          # fetch every document in watch/, snapshot it, diff it against the last one
node scripts/backfill.mjs <id> 20260401  # or diff against an Internet Archive copy, to start with history
OPENAI_API_KEY=... npm run explain     # explain each diff with the skill, check it, repair it
npm run site                           # site/index.html
```

**Add a document:** open a pull request adding `watch/<id>.json`:

```json
{ "id": "cursor-terms", "name": "Cursor Terms of Service", "url": "https://cursor.com/terms-of-service", "kind": "terms" }
```

`kind` is one of `terms`, `privacy`, `ai-policy`, `pricing` or `regulation`. The `watchlist-valid` test checks it on the pull request, and the page lists it from the next weekly run (`.github/workflows/whatchanged.yml`). The monitor identifies itself, obeys robots.txt, waits between requests and skips pages that refuse it.

**How it stays honest and safe**
- Explanations are written by AI; the quotes are the documents' own words, checked against both versions. High-impact explanations stay hidden until a person reviews them: the weekly run opens an issue, and setting `"reviewed": true` in the change file publishes them.
- Pull requests run a check without any secret. A pull request that changes anything outside `watch/` fails that check on purpose: the weekly workflow runs this code with the repository's OpenAI key, so code changes need a line-by-line review.
- To ask for a document to be removed, open an issue.

**Try it:** the page has a "Compare two versions" box that runs the same diff in your browser, with no AI.

The first run, on 14 October 2026, compared 8 of the 10 documents with their April 2026 copies in the Internet Archive (Google's terms and the EU AI Act FAQ had none). Anthropic, Slack and Figma hadn't changed; Zoom's only changes were menu text.
- **Cursor** replaced binding arbitration with the courts of Texas.
- **GitHub** added "AI Features, Training, and Your Data": a licence to use your content to train AI models, for individual accounts, with an opt-out.
- **Atlassian** added rules for benchmarking and for usage-based products.
- **Dropbox** announced new terms from 1 January 2027.

## Why every skill has tests

On `gpt-4.1-mini`, the first drafts of two skills failed their tests:
- **TenderReply:** claimed the company's Cyber Essentials Plus was "equivalent to ISO 27001". No document says that.
- **WhatDidWeDecide:** glued two lines from different speakers into one "quote".

Telling the model not to do this in the instructions changed nothing. Running the skill's checks and handing back the failures fixed both in one round. That's the method: the agent writes, the scripts check, the agent fixes.

```sh
npm test                              # every check passes its good example and catches its bad one (no model)
OPENAI_API_KEY=... npm run try        # every skill on a real model, then its own checks, with one repair round
```

## Tests

Each test is a folder: `tests/<skill>/<test>/TEST.md`, plus `fixtures/` (inputs, a good answer and a bad one).

```markdown
---
name: gaps-not-claims
skill: tenderreply
description: When the documents don't prove what the tender asks, the response leaves a gap instead of claiming it.
check: node ../../../skills/tenderreply/scripts/check.mjs backed {answer} "ISO 27001" --in fixtures/company.txt
---
## Setup / ## Task / ## Pass / ## Fail
```

`check` must pass on `fixtures/good.json` and fail on `fixtures/bad.json`. A test without `check` needs a model, and `npm run try` runs it.

## New skills from the micros

Most Lastware micros are configuration on one engine (`lastware/src/lib/products.ts`). `npm run generate` writes a skill for each live one, and `npm run generate -- --all` adds the ones not launched yet. Micros with their own server code, like TenderReply and HowLegacy, get a skill written by hand from that code. Every skill gets its own copy of `shared/check.mjs`, so each folder works on its own.

## License

MIT. The fixtures are fictional.
