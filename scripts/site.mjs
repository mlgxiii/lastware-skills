#!/usr/bin/env node
// WhatChanged's front door: one static page from data/status.json and changes/*/*.json. No dependencies.
//   node scripts/site.mjs   → site/index.html
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './validate-watch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/mlgxiii/lastware-skills';
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const RANK = { high: 0, medium: 1, low: 2 };

const status = existsSync(join(root, 'data/status.json')) ? JSON.parse(readFileSync(join(root, 'data/status.json'), 'utf8')) : {};
const watched = load(join(root, 'watch'));
const reports = [];
for (const e of watched) {
	const dir = join(root, 'changes', e.id);
	if (!existsSync(dir)) continue;
	const latest = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
	if (latest) reports.push({ ...JSON.parse(readFileSync(join(dir, latest), 'utf8')), url: e.url });
}
// Documents with high-impact changes first, then by how much changed.
const score = (r) => (r.changes ?? []).reduce((s, c) => s + (c.impact === 'high' ? 100 : c.impact === 'medium' ? 10 : 1), 0);
reports.sort((a, b) => score(b) - score(a));
const unchanged = watched.filter((e) => !reports.some((r) => r.id === e.id) && !status[e.id]?.error);
const failing = watched.filter((e) => status[e.id]?.error);
const totals = reports.reduce((t, r) => ({ docs: t.docs + ((r.changes ?? []).length ? 1 : 0), high: t.high + (r.changes ?? []).filter((c) => c.impact === 'high').length }), { docs: 0, high: 0 });

const change = (c) => `
<li class="change ${esc(c.impact)}">
  <div class="head"><span class="impact">${esc(c.impact)}</span><h4>${esc(c.title)}</h4></div>
  <p class="what">${esc(c.what)}</p>
  <div class="pair">
    <div class="side before"><span class="lab">Before</span>${c.before ? `<blockquote>${esc(c.before)}</blockquote>` : '<p class="none">Not in the old version.</p>'}</div>
    <div class="side after"><span class="lab">After</span>${c.after ? `<blockquote>${esc(c.after)}</blockquote>` : '<p class="none">Removed.</p>'}</div>
  </div>
  ${c.quotedBy === 'monitor' ? '<p class="note">Quote taken word for word from the document by the monitor.</p>' : ''}
</li>`;

