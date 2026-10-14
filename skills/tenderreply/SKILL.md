---
name: tenderreply
description: Answer a tender, RFP or bid questionnaire from a company's own documents, with every line sourced. Use when someone has a tender to respond to and documents (past bids, CVs, case studies, certificates, policies) to answer it from. Claims the documents don't prove become gaps to fill, never invented facts.
---

# TenderReply

Write a tender response where every sentence traces to a source. Evaluators score evidence, so a gap the bidder can fill beats a claim they can't prove.

This is the method behind TenderReply, a [Lastware](https://github.com/mlgxiii) micro, written so your agent can run it with its own model.

## Inputs

- **The tender:** one or more files (invitation, specification, response template, clarifications).
- **The company's documents:** past bids, CVs, case studies, certificates, policies.

Convert PDFs and Word files to text first. Keep `[page N]` markers when you can, so `check.mjs` can report the page of each quote. Put each file in its own text file and keep the names: quotes are checked against them.

## Step 1: what must be written

Read the tender and list the sections the bidder must **write**, in the order the tender asks for them.

- If the tender numbers its scored questions (Q1, Q2… or 6, 7, 8, often in a response template or quality questionnaire), make **exactly one section per scored question**, titled with its number and name, with that question's own word limit. Never merge questions.
- If it has no scored questions, write the sections an evaluator would score from its scope and award criteria: understanding of the requirement, approach and method, relevant experience, team and qualifications, timetable and project management, plus any deliverable the scope singles out.
- Forms, price schedules, declarations, pass/fail questions (insurance, modern slavery, data protection, financial standing), certificates, policies and references are **not sections**: list them under `attach`.
- Leave out instructions that ask nothing (how to submit, the clarification process).

Every ask needs a short verbatim quote from the tender. Never invent a requirement, a limit or a date.

## Step 2: write each section

For each section, find the passages of the company's documents that prove each ask, then write it. There are two kinds of sentence, and each one cites verbatim quotes copied exactly from the named file:

1. **Facts about the company** (experience, clients, projects, people, qualifications, certificates, numbers, methods): cite the company's documents. Say no more than the quotes say. Never broaden, round or improve a claim; split a sentence rather than generalise. Never invent a client, a person, a certificate or a figure.
2. **What the company will do on this contract** (deliverables, dates, scope): cite the tender passage it answers and, where possible, a company document showing it already does this.

A quote from the tender shows what is **asked**, never that the company meets it. A claim that the company holds a certificate, meets a standard or is "equivalent" to one needs a quote from the company's own documents that says so.

When the tender asks for something the documents don't show, write the line as a **[bracketed placeholder]** saying what evidence to add, with `gap` set and no cites.

Answer every ask, in order, directly: lead with the answer, then the proof. Use bullets for lists of projects, people or steps. Use plain words and no filler ("we are delighted", "cutting-edge"). Keep within the word limit, or to what the evidence supports (usually 120–350 words). Write in the language of the tender.

## Step 3: check before you hand it over

Write the answer as JSON (format below) to `answer.json`, then run:

```sh
node scripts/check.mjs quotes  answer.json tender.txt docs/*.txt   # every quote is in its file, word for word
node scripts/check.mjs numbers answer.json tender.txt docs/*.txt   # every number appears in a source
```

For every ✗:
- Fix the quote by copying it exactly from the file.
- Or rewrite the line so it claims only what a real quote says.
- Or turn the line into a [gap].

Run the checks again until they pass. Then reread each line next to its quotes: **a real quote isn't proof** if the line claims more than it says.

## Output

```json
{
  "title": "Tender title",
  "buyer": "Buyer name or null",
  "deadline": "As written in the tender, or null",
  "sections": [
    {
      "title": "Q3 Relevant experience",
      "limit": "500 words or null",
      "lines": [
        { "text": "We delivered the Riverside library refurbishment in 2023 for £1.2m.",
          "cites": [{ "file": "case-studies.txt", "quote": "Riverside library refurbishment, completed 2023, contract value £1.2m" }],
          "gap": null },
        { "text": "[Add a reference from a public-sector client]", "cites": [], "gap": "A public-sector reference" }
      ]
    }
  ],
  "attach": [{ "text": "Insurance certificate", "quote": "Bidders must provide evidence of £5m public liability insurance" }]
}
```

Show the user the response section by section, with each line's source, then the gaps as a to-do list.
