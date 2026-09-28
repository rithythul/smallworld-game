// Parses every script the page loads, the way the browser does (classic scripts and ES modules),
// so a typo can never ship a game that does not start. `node --check` alone misses errors in module files.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)src="([^"]+)"/g)].map(m => ({ file: m[2], module: /type="module"/.test(m[1]) }));
scripts.push({ file: 'server.js', module: false });
let bad = 0;
for (const s of scripts) {
  const src = fs.readFileSync(path.join(root, s.file), 'utf8');
  try {
    if (s.module) execFileSync(process.execPath, ['--input-type=module', '--check'], { input: src, stdio: ['pipe', 'pipe', 'pipe'] });
    else new Function(src.replace(/^#!.*\n/, ''));
    console.log('ok  ', s.file);
  } catch (e) {
    bad++; console.log('FAIL', s.file, '\n', String(e.stderr || e.message).split('\n').slice(0, 6).join('\n'));
  }
}
if (!scripts.length) { console.log('FAIL: no scripts found in index.html'); process.exit(1); }
if (bad) process.exit(1);
