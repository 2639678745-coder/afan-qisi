'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../public');

test('all static pages have valid scripts and resolve assets under the repository path', () => {
  const files = fs.readdirSync(root);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('ai-client.js'));
  for (const name of files.filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!code.trim() || /type="(?:importmap|module|application\/json)"/.test(attrs)) continue;
      assert.doesNotThrow(() => new vm.Script(code, { filename: name }));
    }
    for (const [, attr, url] of html.matchAll(/\b(src|href)="([^"]*)"/g)) {
      if (!url || /^(https?:|data:|#)/.test(url) || url.includes('${')) continue;
      // Exclude the escaped example iframe inside treasure's documentation.
      if (url.startsWith('knowledge-treasure-demo')) continue;
      assert.ok(!url.startsWith('/'), `${name}: ${attr} must retain the Pages repository prefix: ${url}`);
      assert.ok(fs.existsSync(path.join(root, url.split(/[?#]/)[0])), `${name}: missing ${url}`);
    }
    assert.doesNotMatch(html, /fetch\(['"]\/api\//, `${name} still needs a local server`);
  }
});
