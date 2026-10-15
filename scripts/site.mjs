#!/usr/bin/env node
// WhatChanged's front door: one static page from data/status.json and changes/*/*.json. No dependencies.
//   node scripts/site.mjs   → site/index.html
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './validate-watch.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/mlgxiii/lastware-skills';
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const RANK = { high: 0, medium: 1, low: 2 };
const PAGE = 'https://mlgxiii.github.io/lastware-skills/';
const TOOL = 'https://mlgxiii.vercel.app/p/whatchanged';
/** The document's public page on WhatChanged (same address rule as lastware/src/lib/server/whatchanged.ts docSlug). */
const docPage = (url) => {
	const u = new URL(url);
	return `${TOOL}/t/${`${u.hostname.replace(/^(www|docs)\./, '')}${u.pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)}`;
};

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

const change = (c, pending) => `
<li class="change ${esc(c.impact)}">
  <div class="head"><span class="impact">${esc(c.impact)}</span><h4>${esc(c.title)}</h4>${pending && c.impact === 'high' ? '<span class="pending">Explanation awaiting review</span>' : ''}</div>
  ${pending && c.impact === 'high' ? '' : `<p class="what">${esc(c.what)}</p>`}
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
  ${items.length ? `<ul class="changes">${items.map((c) => change(c, !r.reviewed)).join('')}</ul>` : ''}
  <p class="foot">${items.length ? `<a href="${esc(docPage(r.url))}">Full page and a fresh check on WhatChanged →</a><br>` : ''}<span class="${ok ? 'ok' : 'warn'}">${ok ? '✓ Every change found by code is explained or listed as minor, and every quote is checked against both versions.' : `⚠ ${(r.check?.problems ?? []).length} check(s) failed; read with care.`}</span> Explanations are written by AI${r.reviewed ? ' and reviewed by a person' : ''}; the quotes are the documents' own words.${minor && items.length ? ` ${minor} minor edit${minor === 1 ? '' : 's'} (dates, numbering, menus) not shown.` : ''}</p>
