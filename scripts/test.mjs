// Runs every test's check on its fixtures: fixtures/good.json must pass, fixtures/bad.json must fail,
// and a test with `expect` must print it. Tests without a `check` need a model (npm run try) and are skipped here.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const tests = readdirSync(join(root, 'tests')).flatMap((skill) => readdirSync(join(root, 'tests', skill)).map((t) => join(root, 'tests', skill, t)));
const field = (md, key) => md.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1];
const run = (cmd, cwd) => {
	try {
		return { code: 0, out: execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
	} catch (e) {
		return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
	}
};

let failed = 0;
for (const dir of tests) {
	const md = readFileSync(join(dir, 'TEST.md'), 'utf8');
	const name = `${field(md, 'skill')}/${field(md, 'name')}`;
	const check = field(md, 'check');
	if (!check) {
		console.log(`- ${name}  (needs a model: npm run try)`);
		continue;
	}
	const problems = [];
	const expect = field(md, 'expect');
	if (expect) {
		const r = run(check, dir);
		if (r.code !== 0 || !r.out.includes(expect)) problems.push(`expected output to include ${expect}`);
	} else {
		for (const [file, want] of [['good.json', 0], ['bad.json', 1]]) {
			if (!existsSync(join(dir, 'fixtures', file))) continue;
			const r = run(check.replace('{answer}', `fixtures/${file}`), dir);
			if ((r.code === 0) !== (want === 0)) problems.push(`${file} should ${want ? 'fail' : 'pass'} but ${r.code ? 'failed' : 'passed'}\n${r.out}`);
		}
	}
	console.log(`${problems.length ? '✗' : '✓'} ${name}${problems.length ? `\n  ${problems.join('\n  ')}` : ''}`);
	failed += problems.length ? 1 : 0;
}
console.log(failed ? `\n${failed} test(s) failed.` : '\nAll checks behave.');
process.exit(failed ? 1 : 0);
