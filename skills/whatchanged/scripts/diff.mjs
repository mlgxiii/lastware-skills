#!/usr/bin/env node
// Every clause that changed between two versions of a document, found by code, not by a model, so none can be
// skipped. No dependencies: plain Node 18+.
//
//   node diff.mjs old.txt new.txt > diff.json          the changes, each with an id (c1, c2…)
//   node diff.mjs verify answer.json old.txt new.txt [--only <test>]   check an explanation of those changes:
//        no-silent-change    every change id is explained in "changes" or declared in "minor" with a reason
//        no-invented-change  every id the answer cites exists
//        quotes-are-real     every "before" is in the old version and every "after" in the new one, word for word
//        numbers             every number in the explanation appears in one of the versions
// Exit code 1 when something doesn't check out.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { find, loose, prepare, unsupportedNumbers } from './check.mjs';

/** Split a document into clauses: one per sentence, remembering the heading each sits under. */
export function clauses(text) {
	const out = [];
	let section = '';
	for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
		const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
		if (!lines.length) continue;
		// A heading: Markdown "#", or a short line without final punctuation followed by nothing else.
		if (/^#{1,6}\s/.test(lines[0]) || (lines.length === 1 && lines[0].length < 80 && !/[.!?:;]$/.test(lines[0]))) {
			section = lines[0].replace(/^#{1,6}\s*/, '');
			// Headings are clauses too: a renamed section or a new "Last updated" date is a change.
			out.push({ section, text: section, key: loose(section) });
			lines.shift();
			if (!lines.length) continue;
		}
		const para = lines.join(' ');
		for (const s of para.split(/(?<=[.!?;])\s+(?=["“(]?[A-Z0-9])/)) if (s.trim()) out.push({ section, text: s.trim(), key: loose(s) });
	}
	return out;
}

const words = (s) => new Set(s.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
function similarity(a, b) {
	const x = words(a), y = words(b);
	let common = 0;
	for (const w of x) if (y.has(w)) common++;
	return common / Math.max(1, Math.max(x.size, y.size));
}

/** Longest common subsequence over clause keys, after trimming the identical start and end. */
function align(a, b) {
	let start = 0;
	while (start < a.length && start < b.length && a[start].key === b[start].key) start++;
	let endA = a.length, endB = b.length;
	while (endA > start && endB > start && a[endA - 1].key === b[endB - 1].key) endA--, endB--;
	const A = a.slice(start, endA), B = b.slice(start, endB);
	const n = A.length, m = B.length;
	const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i].key === B[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
	const ops = [];
	let i = 0, j = 0;
	while (i < n || j < m) {
		if (i < n && j < m && A[i].key === B[j].key) ops.push({ op: 'same' }), i++, j++;
		else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) ops.push({ op: 'add', b: B[j++] });
		else ops.push({ op: 'del', a: A[i++] });
	}
	return ops;
}

/** The changes between two texts: changed (a clause rewritten), added or removed. */
export function diff(oldText, newText) {
	const ops = align(clauses(oldText), clauses(newText));
	const changes = [];
	// Within each run of removals and additions, pair a removed clause with the most similar added one.
	for (let k = 0; k < ops.length; ) {
		if (ops[k].op === 'same') { k++; continue; }
		const dels = [], adds = [];
		while (k < ops.length && ops[k].op !== 'same') (ops[k].op === 'del' ? dels : adds).push(ops[k].op === 'del' ? ops[k].a : ops[k].b), k++;
		const used = new Set();
		for (const d of dels) {
			let best = -1, score = 0.5;
			adds.forEach((a, idx) => { const s = similarity(d.key, a.key); if (!used.has(idx) && s >= score) (best = idx), (score = s); });
			if (best >= 0) used.add(best), changes.push({ kind: 'changed', section: adds[best].section || d.section, before: d.text, after: adds[best].text });
			else changes.push({ kind: 'removed', section: d.section, before: d.text, after: '' });
		}
		adds.forEach((a, idx) => { if (!used.has(idx)) changes.push({ kind: 'added', section: a.section, before: '', after: a.text }); });
	}
	return { changes: changes.map((c, n) => ({ id: `c${n + 1}`, ...c })) };
}

/** Where a quote stops matching the source: the last words that match, so a fix can start there. */
function divergence(quote, src) {
	const q = loose(quote);
	let lo = 0, hi = q.length;
	while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (src.loose.includes(q.slice(0, mid))) lo = mid; else hi = mid - 1; }
	return lo < 20 ? 'it matches nowhere' : `it matches up to "…${q.slice(Math.max(0, lo - 40), lo)}", then differs`;
}

/** Check an explanation of the changes against the two versions. */
export function verify(answer, oldText, newText) {
	const { changes } = diff(oldText, newText);
	const ids = new Set(changes.map((c) => c.id));
	const explained = (answer.changes ?? []).flatMap((c) => c.ids ?? []);
	const minor = (answer.minor ?? []).filter((m) => (m.why ?? '').trim()).flatMap((m) => m.ids ?? []);
	const covered = new Set([...explained, ...minor]);
	const oldSrc = prepare(oldText), newSrc = prepare(newText);
	const problems = [];
	for (const c of changes) if (!covered.has(c.id)) problems.push({ test: 'no-silent-change', detail: `${c.id} (${c.kind}${c.section ? `, ${c.section}` : ''}) is not explained: "${(c.after || c.before).slice(0, 90)}"` });
	for (const id of [...explained, ...(answer.minor ?? []).flatMap((m) => m.ids ?? [])]) if (!ids.has(id)) problems.push({ test: 'no-invented-change', detail: `${id} is not a change between these versions` });
	for (const m of answer.minor ?? []) if (!(m.why ?? '').trim()) problems.push({ test: 'no-silent-change', detail: `minor ${(m.ids ?? []).join(', ')} gives no reason` });
	for (const c of answer.changes ?? []) {
		if (c.before?.trim() && !find(c.before, oldSrc)) problems.push({ test: 'quotes-are-real', detail: `"before" of "${c.title ?? c.ids}" is not in the old version: ${divergence(c.before, oldSrc)}` });
		if (c.after?.trim() && !find(c.after, newSrc)) problems.push({ test: 'quotes-are-real', detail: `"after" of "${c.title ?? c.ids}" is not in the new version: ${divergence(c.after, newSrc)}` });
		if (!c.before?.trim() && !c.after?.trim()) problems.push({ test: 'quotes-are-real', detail: `"${c.title ?? c.ids}" quotes neither version` });
	}
	const text = (answer.changes ?? []).map((c) => [c.title, c.what].join(' ')).join('\n') + '\n' + (answer.summary ?? '');
	for (const n of unsupportedNumbers(text, `${oldText}\n${newText}`)) problems.push({ test: 'numbers', detail: `${n} appears in neither version` });
	return { total: changes.length, explained: new Set(explained).size, minor: new Set(minor).size, problems };
}

function main([cmd, ...args]) {
	const read = (p) => readFileSync(p, 'utf8');
	const at = args.indexOf('--only');
	const only = at >= 0 ? args.splice(at, 2)[1] : undefined;
	if (cmd === 'verify' && args.length === 3) {
		const r = verify(JSON.parse(read(args[0])), read(args[1]), read(args[2]));
		if (only) r.problems = r.problems.filter((p) => p.test === only);
		for (const p of r.problems) console.log(`✗ ${p.test}: ${p.detail}`);
		console.log(`\n${r.total} changes: ${r.explained} explained, ${r.minor} declared minor. ${r.problems.length ? `${r.problems.length} problem(s).` : 'Everything checks out.'}`);
		process.exit(r.problems.length ? 1 : 0);
	}
	if (cmd && args.length === 1 && cmd !== 'verify') {
		console.log(JSON.stringify(diff(read(cmd), read(args[0])), null, 2));
		return;
	}
	console.error('Usage:\n  node diff.mjs <old> <new> > diff.json\n  node diff.mjs verify <answer.json> <old> <new> [--only no-silent-change|no-invented-change|quotes-are-real|numbers]');
	process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
