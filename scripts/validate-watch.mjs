#!/usr/bin/env node
// Checks the watchlist that people extend by pull request. Each document is one file in watch/:
//   { "id": "cursor-terms", "name": "Cursor Terms of Service", "url": "https://…", "kind": "terms" }
//
//   node scripts/validate-watch.mjs              every file in watch/
//   node scripts/validate-watch.mjs list.json    a JSON array of entries (used by the tests)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const KINDS = ['terms', 'privacy', 'ai-policy', 'pricing', 'regulation'];

/** Every entry in a watch/ directory, or in a JSON array file. */
export function load(path) {
	if (statSync(path).isDirectory())
		return readdirSync(path).filter((f) => f.endsWith('.json')).sort().map((f) => ({ ...JSON.parse(readFileSync(join(path, f), 'utf8')), _file: f }));
	return JSON.parse(readFileSync(path, 'utf8'));
}

export function problems(entries) {
	const out = [];
	const seen = new Set();
	for (const e of entries) {
		const at = e._file ?? e.id ?? JSON.stringify(e).slice(0, 40);
		if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id ?? '')) out.push(`${at}: "id" must be lower-case words joined by dashes`);
		if (e._file && e._file !== `${e.id}.json`) out.push(`${at}: the file must be named ${e.id}.json`);
		if (seen.has(e.id)) out.push(`${at}: "${e.id}" is already watched`);
		seen.add(e.id);
		if (!(e.name ?? '').trim()) out.push(`${at}: "name" is missing`);
		if (!KINDS.includes(e.kind)) out.push(`${at}: "kind" must be one of ${KINDS.join(', ')}`);
		let url;
		try { url = new URL(e.url); } catch { out.push(`${at}: "url" is not a valid address`); continue; }
		if (url.protocol !== 'https:') out.push(`${at}: "url" must start with https://`);
		if (/^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) out.push(`${at}: "url" must be a public page`);
	}
	return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const entries = load(process.argv[2] ?? join(import.meta.dirname, '..', 'watch'));
	const found = problems(entries);
	for (const p of found) console.log(`✗ ${p}`);
	console.log(found.length ? `\n${found.length} problem(s).` : `${entries.length} document(s), all valid.`);
	process.exit(found.length ? 1 : 0);
}
