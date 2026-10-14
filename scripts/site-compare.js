// The page's "Compare two versions" box: the whatchanged skill's own diff, run in the browser. No AI, nothing sent.
import { diff } from './diff.mjs';

const $ = (id) => document.getElementById(id);
const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const side = (label, text, empty) =>
	`<div class="side ${label.toLowerCase()}"><span class="lab">${label}</span>${text ? `<blockquote>${esc(text)}</blockquote>` : `<p class="none">${empty}</p>`}</div>`;

function render() {
	const { changes } = diff($('old').value, $('new').value);
	$('result').innerHTML = !changes.length
		? '<p class="summary quiet">No change between the two versions.</p>'
		: `<p class="summary">${changes.length} changed clause${changes.length === 1 ? '' : 's'}:</p><ul class="changes">` +
			changes
				.map((c) => `<li class="change"><div class="head"><span class="impact">${c.kind}</span><h4>${esc(c.section || 'Untitled section')}</h4></div><div class="pair">${side('Before', c.before, 'Not in the old version.')}${side('After', c.after, 'Removed.')}</div></li>`)
				.join('') +
			'</ul><p class="note">To have each change explained with its impact, use the whatchanged skill in your agent.</p>';
}

// Start with an example, so the box shows what it does.
const [oldText, newText] = await Promise.all(['old', 'new'].map((v) => fetch(`./example-${v}.txt`).then((r) => (r.ok ? r.text() : ''))));
$('old').value = oldText;
$('new').value = newText;
$('compare').addEventListener('click', render);
