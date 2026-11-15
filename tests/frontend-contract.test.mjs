import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('public interest form targets the shared handler and public status is an independent region', async () => {
  const html = await fs.readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /action="\/api\/interest"/);
  assert.match(html, /id="tea-banner"/);
  assert.match(html, /id="directions"/);
  assert.match(html, /13 Computing Drive/);
  assert.match(html, /src="\.\/interest-v2.mjs"/);
  assert.equal(html.includes('data-netlify='), false);
  assert.match(html, /type="password"/);
});
test('service worker bypasses live and private data', async () => {
  const worker = await fs.readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /pathname.startsWith\('\/api\/'\)/);
  assert.match(worker, /request.method !== 'GET'/);
  assert.equal(worker.includes("'./thanks.html'"), false);
});
