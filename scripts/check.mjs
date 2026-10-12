import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
for (const target of Object.values(pkg.exports)) if (!fs.existsSync(path.join(root, target))) throw new Error(`Missing export: ${target}`);
for (const dir of ['src', 'vendor', 'scripts']) for (const name of fs.readdirSync(path.join(root, dir))) if (/\.m?js$/.test(name)) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, dir, name)], { encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr);
}
const client = fs.readFileSync(path.join(root, 'src/client.js'), 'utf8');
if (!client.includes(`id: '${pkg.name}'`) || !client.includes('conversation.input.right')) throw new Error('Client module id or slot mismatch.');
if (/require\(['"]@deepseek-ai\/dsh-client/.test(client)) throw new Error('Client imports an unstable Harness component.');
console.log('Syntax, exports, module id and client dependency checks passed.');
