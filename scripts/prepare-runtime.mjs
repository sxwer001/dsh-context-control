import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Read the installed official distribution for isolated tests; never write to it.
const archive = process.argv.slice(2).find(value => !value.startsWith('--')) || 'D:/deepseekharness/resources/app.asar';
const out = path.resolve(import.meta.dirname, '..', '.test-runtime', 'node_modules');
const fd = fs.openSync(archive, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, head.length, 0);
const offset = 8 + head.readUInt32LE(4);
const json = Buffer.alloc(head.readUInt32LE(12));
fs.readSync(fd, json, 0, json.length, 16);
const tree = JSON.parse(json.toString());
function nodeAt(name) { return name.split('/').reduce((node, part) => node?.files?.[part], tree); }
function read(name) {
  const node = nodeAt(name);
  if (!node || node.files) throw new Error(`Archive file missing: ${name}`);
  if (node.unpacked) return fs.readFileSync(archive + '.unpacked/' + name);
  const bytes = Buffer.alloc(Number(node.size));
  fs.readSync(fd, bytes, 0, bytes.length, offset + Number(node.offset));
  return bytes;
}
const prefix = 'dsh/node_modules/';
const queue = ['@deepseek-ai/dsh-compaction-basic', '@deepseek-ai/dsh-agent-loop', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-session-projection', '@deepseek-ai/dsh-token-meter', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-storage', '@deepseek-ai/dsh-storage-local', '@deepseek-ai/dsh-host-webserver'];
if (process.argv.includes('--include-cli')) queue.push('@deepseek-ai/dsh', '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app');
const seen = new Set();
function copy(node, relative, name) {
  if (node.files) { for (const [part, child] of Object.entries(node.files)) copy(child, relative + '/' + part, name); return; }
  if (!process.argv.includes('--include-cli') && !/\.(js|cjs|mjs|json|node|wasm|ya?ml|md|html|css|svg|png|jpe?g|webp|ico|woff2?|ttf)$/.test(relative)) return;
  const target = path.join(out, name, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const data = read(prefix + name + '/' + relative);
  fs.writeFileSync(target, data);
  if (path.basename(relative) === 'package.json') {
    const manifest = JSON.parse(data);
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies })) if (nodeAt(prefix + dependency)) queue.push(dependency);
  }
}
try {
  if (JSON.parse(read(prefix + '@deepseek-ai/dsh-compaction-basic/package.json')).version !== '0.2.0-rc.2') throw new Error('The adapter targets 0.2.0-rc.2. Revalidate before preparing a different runtime.');
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = nodeAt(prefix + name);
    if (!dir) { console.warn(`Not shipped: ${name}`); continue; }
    const manifest = JSON.parse(read(prefix + name + '/package.json'));
    for (const [part, child] of Object.entries(dir.files)) copy(child, part, name);
    for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies })) if (nodeAt(prefix + dependency)) queue.push(dependency);
  }
  const original = read(prefix + '@deepseek-ai/dsh-compaction-basic/lib/index.js');
  const vendored = Buffer.from(original.toString().replace('export { BasicCompactionEngine, BasicCompactionEngine as default };', 'export { BasicCompactionEngine, BasicCompactionEngine as default, selectCompactableRange, compactSurfaceRegion, frameSummary, finishError };'));
  fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'vendor', 'basic-engine.js'), vendored);
  fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'vendor', 'upstream.json'), JSON.stringify({ package: '@deepseek-ai/dsh-compaction-basic', version: JSON.parse(read(prefix + '@deepseek-ai/dsh-compaction-basic/package.json')).version, sourceSha256: crypto.createHash('sha256').update(original).digest('hex'), changes: ['Expose existing transaction and selection helpers for the adapter. No changes to upstream transaction logic.'] }, null, 2) + '\n');
  // Link only the task-owned package resolver; the user profile is untouched.
  const link = path.resolve(import.meta.dirname, '..', 'node_modules');
  if (!fs.existsSync(link)) fs.symlinkSync(out, link, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`Prepared ${seen.size} package names from installed DSH; all copies live in .test-runtime.`);
} finally { fs.closeSync(fd); }
