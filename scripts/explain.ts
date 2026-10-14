// Explain the changes the monitor found, with the whatchanged skill, then check the explanation with the skill's
// own verify and give the model one repair round, as an agent following the skill would.
//   OPENAI_API_KEY=... npm run explain                 every diff without an explanation yet
//   OPENAI_API_KEY=... npm run explain -- github-terms one document
// Writes changes/<id>/<date>.json next to <date>.diff.json, with the check result inside.
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JS module without types
import { diff, verify } from '../skills/whatchanged/scripts/diff.mjs';
// @ts-expect-error plain JS module without types
import { find, prepare } from '../skills/whatchanged/scripts/check.mjs';

const root = join(import.meta.dirname, '..');
const model = openai(process.env.MODEL ?? 'gpt-4.1-mini');
const skill = readFileSync(join(root, 'skills/whatchanged/SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\n/, '');
const only = process.argv[2];
const parse = (t: string) => JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, ''));

type Msg = { role: 'user' | 'assistant'; content: string };

for (const id of readdirSync(join(root, 'changes')).filter((d) => !only || d === only)) {
	for (const file of readdirSync(join(root, 'changes', id)).filter((f) => f.endsWith('.diff.json'))) {
		const out = join(root, 'changes', id, file.replace('.diff.json', '.json'));
		if (existsSync(out) && !process.argv.includes('--force')) continue;
		const d = JSON.parse(readFileSync(join(root, 'changes', id, file), 'utf8'));
		const snaps = join(root, 'snapshots', id);
		const oldFile = readdirSync(snaps).find((f) => f.startsWith(d.from) && f.endsWith('.txt'))!;
		const oldText = readFileSync(join(snaps, oldFile), 'utf8');
		const newText = readFileSync(join(snaps, `${d.to}.txt`), 'utf8');
		const name = JSON.parse(readFileSync(join(root, 'watch', `${id}.json`), 'utf8')).name;

		const system = `${skill}\n\nYou can't run scripts here: diff.json is given, and you'll get the check results. Page menus, footers and cookie text that slipped into the text are "minor" with that reason. Reply with the JSON output only, no prose and no code fence.`;
		const messages: Msg[] = [{ role: 'user', content: `Document: ${name}\nOld version: ${d.from}. New version: ${d.to}.\n\ndiff.json:\n${JSON.stringify(d.changes)}` }];
		let first;
		try {
			first = await generateText({ model, temperature: 0, system, messages, maxRetries: 4 });
		} catch (e) {
			console.log(`✗ ${id}: ${(e as Error).message.split('\n')[0]} (run again to retry)`);
			continue;
		}
		let answer = parse(first.text);
		let result = verify(answer, oldText, newText);
		const draftProblems = result.problems.length;
		// Up to two repair rounds, each with the check results, as the skill's step 4 says.
		let last = first.text;
		for (let round = 0; round < 2 && result.problems.length; round++) {
			messages.push({ role: 'assistant', content: last }, { role: 'user', content: `The checks failed:\n${result.problems.map((p: { test: string; detail: string }) => `- ${p.test}: ${p.detail}`).join('\n')}\n\nFix every one and reply with the full corrected JSON.` });
			last = (await generateText({ model, temperature: 0, system, messages, maxRetries: 4 })).text;
			answer = parse(last);
			result = verify(answer, oldText, newText);
		}
		// A quote that still fails after the repair rounds is replaced by the exact text of the clauses it cites, from
		// the diff: the model's title and explanation stay, the quote becomes the document's own words.
		const byId = new Map(diff(oldText, newText).changes.map((c: { id: string }) => [c.id, c]));
		const oldSrc = prepare(oldText), newSrc = prepare(newText);
		const exact = (ids: string[], side: 'before' | 'after') =>
			ids.map((i) => (byId.get(i) as Record<string, string> | undefined)?.[side] ?? '').filter((t) => t.split(/\s+/).length >= 3).join(' … ');
		let replaced = 0;
		for (const c of answer.changes ?? []) {
			for (const [side, src] of [['before', oldSrc], ['after', newSrc]] as const) {
				if (c[side]?.trim() && !find(c[side], src)) {
					const q = exact(c.ids ?? [], side);
					c[side] = q && find(q, src) ? q : '';
					c.quotedBy = 'monitor';
					replaced++;
				}
			}
		}
		// An item left with no quotable words at all (section letters, numbering) is renumbering, not a change to read.
		const unquotable = (answer.changes ?? []).filter((c: { before?: string; after?: string }) => !c.before?.trim() && !c.after?.trim());
		if (unquotable.length) {
			answer.changes = answer.changes.filter((c: object) => !unquotable.includes(c));
			answer.minor = [...(answer.minor ?? []), ...unquotable.map((c: { ids: string[]; title: string }) => ({ ids: c.ids, why: `${c.title} (numbering only)` }))];
		}
		if (replaced || unquotable.length) result = verify(answer, oldText, newText);
		writeFileSync(out, JSON.stringify({ id, name, from: d.from, to: d.to, fromArchive: d.fromArchive, ...answer, check: { total: result.total, explained: result.explained, minor: result.minor, problems: result.problems, draftProblems, replaced } }, null, 2));
		const high = (answer.changes ?? []).filter((c: { impact: string }) => c.impact === 'high').length;
		console.log(`${result.problems.length ? '✗' : '✓'} ${id}: ${result.total} changes, ${answer.changes?.length ?? 0} that matter (${high} high), ${result.minor} minor; first draft had ${draftProblems} problem(s), ${replaced} quote(s) replaced by the document's own words, now ${result.problems.length}`);
	}
}
