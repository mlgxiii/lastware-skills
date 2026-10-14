#!/usr/bin/env node
// HowLegacy's score: arithmetic over the six signal levels, never the model's opinion.
//   node score.mjs screens=3 workflows=4 data=2 people=1 pricing=4 era=3
//   node score.mjs check.json        (a JSON with "signals": [{ "id", "level" }])
// Each level is 0 (built for now) to 4 (fully the old way); a missing signal counts as 2 (no evidence either way).
import { readFileSync } from 'node:fs';

const SIGNALS = ['screens', 'workflows', 'data', 'people', 'pricing', 'era'];
const TIERS = [
	[80, 'Fossil', 'Built for a world before the cloud, and still sold that way.'],
	[60, 'Legacy', 'The old constraints still set how it’s bought, set up and used.'],
	[40, 'Aging', 'Modern in places, old where it counts.'],
	[20, 'Modern', 'Mostly self-serve and open, with a few old habits.'],
	[0, 'Native', 'Built for how software works now.']
];

const args = process.argv.slice(2);
let levels = {};
if (args.length === 1 && args[0].endsWith('.json')) {
	for (const s of JSON.parse(readFileSync(args[0], 'utf8')).signals ?? []) levels[s.id] = s.level;
} else {
	levels = Object.fromEntries(args.map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]));
}
const unknown = Object.keys(levels).filter((k) => !SIGNALS.includes(k));
const bad = Object.entries(levels).filter(([, v]) => !Number.isInteger(v) || v < 0 || v > 4);
if (unknown.length || bad.length) {
	console.error(`Signals are ${SIGNALS.join(', ')}, each an integer 0–4.${unknown.length ? ` Unknown: ${unknown.join(', ')}.` : ''}${bad.length ? ` Out of range: ${bad.map(([k]) => k).join(', ')}.` : ''}`);
	process.exit(2);
}
const used = SIGNALS.map((s) => levels[s] ?? 2);
const score = Math.round((used.reduce((a, b) => a + b, 0) / (SIGNALS.length * 4)) * 100);
const [, tier, line] = TIERS.find(([min]) => score >= min);
console.log(JSON.stringify({ score, tier, line, levels: Object.fromEntries(SIGNALS.map((s, i) => [s, used[i]])) }, null, 2));
