---
name: whatchanged
description: Compare two versions of a contract, terms of service, privacy policy or regulation and explain every change that matters, side by side, with the exact words before and after. Use when someone is asked to accept a new version, gets a "we've updated our terms" email, or wants to know what changed in a document.
---

# WhatChanged

Two versions in. The changes that matter out.

Code finds the changes, so none can be skipped. You explain what each one means, quoting both versions. This is the method behind WhatChanged, a [Lastware](https://github.com/mlgxiii) micro.

## Step 1: get both versions as text

Save the old and new versions as text files (`old.txt`, `new.txt`). For a web page, keep the main text and drop the menus. For a PDF, convert it to text and keep `[page N]` markers when you can. If the user only has the new version, check the Wayback Machine (web.archive.org) for the old one, and say which date you compared against.

## Step 2: find every change

```sh
node scripts/diff.mjs old.txt new.txt > diff.json
```

`diff.json` lists every clause that was **changed**, **added** or **removed**, each with an id (`c1`, `c2`…), its section, and the exact text before and after. Don't look for changes yourself: this list is complete. A rewritten paragraph can show up as one removed clause plus one added one; explain those together.

## Step 3: explain them

For every change id, decide:

- **It matters:** put it in `changes`. Group ids that make one change together (a clause removed and its replacement added).
- **It doesn't:** put it in `minor` with a short reason ("the 'Last updated' date", "typo", "new office address"). Never drop a change without saying why.

For each change that matters:
- `title`: what changed, in a few plain words, from the reader's side ("Your notes can be used to train AI", not "Section 1 amended").
- `what`: one sentence on what it means for the reader. Use only facts and numbers from the two versions.
- `before` and `after`: the exact words from each version. Copy them from `diff.json`; never paraphrase. Quote the sentence that carries the change, not the whole section (one or two sentences). To show clauses that aren't next to each other, put … between them, in the order they appear. Leave `before` empty for something new and `after` empty for something removed.
- `impact`: **high** for changes to money, data, rights, liability, AI use of your content, or how disputes are settled. **medium** for deadlines, notice periods and obligations. **low** for anything else that still matters.

Order `changes` by impact, highest first. Write a one-sentence `summary` of the high-impact changes.

## Step 4: check before you hand it over

```sh
node scripts/diff.mjs verify answer.json old.txt new.txt
```

It checks four things:
- **no-silent-change:** every change is explained or declared minor with a reason.
- **no-invented-change:** every id you cite exists.
- **quotes-are-real:** every `before` is in the old version and every `after` in the new one.
- **numbers:** every number you wrote appears in one of the versions.

Fix every ✗ and run it again until it passes.

## Output

```json
{
  "document": "Northwind Notes Terms of Service",
  "summary": "Your notes can now train Northwind's AI unless you opt out, and disputes go to private arbitration.",
  "changes": [
    { "ids": ["c3"], "kind": "changed", "impact": "high", "title": "Your notes can be used to train AI",
      "what": "Northwind can now use your content to train its AI models unless you opt out in Settings.",
      "before": "We use Your Content only to provide and improve the service for you.",
      "after": "including to train and improve our AI models, unless you opt out in Settings" }
  ],
  "minor": [{ "ids": ["c1", "c2"], "why": "The \"Last updated\" date." }]
}
```

Show the summary first, then each change with its before and after side by side, then the minor ones in one line. Don't give legal advice: say what changed and what it means in plain words.
