#!/usr/bin/env node
// WhatChanged's monitor. For every document in watch/: fetch it, keep the main text, save a snapshot when the text
// changes, and diff it against the previous one with the whatchanged skill's own diff. No dependencies.
//
//   node scripts/watch.mjs            check every document
//   node scripts/watch.mjs cursor     check one (by id)
//
// Writes snapshots/<id>/<date>.txt, changes/<id>/<date>.diff.json and data/status.json (read by the page).
// It identifies itself, waits between requests, and skips any page that refuses it.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { diff } from '../skills/whatchanged/scripts/diff.mjs';
import { load } from './validate-watch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'LastwareWhatChanged/0.1 (+https://github.com/mlgxiii)';
const MIN_CHARS = 1500;
const today = new Date().toISOString().slice(0, 10);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£' };
const decode = (s) =>
	s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) =>
		e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m)
	);

/** The readable text of a page: its <main> or <article> when it has one, without scripts, menus and footers. */
export function extract(html) {
	let h = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|svg|template|iframe|form|button)\b[\s\S]*?<\/\1>/gi, '');
	const main = h.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? h.match(/<article\b[^>]*>([\s\S]*)<\/article>/i)?.[1];
	h = main ?? h.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? h;
	h = h.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, '');
	h = h
		.replace(/<h([1-6])\b[^>]*>/gi, (_, n) => `\n\n${'#'.repeat(Number(n))} `)
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<li\b[^>]*>/gi, '\n- ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|section|li|ul|ol|table|tr|blockquote|dd|dt)>/gi, '\n\n')
		// Inline formatting never splits a word; anything else might.
		.replace(/<\/?(a|b|strong|em|i|u|span|code|small|sup|sub|mark|abbr)\b[^>]*>/gi, '')
		.replace(/<[^>]+>/g, ' ');
	return decode(h)
		.split('\n')
		.map((l) => l.replace(/\s+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
const write = (p, data) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };

export async function check(entry, status) {
	const s = (status[entry.id] = { ...status[entry.id], id: entry.id, name: entry.name, url: entry.url, kind: entry.kind, checked: today });
	let res;
	try {
		res = await fetch(entry.url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
	} catch (e) {
		return (s.error = `Couldn't reach it: ${String(e.message ?? e).split('\n')[0]}`), console.log(`✗ ${entry.id}: ${s.error}`);
	}
	if (!res.ok) return (s.error = `The site answered ${res.status}; skipped.`), console.log(`✗ ${entry.id}: ${s.error}`);
	const text = extract(await res.text());
	if (text.length < MIN_CHARS) return (s.error = `Only ${text.length} characters of text: the page probably needs JavaScript.`), console.log(`✗ ${entry.id}: ${s.error}`);
	delete s.error;
	s.chars = text.length;
	const dir = join(root, 'snapshots', entry.id);
	const latest = readJson(join(dir, 'latest.json'), null);
	const hash = sha(text);
	if (latest?.hash === hash) return console.log(`= ${entry.id}: no change since ${latest.date}`);
	write(join(dir, `${today}.txt`), text);
	write(join(dir, 'latest.json'), { hash, date: today, file: `${today}.txt` });
	if (!latest) return (s.since = today), console.log(`+ ${entry.id}: first snapshot (${text.length} characters)`);
	const before = readFileSync(join(dir, latest.file), 'utf8');
	const d = diff(before, text);
	if (!d.changes.length) return console.log(`= ${entry.id}: only formatting changed`);
	write(join(root, 'changes', entry.id, `${today}.diff.json`), { id: entry.id, from: latest.date, to: today, ...d });
	s.changed = today;
	console.log(`! ${entry.id}: ${d.changes.length} changed clause(s) since ${latest.date}`);
}

async function main() {
	const only = process.argv[2];
	const entries = load(join(root, 'watch')).filter((e) => !only || e.id === only);
	const status = readJson(join(root, 'data/status.json'), {});
	for (const [i, entry] of entries.entries()) {
		if (i) await new Promise((r) => setTimeout(r, 2000)); // be polite
		await check(entry, status);
	}
	write(join(root, 'data/status.json'), status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
