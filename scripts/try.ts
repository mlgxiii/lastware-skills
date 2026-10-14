// Runs a skill on a real model, the way an agent would, then checks the answer with the skill's own checks.
//   OPENAI_API_KEY=... npm run try                  every pilot skill
//   OPENAI_API_KEY=... npm run try -- howlegacy     one skill
// MODEL=... picks another OpenAI model (default gpt-4.1-mini). Answers are saved to runs/ (git-ignored).
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JS module without types
import { checkQuotes, textsIn, unbacked, unsupportedNumbers } from '../shared/check.mjs';
// @ts-expect-error plain JS module without types
import { diff, verify } from '../skills/whatchanged/scripts/diff.mjs';

const root = join(import.meta.dirname, '..');
const model = openai(process.env.MODEL ?? 'gpt-4.1-mini');
const only = process.argv[2];

const files = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));
const skillOf = (slug: string) => readFileSync(join(root, 'skills', slug, 'SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\n/, '');

type Source = { name: string; text: string };
type Msg = { role: 'user' | 'assistant'; content: string };
const parse = (text: string) => JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));

/** One answer, then one repair round with the check results, as an agent following the skill's step 3 would. */
async function answer(slug: string, task: string, sources: Source[], problems: (json: unknown) => string[]) {
	const system = `${skillOf(slug)}\n\nYou can't run scripts here: you'll be given the check results instead. Reply with the JSON output only, no prose and no code fence.`;
	const messages: Msg[] = [{ role: 'user', content: `${task}\n\n${sources.map((s) => `<file name="${s.name}">\n${s.text}\n</file>`).join('\n\n')}` }];
	const first = await generateText({ model, temperature: 0, system, messages });
	const draft = parse(first.text);
	const found = problems(draft);
	if (!found.length) return { draft, final: draft, repaired: false };
	messages.push({ role: 'assistant', content: first.text }, { role: 'user', content: `The checks failed:\n${found.map((p) => `- ${p}`).join('\n')}\n\nFix every one as the skill says (copy the quote exactly, claim only what a quote of the company's own documents says, or make the line a [gap]) and reply with the full corrected JSON.` });
	const second = await generateText({ model, temperature: 0, system, messages });
	return { draft, final: parse(second.text), repaired: true };
}

/** The same checks as report(), as messages for the model. */
function problemsOf(sources: Source[], terms: string[] = [], own?: string[]) {
	return (json: unknown) => [
		...checkQuotes(json, sources).filter((q: { found: boolean }) => !q.found).map((q: { quote: string }) => `This quote is in no file, word for word: "${q.quote}"`),
		...unsupportedNumbers(textsIn(json).join('\n'), sources.map((s) => s.text).join('\n')).map((n: string) => `This number appears in no file: ${n}`),
		...(terms.length ? unbacked(json, terms, own) : []).map((c: { term: string; text: string }) => `"${c.text}" claims ${c.term}, but none of its quotes from ${own?.join(' or ') ?? 'the files'} says so`)
	];
}

function report(name: string, json: unknown, sources: { name: string; text: string }[], terms: string[] = [], own?: string[]) {
	const quotes = checkQuotes(json, sources);
	const missing = quotes.filter((q: { found: boolean }) => !q.found);
	const numbers = unsupportedNumbers(textsIn(json).join('\n'), sources.map((s) => s.text).join('\n'));
	const claims = terms.length ? unbacked(json, terms, own) : [];
	console.log(`\n${name}`);
	console.log(`  quotes:  ${quotes.length - missing.length}/${quotes.length} found${missing.map((q: { quote: string }) => `\n    ✗ "${q.quote}"`).join('')}`);
	console.log(`  numbers: ${numbers.length ? `✗ ${numbers.join(', ')}` : 'all in the sources'}`);
	if (terms.length) console.log(`  backed:  ${claims.length ? claims.map((c: { text: string }) => `✗ ${c.text}`).join('; ') : `no unbacked claim of ${terms.join(', ')}`}`);
	return !missing.length && !numbers.length && !claims.length;
}

const save = (slug: string, json: unknown, n = '') => {
	mkdirSync(join(root, 'runs'), { recursive: true });
	writeFileSync(join(root, 'runs', `${slug}${n}.json`), JSON.stringify(json, null, 2));
};

const results: Record<string, boolean> = {};