</article>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>Terms of service changes, watched weekly · WhatChanged</title>
<meta name="description" content="What changed this year in the terms of service of Cursor, GitHub, Zoom, Dropbox and more, with the exact words before and after. Open source, updated every Monday.">
<link rel="canonical" href="${PAGE}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lastware">
<meta property="og:title" content="Terms of service changes, watched weekly · WhatChanged">
<meta property="og:description" content="What changed in the terms of service and AI rules behind the tools you use, with the exact words before and after.">
<meta property="og:url" content="${PAGE}">
<meta property="og:image" content="https://mlgxiii.vercel.app/og/whatchanged.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Terms of service changes, watched weekly', url: PAGE, isPartOf: { '@type': 'WebSite', name: 'Lastware', url: 'https://mlgxiii.vercel.app/' }, mainEntity: { '@type': 'ItemList', itemListElement: reports.filter((r) => (r.changes ?? []).length).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `What changed in ${r.name}`, url: docPage(r.url) })) } }).replace(/</g, '\\u003c')}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>
/* Lastware's look (brain/design/guidelines.md): one dark, grainy world; WhatChanged's undertone is Iris (hue 295). */
:root {
  --ground: oklch(0.19 0.016 295); --ground-2: oklch(0.24 0.016 295); --panel: oklch(0.23 0.016 295 / 0.72);
  --fg: oklch(0.95 0.006 295); --muted: oklch(0.72 0.012 295); --hair: oklch(0.95 0.006 295 / 0.1);
  --high: oklch(0.72 0.14 30); --med: oklch(0.82 0.12 85); --ok: oklch(0.78 0.13 155); --accent: oklch(0.86 0.04 295);
  --before: oklch(0.65 0.12 30 / 0.12); --after: oklch(0.7 0.11 155 / 0.12);
  --sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html { background: var(--ground); }
body { margin: 0; color: var(--fg); font: 16px/1.6 var(--sans); min-height: 100vh;
  background: radial-gradient(70rem 50rem at 100% 0%, var(--ground-2), transparent 60%), var(--ground); }
/* Film grain, as on every Lastware page. */
body::before { content: ""; position: fixed; inset: -50%; pointer-events: none; z-index: 0; opacity: .16; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  animation: grain 1.2s steps(6) infinite; }
@keyframes grain { 0%,100% { transform: translate(0,0) } 33% { transform: translate(-2%,1%) } 66% { transform: translate(1%,-2%) } }
@media (prefers-reduced-motion: reduce) { body::before { animation: none; } }
main { position: relative; z-index: 1; max-width: 880px; margin: 0 auto; padding: 56px max(16px, env(safe-area-inset-right)) 72px max(16px, env(safe-area-inset-left)); display: grid; gap: 34px; }
a { color: inherit; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.eyebrow { font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 18px; display: flex; gap: 10px; align-items: center; }
.eyebrow i { width: 8px; height: 8px; border: 1px solid var(--accent); transform: rotate(45deg); display: inline-block; }
h1 { font: 300 clamp(36px, 7vw, 60px)/1.02 var(--sans); letter-spacing: -0.035em; margin: 0; text-wrap: balance; }
.lede { color: var(--muted); font-size: 18px; font-weight: 300; margin: 16px 0 0; max-width: 38em; }
.cta { display: inline-flex; align-items: center; gap: 10px; margin-top: 22px; font: 500 12px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ground); background: var(--fg); border-radius: 3px; padding: 12px 16px; text-decoration: none; }
.cta:hover { background: var(--accent); }
.stats { display: flex; gap: 32px; flex-wrap: wrap; font: 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.stats b { color: var(--fg); font: 300 30px var(--sans); letter-spacing: -0.02em; display: block; text-transform: none; font-variant-numeric: tabular-nums; }
.doc { border-top: 1px solid var(--hair); padding-top: 26px; display: grid; gap: 16px; min-width: 0; }
.doc header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.doc h3 { margin: 0; font: 400 24px/1.25 var(--sans); letter-spacing: -0.015em; }
.doc h3 a { text-decoration: none; }
.dates { margin: 0; font: 11px var(--mono); letter-spacing: .06em; color: var(--muted); font-variant-numeric: tabular-nums; }
.summary { margin: 0; font-size: 20px; font-weight: 300; line-height: 1.45; max-width: 44em; }
.summary.quiet { color: var(--muted); font-size: 16px; }
.changes { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; }
.change { border-left: 1px solid var(--hair); padding: 2px 0 2px 16px; display: grid; gap: 9px; min-width: 0; }
.change.high { border-color: var(--high); } .change.medium { border-color: var(--med); }
.head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.head h4 { margin: 0; font-size: 16px; font-weight: 500; }
.impact { font: 500 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; padding: 3px 8px; border-radius: 99px; border: 1px solid var(--hair); color: var(--muted); }
.high .impact { color: var(--high); border-color: color-mix(in oklab, var(--high) 45%, transparent); }
.medium .impact { color: var(--med); border-color: color-mix(in oklab, var(--med) 45%, transparent); }
.what { margin: 0; color: var(--muted); font-size: 15px; max-width: 46em; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.side { border-radius: 3px; padding: 11px 13px; font-size: 14px; min-width: 0; border: 1px solid var(--hair); }
.before { background: var(--before); } .after { background: var(--after); }
.lab { font: 500 10px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
blockquote { margin: 6px 0 0; line-height: 1.55; overflow-wrap: anywhere; max-height: 14em; overflow: auto; }
.none { margin: 6px 0 0; color: var(--muted); font-style: italic; }
.note { margin: 0; font: 11px/1.6 var(--mono); letter-spacing: .02em; color: var(--muted); }
.pending { font: 500 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border: 1px dashed var(--hair); border-radius: 99px; padding: 3px 8px; }
.foot { margin: 0; font: 11px/1.6 var(--mono); color: var(--muted); }
.ok { color: var(--ok); } .warn { color: var(--high); }
h2 { font: 400 20px var(--sans); letter-spacing: -0.01em; margin: 0 0 12px; }
.list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; font: 12px var(--mono); }
.list li { border: 1px solid var(--hair); border-radius: 3px; padding: 6px 10px; }
.try { border: 1px solid var(--hair); background: var(--panel); border-radius: 3px; padding: 22px; display: grid; gap: 14px; }
.try .inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.try label { display: grid; gap: 6px; font: 500 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.try textarea { width: 100%; min-height: 170px; font: 13px/1.5 var(--sans); color: var(--fg); background: var(--ground); border: 1px solid var(--hair); border-radius: 3px; padding: 10px; resize: vertical; }
.try button { justify-self: start; font: 500 12px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ground); background: var(--fg); border: 0; border-radius: 3px; padding: 12px 16px; cursor: pointer; }
.try button:hover { background: var(--accent); }
.try button:focus-visible, .try textarea:focus-visible, .cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#result:empty { display: none; }
.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; font-size: 14px; color: var(--muted); border-top: 1px solid var(--hair); padding-top: 26px; }
.how b { color: var(--fg); display: block; font-weight: 500; margin-bottom: 4px; }
code { font: 12px var(--mono); border: 1px solid var(--hair); border-radius: 3px; padding: 1px 5px; }
@media (max-width: 640px) { .pair, .how, .try .inputs { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
<header>
  <p class="eyebrow"><i></i>Lastware · WhatChanged · open-source monitor</p>
  <h1>What changed in the terms you agreed to</h1>
  <p class="lede">We watch the terms of service and AI rules behind the tools you use. When one changes, code finds every changed clause and each one is explained with the exact words before and after.</p>
  <a class="cta" href="https://mlgxiii.vercel.app/p/whatchanged">Check any link yourself →</a>
</header>
<div class="stats"><span><b>${watched.length}</b>documents watched</span><span><b>${totals.docs}</b>changed</span><span><b>${totals.high}</b>high-impact changes</span></div>
${reports.map(report).join('')}
${unchanged.length ? `<section><h2>No change</h2><ul class="list">${unchanged.map((e) => `<li><a href="${esc(e.url)}">${esc(e.name)}</a></li>`).join('')}</ul></section>` : ''}
${failing.length ? `<section><h2>Couldn't read</h2><ul class="list">${failing.map((e) => `<li>${esc(e.name)}: ${esc(status[e.id].error)}</li>`).join('')}</ul></section>` : ''}
<section class="try" aria-labelledby="try-h">
  <h2 id="try-h">Compare two versions yourself</h2>
  <p class="note">Paste the old and new text of any terms, contract or policy. The same code as the monitor lists every changed clause. It runs in your browser: nothing is sent anywhere, and no AI is involved.</p>
  <div class="inputs">
    <label for="old">Old version<textarea id="old" spellcheck="false"></textarea></label>
    <label for="new">New version<textarea id="new" spellcheck="false"></textarea></label>
  </div>
  <button type="button" id="compare">Compare</button>
  <div id="result" aria-live="polite"></div>
</section>
<section class="how">
  <div><b>Nothing is skipped.</b>Code compares the two versions clause by clause. Every change is either explained or listed as minor with a reason.</div>
  <div><b>Every quote is real.</b>Each "before" is checked word for word against the old version, each "after" against the new one.</div>
  <div><b>Add a document.</b>Open a pull request adding <code>watch/&lt;id&gt;.json</code> with its name and address. <a href="${REPO}">The code is open source.</a></div>
</section>
<p class="note">This is not legal advice: it shows what changed and what it means in plain words. Older versions come from the Internet Archive's Wayback Machine. The monitor identifies itself and obeys robots.txt. To ask for a document to be removed, <a href="${REPO}/issues">open an issue</a>.</p>
</main>
<script>globalThis.process = { argv: [] };</script>
<script type="importmap">{ "imports": { "node:fs": "./shim.js", "node:path": "./shim.js", "node:url": "./shim.js" } }</script>
<script type="module" src="./compare.js"></script>
</body>
</html>
`;
mkdirSync(join(root, 'site'), { recursive: true });
writeFileSync(join(root, 'site/index.html'), html);
// The compare box runs the skill's own diff in the browser; Node-only imports point to a tiny shim.
copyFileSync(join(root, 'skills/whatchanged/scripts/diff.mjs'), join(root, 'site/diff.mjs'));
copyFileSync(join(root, 'skills/whatchanged/scripts/check.mjs'), join(root, 'site/check.mjs'));
copyFileSync(join(root, 'scripts/site-compare.js'), join(root, 'site/compare.js'));
for (const v of ['old', 'new']) copyFileSync(join(root, `tests/whatchanged/no-silent-change/fixtures/${v}.md`), join(root, `site/example-${v}.txt`));
writeFileSync(join(root, 'site/shim.js'), "export const readFileSync = () => { throw new Error('No files in the browser'); };\nexport const basename = (p) => String(p).split('/').pop();\nexport const pathToFileURL = (p) => new URL('file:///' + p);\n");
console.log(`site/index.html: ${watched.length} watched, ${reports.length} with changes, ${totals.high} high-impact.`);
