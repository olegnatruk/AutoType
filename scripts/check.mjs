import { readFile, readdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.minimum_chrome_version, '118');
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'debugger', 'scripting', 'storage'].sort());
assert.ok(!manifest.host_permissions && !manifest.content_scripts);
for (const path of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons)]) await access(join('extension', path));
for (const [size, path] of Object.entries(manifest.icons)) {
  const bytes = await readFile(join('extension', path));
  assert.equal(bytes.readUInt32BE(16), Number(size));
  assert.equal(bytes.readUInt32BE(20), Number(size));
}
async function syntax(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, item.name);
    if (item.isDirectory()) await syntax(path);
    else if (/\.(js|mjs)$/u.test(item.name)) execFileSync(process.execPath, ['--check', path]);
  }
}
await syntax('extension');
await syntax('scripts');
await syntax('tests');
for (const filename of ['popup.html']) {
  const html = await readFile(join('extension', filename), 'utf8');
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
    assert.ok(/\bsrc=/u.test(attributes) && !body.trim(), 'Extension scripts must be external for MV3 CSP');
  }
}
console.log('Manifest, icon dimensions, file references, MV3 script structure, and JavaScript syntax passed.');