const report = (r) => {
	const items = [...(r.changes ?? [])].sort((a, b) => (RANK[a.impact] ?? 3) - (RANK[b.impact] ?? 3));
	const minor = (r.minor ?? []).length;
	const ok = !(r.check?.problems ?? []).length;
	return `
<article class="doc" id="${esc(r.id)}">
  <header>
    <h3><a href="${esc(r.url)}">${esc(r.name)}</a></h3>
    <p class="dates">${r.fromArchive ? `<a href="${esc(r.fromArchive)}">${fmt(r.from)} (archived copy)</a>` : fmt(r.from)} → ${fmt(r.to)}</p>
  </header>
  ${items.length ? `<p class="summary">${esc(r.summary)}</p>` : `<p class="summary quiet">Nothing that changes your rights: ${minor} small edit${minor === 1 ? '' : 's'} to the page (menus, numbering, wording).</p>`}
  ${items.length ? `<ul class="changes">${items.map(change).join('')}</ul>` : ''}
  <p class="foot"><span class="${ok ? 'ok' : 'warn'}">${ok ? '✓ Every change found by code is explained or listed as minor, and every quote is checked against both versions.' : `⚠ ${(r.check?.problems ?? []).length} check(s) failed; read with care.`}</span>${minor && items.length ? ` ${minor} minor edit${minor === 1 ? '' : 's'} (dates, numbering, menus) not shown.` : ''}</p>
</article>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>WhatChanged</title>
<meta name="description" content="What changed in the terms of service and AI rules you agreed to, with the exact words before and after.">
<style>
:root {
  --bg: #f6f5f1; --card: #ffffff; --fg: #1b1c1f; --muted: #62646b; --hair: #e4e2db;
  --high: #c2410c; --high-bg: #fff1e8; --med: #a16207; --med-bg: #fdf6e3; --low: #4b5563; --low-bg: #f1f2f4;
  --before: #fdecec; --after: #e9f6ee; --accent: #1d4ed8; --ok: #15803d;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --serif: "Iowan Old Style", "Charter", Georgia, serif;
}
@media (prefers-color-scheme: dark) { :root { --bg: #121315; --card: #1b1c1f; --fg: #ececee; --muted: #a1a3a9; --hair: #2c2e33;
  --high: #fb923c; --high-bg: #2a1a10; --med: #facc15; --med-bg: #29230d; --low: #9ca3af; --low-bg: #23252a;
  --before: #2a1717; --after: #12261a; --accent: #8ab4ff; --ok: #4ade80; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 var(--sans); }
main { max-width: 860px; margin: 0 auto; padding: 40px max(16px, env(safe-area-inset-right)) 64px max(16px, env(safe-area-inset-left)); display: grid; gap: 28px; }
a { color: var(--accent); }
h1 { font: 700 clamp(30px, 6vw, 44px)/1.05 var(--serif); letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
.lede { color: var(--muted); font-size: 18px; margin: 10px 0 0; max-width: 40em; }
.stats { display: flex; gap: 18px; flex-wrap: wrap; font-size: 14px; color: var(--muted); }
.stats b { color: var(--fg); font-size: 20px; display: block; font-variant-numeric: tabular-nums; }
.doc { background: var(--card); border: 1px solid var(--hair); border-radius: 14px; padding: 22px; display: grid; gap: 14px; min-width: 0; }
.doc header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.doc h3 { margin: 0; font: 600 21px/1.25 var(--serif); }
.doc h3 a { color: inherit; text-decoration: none; }
.dates { margin: 0; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.dates a { color: inherit; }
.summary { margin: 0; font-size: 17px; }
.summary.quiet { color: var(--muted); font-size: 15px; }
.changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.change { border-left: 3px solid var(--low); padding: 2px 0 2px 14px; display: grid; gap: 8px; min-width: 0; }
.change.high { border-color: var(--high); } .change.medium { border-color: var(--med); }
.head { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.head h4 { margin: 0; font-size: 16px; }
.impact { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; background: var(--low-bg); color: var(--low); }
.high .impact { background: var(--high-bg); color: var(--high); } .medium .impact { background: var(--med-bg); color: var(--med); }
.what { margin: 0; color: var(--muted); font-size: 15px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.side { border-radius: 8px; padding: 10px 12px; font-size: 14px; min-width: 0; }
.before { background: var(--before); } .after { background: var(--after); }
.lab { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
blockquote { margin: 4px 0 0; font-family: var(--serif); overflow-wrap: anywhere; max-height: 14em; overflow: auto; }
.none { margin: 4px 0 0; color: var(--muted); font-style: italic; }
.note { margin: 0; font-size: 12px; color: var(--muted); }
.foot { margin: 0; font-size: 13px; color: var(--muted); border-top: 1px solid var(--hair); padding-top: 10px; }
.ok { color: var(--ok); } .warn { color: var(--high); }
.list { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; padding: 0; list-style: none; font-size: 14px; }
.list li { background: var(--card); border: 1px solid var(--hair); border-radius: 99px; padding: 4px 12px; }
.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; font-size: 14px; color: var(--muted); }
.how b { color: var(--fg); display: block; }
h2 { font: 600 20px var(--serif); margin: 0; }
code { font-size: 13px; background: var(--card); border: 1px solid var(--hair); border-radius: 5px; padding: 1px 5px; }
@media (max-width: 640px) { .pair, .how { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
<header>
  <h1>What changed in the terms you agreed to</h1>
  <p class="lede">We watch the terms of service and AI rules behind the tools you use. When one changes, code finds every changed clause and each one is explained with the exact words before and after.</p>
</header>
<div class="stats"><span><b>${watched.length}</b>documents watched</span><span><b>${totals.docs}</b>changed</span><span><b>${totals.high}</b>high-impact changes</span></div>
${reports.map(report).join('')}
${unchanged.length ? `<section><h2>No change</h2><ul class="list">${unchanged.map((e) => `<li><a href="${esc(e.url)}">${esc(e.name)}</a></li>`).join('')}</ul></section>` : ''}
${failing.length ? `<section><h2>Couldn't read</h2><ul class="list">${failing.map((e) => `<li>${esc(e.name)}: ${esc(status[e.id].error)}</li>`).join('')}</ul></section>` : ''}
<section class="how">
  <div><b>Nothing is skipped.</b>Code compares the two versions clause by clause. Every change is either explained or listed as minor with a reason.</div>
  <div><b>Every quote is real.</b>Each "before" is checked word for word against the old version, each "after" against the new one.</div>
  <div><b>Add a document.</b>Open a pull request adding <code>watch/&lt;id&gt;.json</code> with its name and address. <a href="${REPO}">The code is open source.</a></div>
</section>
<p class="note">This is not legal advice: it shows what changed and what it means in plain words. Older versions come from the Internet Archive's Wayback Machine.</p>
</main>
</body>
</html>
`;
mkdirSync(join(root, 'site'), { recursive: true });
writeFileSync(join(root, 'site/index.html'), html);
console.log(`site/index.html: ${watched.length} watched, ${reports.length} with changes, ${totals.high} high-impact.`);
