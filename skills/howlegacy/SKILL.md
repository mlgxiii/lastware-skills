---
name: howlegacy
description: Score how "legacy" a company is (0–100) from its public website, using six signals of software built for another era, each backed by a quote from the site. Use when someone asks how old-school, disruptable or modern a company or software vendor is, or wants to size up an incumbent.
---

# HowLegacy

Score how much a company still runs on the constraints software used to have:
- interfaces that had to be fixed in advance
- workflows that had to be set up front
- every application owning its own data

This is the method behind HowLegacy, a [Lastware](https://github.com/mlgxiii) micro, written so your agent can run it with its own model.

## Step 1: read the site

Fetch the company's homepage and up to five pages about how the product is **bought, set up and used**: pricing, product, how it works, about, integrations or API docs. If the site links a careers page, read it and up to two job posts too, because they name the stack (COBOL, SAP, on-premise). Save each page as text with its URL.

## Step 2: judge six signals

Give each signal a level from **0** (built for now) to **4** (fully the old way):

| id | Question | 0 looks like | 4 looks like |
| --- | --- | --- | --- |
| `screens` | How do people use it? | An API, self-serve, works inside other tools or through agents | Only its own screens: portals, desktop software, modules, demo-gated |
| `workflows` | How long until it works? | Sign up and it works the same day | Implementation projects, certified consultants, training, months to go live |
| `data` | Who holds the data? | Open APIs, exports, your data stays yours | "System of record", proprietary formats, on-premise, connectors sold separately |
| `people` | Who does the work? | The software does it end to end | Account managers, call centres, forms, PDFs and "our experts will" |
| `pricing` | How is it sold? | Public prices, usage-based, start free | Per seat, licence or module, "request a quote", multi-year contracts |
| `era` | When was it built? | Recent, modern stack, ships often | Founded decades ago, version numbers, mainframe or legacy stack in job posts |

Rules:
- Judge the **default path of a new customer**: how they buy, start and use the product. Enterprise extras on top of a self-serve product (success managers, professional services, "contact sales" for large plans) don't make it legacy; they count only when they're the only way in.
- Judge the company's own product and how it's sold, not its customers.
- "AI" on the homepage is not evidence of being modern; how the product is bought, set up and used is.
- Big and old is not the same as legacy: an old company with self-serve, public prices and an open API scores low.
- When a signal has no evidence either way, give it **2** and no quotes.
- Each signal gets one plain sentence (`finding`) naming the specifics, plus up to two **verbatim** quotes of at least three words, each with its page URL. Never invent or paraphrase a quote.

**Judge three times and keep the middle level for each signal.** A single judgment can flip on borderline evidence. Use the finding and quotes from a judgment that gave that middle level.

## Step 3: score and check

The score is arithmetic, never your opinion. Write the signals to `check.json` and run:

```sh
node scripts/score.mjs check.json                      # → score 0–100 and tier
node scripts/check.mjs quotes check.json pages/*.txt   # every quote is on a page, word for word
```

Tiers: 80+ Fossil, 60+ Legacy, 40+ Aging, 20+ Modern, below 20 Native.

A signal whose quotes all fail the check is **inferred**: keep its level, but say so.

## Step 4: openings (optional)

For signals at 3 or 4, add up to three **openings** for a newcomer. Each one needs:
- a job customers hire the company for, in their words
- how this company makes them do it today, from the site
- one concrete sentence on what a newcomer would ship instead, starting with a verb

## Output

```json
{
  "name": "Company", "url": "https://example.com",
  "signals": [
    { "id": "pricing", "level": 4, "finding": "Pricing is per user, through a quote form.",
      "quotes": [{ "quote": "Contact us for a custom quote", "source": "https://example.com/pricing" }] }
  ],
  "score": 63, "tier": "Legacy",
  "verdict": "At most 20 words, built on the single most telling specific. Dry, never mean.",
  "openings": [{ "signal": "pricing", "job": "…", "today": "…", "instead": "…" }]
}
```

Present the score and tier first, then the verdict, then each signal with its finding and quote, marking inferred ones. It reads what a company says about itself, so treat it as a conversation starter, not a rating.
