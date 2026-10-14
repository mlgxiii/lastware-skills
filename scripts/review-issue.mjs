#!/usr/bin/env node
// Prints the body of the "please review" issue from data/to-review.json (written by explain.ts).
import { readFileSync } from 'node:fs';
const queue = JSON.parse(readFileSync(new URL('../data/to-review.json', import.meta.url), 'utf8'));
console.log(`New high-impact changes. Their quotes are already on the page; their explanations stay hidden until you review them.

${queue.map((r) => `- **${r.name}** (${r.date}): ${r.titles.join('; ')}\n  Read the explanations in \`${r.file}\` next to their quotes. If they're right, set \`"reviewed": true\` in that file (you can edit it on GitHub) and the next run publishes them.`).join('\n')}
`);