if (!only || only === 'tenderreply') {
	const sources = files(join(root, 'tests/tenderreply/quotes-are-real/fixtures'));
	const own = ['case-studies.txt', 'company.txt'];
	const terms = ['ISO 27001', 'equivalent'];
	const { draft, final: json, repaired } = await answer('tenderreply', 'Answer this tender from our company documents (tender.txt is the tender; the rest are ours).', sources, problemsOf(sources, terms, own));
	save('tenderreply', json);
	if (repaired) { save('tenderreply', draft, '-draft'); report('tenderreply first draft', draft, sources, terms, own); }
	const q3 = json.sections?.find((s: { title: string }) => /Q3/.test(s.title));
	const gap = q3?.lines?.some((l: { gap: string | null; text: string }) => l.gap || /^\[.*\]$/.test(l.text.trim()));
	console.log(`\ntenderreply: ${json.sections?.length} sections, ${json.attach?.length ?? 0} attachments; Q3 leaves a gap for ISO 27001: ${gap ? 'yes' : 'NO'}`);
	results.tenderreply = report(`tenderreply ${repaired ? 'after one repair round' : 'checks'}`, json, sources, terms, own) && !!gap;
}

if (!only || only === 'howlegacy') {
	const sources = files(join(root, 'tests/howlegacy/same-input-same-answer/fixtures'));
	// The skill judges three times and keeps the middle level; same-input-same-answer checks the runs agree.
	const runs = [];
	for (let i = 0; i < 3; i++) {
		const { final: json } = await answer('howlegacy', 'How legacy is ledgerline.example? Give one judgment (this is one of three runs).', sources, problemsOf(sources));
		save('howlegacy', json, `-${i + 1}`);
		runs.push(json);
	}
	const ids = ['screens', 'workflows', 'data', 'people', 'pricing', 'era'];
	const level = (r: any, id: string) => r.signals?.find((s: { id: string }) => s.id === id)?.level ?? 2;
	const scoreOf = (ls: number[]) => Math.round((ls.reduce((a, b) => a + b, 0) / 24) * 100);
	const tier = (s: number) => (s >= 80 ? 'Fossil' : s >= 60 ? 'Legacy' : s >= 40 ? 'Aging' : s >= 20 ? 'Modern' : 'Native');
	const scores = runs.map((r) => scoreOf(ids.map((id) => level(r, id))));
	const spread = Math.max(...ids.map((id) => Math.max(...runs.map((r) => level(r, id))) - Math.min(...runs.map((r) => level(r, id)))));
	const median = ids.map((id) => runs.map((r) => level(r, id)).sort((a, b) => a - b)[1]);
	const final = scoreOf(median);
	console.log(`\nhowlegacy: runs scored ${scores.join(', ')} (${scores.map(tier).join(', ')}); widest signal spread ${spread}; median score ${final} (${tier(final)})`);
	const same = new Set(scores.map(tier)).size === 1 && spread <= 1;
	results.howlegacy = runs.map((r, i) => report(`howlegacy run ${i + 1} checks`, r, sources)).every(Boolean) && same;
}

if (!only || only === 'whatdidwedecide') {
	const sources = files(join(root, 'tests/whatdidwedecide/quotes-are-real/fixtures'));
	const { draft, final: json, repaired } = await answer('whatdidwedecide', 'What did we decide?', sources, problemsOf(sources));
	save('whatdidwedecide', json);
	if (repaired) report('whatdidwedecide first draft', draft, sources);
	console.log(`\nwhatdidwedecide: ${json.items?.length} items: ${json.items?.map((i: { kind: string }) => i.kind).join(', ')}`);
	results.whatdidwedecide = report(`whatdidwedecide ${repaired ? 'after one repair round' : 'checks'}`, json, sources);
}

if (!only || only === 'whatchanged') {
	const dir = join(root, 'tests/whatchanged/no-silent-change/fixtures');
	const oldText = readFileSync(join(dir, 'old.md'), 'utf8');
	const newText = readFileSync(join(dir, 'new.md'), 'utf8');
	// The agent runs diff.mjs (step 2): here the harness runs it and hands over diff.json.
	const d = diff(oldText, newText);
	const check = (json: unknown) => verify(json, oldText, newText).problems.map((p: { test: string; detail: string }) => `${p.test}: ${p.detail}`);
	const { draft, final: json, repaired } = await answer('whatchanged', `What changed in the Northwind Notes terms?\n\ndiff.json:\n${JSON.stringify(d)}`, [], check);
	save('whatchanged', json);
	const first = check(draft), now = check(json);
	console.log(`\nwhatchanged: ${d.changes.length} changes; first draft ${first.length} problem(s)${repaired ? `, after repair ${now.length}` : ''}`);
	for (const p of now) console.log(`  ✗ ${p}`);
	const ai = (json.changes ?? []).find((c: { ids: string[] }) => c.ids?.includes('c3'));
	console.log(`  AI-training change marked high: ${ai?.impact === 'high' ? 'yes' : 'NO'}`);
	results.whatchanged = !now.length && ai?.impact === 'high';
}

console.log(`\n${Object.entries(results).map(([k, ok]) => `${ok ? '✓' : '✗'} ${k}`).join('\n')}`);
process.exitCode = Object.values(results).every(Boolean) ? 0 : 1;
