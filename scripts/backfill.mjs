#!/usr/bin/env node
// Diff a watched document against an older copy from the Internet Archive's Wayback Machine, so the page has
// real changes to show before the monitor has history of its own.
//   node scripts/backfill.mjs cursor-terms 20260101    the archived copy closest to that date
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diff } from '../skills/whatchanged/scripts/diff.mjs';
import { load } from './validate-watch.mjs';
import { extract } from './watch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, when] = process.argv.slice(2);
const entry = load(join(root, 'watch')).find((e) => e.id === id);
if (!entry || !/^\d{8}$/.test(when ?? '')) {
	console.error('Usage: node scripts/backfill.mjs <id> <YYYYMMDD>');
	process.exit(2);
}
const latest = JSON.parse(readFileSync(join(root, 'snapshots', id, 'latest.json'), 'utf8'));
// The archive's index (CDX): the first good capture on or after that date. It is sometimes briefly offline: try three times.
let snap;
for (let i = 0; i < 3 && !snap; i++) {
	const q = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(entry.url)}&from=${when}&limit=1&output=json&filter=statuscode:200`;
	const rows = await fetch(q).then((r) => (r.ok ? r.json() : null)).catch(() => null);
	if (rows?.length > 1) snap = { timestamp: rows[1][1], url: `https://web.archive.org/web/${rows[1][1]}/${rows[1][2]}` };
	else await new Promise((res) => setTimeout(res, 8000));
}
if (!snap) {
	console.log(`✗ ${id}: no archived copy on or after ${when}`);
	process.exit(1);
}
// "id_" asks for the page as it was captured, without the Wayback toolbar.
const raw = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
const old = extract(await (await fetch(raw, { headers: { 'user-agent': 'LastwareWhatChanged/0.1 (+https://github.com/mlgxiii)' } })).text());
const date = `${snap.timestamp.slice(0, 4)}-${snap.timestamp.slice(4, 6)}-${snap.timestamp.slice(6, 8)}`;
const now = readFileSync(join(root, 'snapshots', id, latest.file), 'utf8');
const d = diff(old, now);
const dir = join(root, 'snapshots', id);
writeFileSync(join(dir, `${date}.archive.txt`), old);
if (!d.changes.length) {
	console.log(`= ${id}: no change between ${date} (archive) and ${latest.date}`);
	process.exit(0);
}
mkdirSync(join(root, 'changes', id), { recursive: true });
writeFileSync(join(root, 'changes', id, `${latest.date}.diff.json`), JSON.stringify({ id, from: date, to: latest.date, fromArchive: snap.url, ...d }, null, 2));
console.log(`${d.changes.length ? '!' : '='} ${id}: ${d.changes.length} changed clause(s) between ${date} (archive) and ${latest.date}`);
