#!/usr/bin/env node
// Checks that keep an answer tied to its sources. No dependencies: plain Node 18+.
// Ported from Lastware's grounding.ts (the same rules the hosted micros use).
//
//   node check.mjs quotes  <answer.json> <source files…>   every "quote" in the answer is in a source, word for word
//   node check.mjs numbers <answer.json|.md> <source files…> numbers in the answer's text that appear in no source
//   node check.mjs backed  <answer.json> <term…> [--in <file…>]
//        a line that names a term must quote it, or be a [gap]. With --in, only quotes from those files count:
//        a tender asking for "ISO 27001" never proves the bidder has it.
//
// Quotes are matched ignoring case, curly quotes, spacing and Markdown. A quote spliced with "…" is checked part by
// part, in order. A list quoted as one sentence (different punctuation, same words in order) also counts.
// Sources are text or Markdown; "[page N]" markers (from a PDF conversion) give the page of each quote.
// Exit code 1 when something doesn't check out, so an agent or a CI job can act on it.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const normalize = (s) => s.toLowerCase().replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const unwrap = (q) => normalize(q).replace(/^["'.…\s]+|["'.…\s]+$/g, '');
export const loose = (s) =>
	normalize(s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*`_#>|]+/g, ' ').replace(/\s+([.,;:!?])/g, '$1'));
const wordsOnly = (s) => s.replace(/\[page (\d+)\]/g, ' pagemark$1 ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const prepare = (text) => {
	const l = loose(text);
	return { loose: l, words: wordsOnly(l) };
};

function at(quote, source) {
	const parts = quote.split(/\.{3}|…/).map((p) => unwrap(loose(p))).filter(Boolean);
	if (!parts.length) return -1;
	if (parts.length > 1 && parts.some((p) => p.split(' ').length < 3)) return -1;
	let from = 0;
	let start = -1;
	for (const p of parts) {
		const i = source.indexOf(p, from);
		if (i < 0) return -1;
		if (start < 0) start = i;
		from = i + p.length;
	}
	return start;
}

const pageAt = (source, index) => {
	const m = [...source.slice(0, index).matchAll(/\[page (\d+)\]/g)].pop();
	return m ? Number(m[1]) : null;
};

/** Where a quote is in a prepared source: { page } (null when the source has no page markers), or undefined. */
export function find(quote, src) {
	const i = at(quote, src.loose);
	if (i >= 0) return { page: pageAt(src.loose, i) };
	const parts = quote.split(/\.{3}|…/).map((p) => wordsOnly(loose(p))).filter(Boolean);
	if (!parts.length || parts.some((p) => p.split(' ').length < (parts.length > 1 ? 3 : 4))) return undefined;
	let from = 0;
	let start = -1;
	for (const p of parts) {
		const j = src.words.indexOf(p, from);
		if (j < 0) return undefined;
		if (start < 0) start = j;
		from = j + p.length;
	}
	const m = [...src.words.slice(0, start).matchAll(/pagemark(\d+)/g)].pop();
	return { page: m ? Number(m[1]) : null };
}

/** Numbers in `text` (outside [placeholders]) that appear in none of `sources`: likely made up. */
export function unsupportedNumbers(text, sources) {
	const outside = text
		.replace(/\[[^\]]*\]/g, ' ')
		.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
		.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(st|nd|rd|th)?\b|\b\d{1,2}(st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, ' ');
	const found = outside.match(/[$€£]?\d[\d,.]*\s?(%|k|m|bn|million|billion|x)?/gi) ?? [];
	const digits = (s) => s.replace(/[^\d.]/g, '').replace(/\.$/, '');
	const src = sources.replace(/(\d),(\d)/g, '$1$2');
	return [...new Set(found.map((n) => n.trim()))].filter((n) => {
		const d = digits(n).replace(/,/g, '');
		if (!d || d.length < 2 || /^(19|20)\d\d$/.test(d)) return false;
		return !src.includes(d);
	});
}

/** Every object with a string "quote" in a JSON value, wherever it is nested. */
export function quotesIn(value, out = []) {
	if (Array.isArray(value)) value.forEach((v) => quotesIn(v, out));
	else if (value && typeof value === 'object') {
		if (typeof value.quote === 'string') out.push(value);
		Object.values(value).forEach((v) => quotesIn(v, out));
	}
	return out;
}

/** Every "text", "finding" or "line" string in a JSON value: the claims to check for numbers. */
export function textsIn(value, out = []) {
	if (Array.isArray(value)) value.forEach((v) => textsIn(v, out));
	else if (value && typeof value === 'object')
		for (const [k, v] of Object.entries(value)) {
			if (typeof v === 'string' && /^(text|finding|line|verdict|answer)$/.test(k)) out.push(v);
			else textsIn(v, out);
		}
	return out;
}

/** Lines (objects with "text") that mention `term` while none of their quotes does, and that aren't gaps. */
export function unbacked(answer, terms, files) {
	const lines = [];
	const walk = (v) => {
		if (Array.isArray(v)) v.forEach(walk);
		else if (v && typeof v === 'object') {
			if (typeof v.text === 'string') lines.push(v);
			Object.values(v).forEach(walk);
		}
	};
	walk(answer);
	return lines.flatMap((l) => {
		if (l.gap || /^\[[^\]]+\]$/.test(l.text.trim())) return [];
		const own = quotesIn(l).filter((q) => !files?.length || files.includes(basename(String(q.file ?? q.source ?? ''))));
		const quotes = loose(own.map((q) => q.quote).join(' '));
		return terms.filter((t) => loose(l.text).includes(loose(t)) && !quotes.includes(loose(t))).map((term) => ({ term, text: l.text }));
	});
}

/** Check every quote of `answer` against `sources` ({ name, text }[]). */
export function checkQuotes(answer, sources) {
	const hay = sources.map((s) => ({ name: s.name, src: prepare(s.text) }));
	return quotesIn(answer)
		.filter((q) => q.quote.trim())
		.map((q) => {
			const named = q.file ?? q.source;
			// The named file first; models mix up files, so any file counts.
			const order = [...hay.filter((h) => named && (h.name === named || h.name === basename(String(named)))), ...hay];
			for (const h of order) {
				const hit = find(q.quote, h.src);
				if (hit) return { quote: q.quote, found: true, file: h.name, page: hit.page };
			}
			return { quote: q.quote, found: false, file: named ?? null, page: null };
		});
}

const read = (path) => ({ name: basename(path), text: readFileSync(path, 'utf8') });

function main([command, answerPath, ...sourcePaths]) {
	if (!['quotes', 'numbers', 'backed'].includes(command) || !answerPath || !sourcePaths.length) {
		console.error('Usage:\n  node check.mjs quotes  <answer.json> <source files…>\n  node check.mjs numbers <answer.json|.md> <source files…>\n  node check.mjs backed  <answer.json> <term…>');
		process.exit(2);
	}
	const raw = readFileSync(answerPath, 'utf8');
	if (command === 'backed') {
		const at = sourcePaths.indexOf('--in');
		const terms = at < 0 ? sourcePaths : sourcePaths.slice(0, at);
		const files = at < 0 ? undefined : sourcePaths.slice(at + 1).map((f) => basename(f));
		const bad = unbacked(JSON.parse(raw), terms, files);
		for (const b of bad) console.log(`✗ "${b.text}" names ${b.term} but no quote of it does`);
		console.log(bad.length ? `\n${bad.length} claim(s) not backed by their quotes.` : `Every line naming ${terms.join(', ')} quotes it${files ? ` from ${files.join(', ')}` : ''} or is a gap.`);
		process.exit(bad.length ? 1 : 0);
	}
	const sources = sourcePaths.map(read);
	if (command === 'quotes') {
		const results = checkQuotes(JSON.parse(raw), sources);
		for (const r of results) console.log(`${r.found ? '✓' : '✗'} "${r.quote}"${r.found ? `  (${r.file}${r.page ? `, page ${r.page}` : ''})` : '  NOT FOUND in any source'}`);
		const bad = results.filter((r) => !r.found).length;
		console.log(`\n${results.length - bad} of ${results.length} quotes found.`);
		process.exit(bad ? 1 : 0);
	}
	let text = raw;
	try {
		text = textsIn(JSON.parse(raw)).join('\n');
	} catch {}
	const missing = unsupportedNumbers(text, sources.map((s) => s.text).join('\n'));
	for (const n of missing) console.log(`✗ ${n}  appears in no source`);
	console.log(missing.length ? `\n${missing.length} number(s) not in the sources.` : 'Every number appears in the sources.');
	process.exit(missing.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
