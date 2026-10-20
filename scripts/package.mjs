import { readFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/core.test.js'], { stdio: 'inherit' });
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
await mkdir('dist', { recursive: true });
const output = resolve(`dist/autotype-${manifest.version}.zip`);
await rm(output, { force: true });
const files = ['manifest.json', 'background.js', 'core.js', 'target.js', 'popup.html', 'popup.css', 'popup.js', ...Object.values(manifest.icons)];
execFileSync('zip', ['-q', output, ...files], { cwd: 'extension' });
execFileSync('unzip', ['-t', output], { stdio: 'inherit' });
console.log(`Packaged ${output}`);
