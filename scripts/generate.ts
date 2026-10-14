// Writes a skill for every config-driven Lastware micro (no custom `tool`), straight from lastware/src/lib/products.ts,
// and copies the shared check script into every skill so each folder works on its own.
//
//   npm run generate          live micros only
//   npm run generate -- --all also the ones marked "soon"
//
// TenderReply and HowLegacy keep their method in server code, so their skills are written by hand; this script only
// refreshes their copy of check.mjs.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, type Product } from '../../../lastware/src/lib/products.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'https://mlgxiii.vercel.app/p';
const all = process.argv.includes('--all');

const configDriven = (p: Product) => !p.tool || p.tool === 'extract';

function skill(p: Product): string {
	const inputs = p.inputs.map((i) => `- **${i.label}**${i.placeholder ? ` (${i.placeholder})` : ''}`).join('\n');
	const kinds = p.kinds.map((k) => `- \`${k.id}\`: ${k.label}`).join('\n');
	const sources = p.inputs.length > 1 ? p.inputs.map((i) => `${i.id}.txt`).join(' ') : 'source.txt';
	const exampleKind = p.kinds[0].id;
	const hosted = p.status === 'live' ? `This is the method behind [${p.name}](${HOST}/${p.slug}), the hosted version. Here your agent runs it with its own model.` : `This is the method behind ${p.name}, a [Lastware](https://github.com/mlgxiii) micro, written so your agent can run it with its own model.`;
	return `---
name: ${p.slug}
description: ${p.description} Use when someone shares ${p.inputs.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(' and ')} and asks: ${p.question}
---

# ${p.name}

${p.tagline} ${hosted}

## Inputs

${inputs}

Save ${p.inputs.length > 1 ? 'each input as its own text file' : 'the input as a text file'} (\`${sources}\`), so the quotes can be checked against ${p.inputs.length > 1 ? 'them' : 'it'}.

## What to find

${p.question}

${p.instructions}

Each item is one of these kinds:

${kinds}

## Rules

- Use only the source text.
- Every item needs a verbatim quote copied exactly from the source: short, one sentence or less. The only exception is an inference about something absent, which gets an empty quote.
- A quote is one continuous passage: never join lines from different places or speakers. Use two items, or put … between the parts, in the order they appear.
- Never write a quote that isn't in the source. Never invent people, dates or numbers.
- Answer in the language of the source.

## Check before you hand it over

Write the result to \`answer.json\` and run:

\`\`\`sh
node scripts/check.mjs quotes  answer.json ${sources}   # every quote is in the source, word for word
node scripts/check.mjs numbers answer.json ${sources}   # every number appears in the source
\`\`\`

Fix every ✗ by copying the quote exactly, or drop the item. Then run the checks again.

## Output

\`\`\`json
{ "items": [{ "kind": "${exampleKind}", "text": "One plain sentence.", "quote": "the exact words from the source" }] }
\`\`\`

Lead with what the reader most needs. Show each item with its quote.
`;
}

let written = 0;
for (const p of products.filter((p) => configDriven(p) && (all || p.status === 'live'))) {
	const dir = join(root, 'skills', p.slug);
	mkdirSync(join(dir, 'scripts'), { recursive: true });
	writeFileSync(join(dir, 'SKILL.md'), skill(p));
	if (p.example && Object.keys(p.example).length && !existsSync(join(dir, 'example'))) {
		mkdirSync(join(dir, 'example'), { recursive: true });
		for (const [id, text] of Object.entries(p.example)) writeFileSync(join(dir, 'example', p.inputs.length > 1 ? `${id}.txt` : 'source.txt'), text + '\n');
	}
	written++;
	console.log(`wrote skills/${p.slug}/SKILL.md${p.status === 'soon' ? ' (soon)' : ''}`);
}

// Every skill gets its own copy of the shared check, so each folder installs on its own.
for (const slug of readdirSync(join(root, 'skills'))) {
	mkdirSync(join(root, 'skills', slug, 'scripts'), { recursive: true });
	copyFileSync(join(root, 'shared/check.mjs'), join(root, 'skills', slug, 'scripts/check.mjs'));
}
console.log(`${written} generated, check.mjs copied into every skill.`);
