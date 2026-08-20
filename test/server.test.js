const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { app, createApp, HOST } = require('../server');

test('binds the production server to localhost by default', () => {
  assert.equal(HOST, '127.0.0.1');
});

test('serves the React application for a direct knowledge-library URL', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/knowledge`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<div id="root"><\/div>/);
});

test('automatically refreshes the Codex study library after a successful crawl', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-crawler-test-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  fs.writeFileSync(path.join(dataDir, 'crawled_posts.json'), JSON.stringify([
    {
      title: 'React state patterns',
      original_url: 'https://medium.com/example/react-state',
      content_markdown: 'Use reducers for complex state transitions.',
    },
  ]));
  fs.writeFileSync(path.join(dataDir, 'synthesized_knowledge.json'), JSON.stringify({
    all_questions: [{
      category: 'React',
      question: 'When should a reducer manage related state?',
      source_title: 'React state patterns',
      source_url: 'https://medium.com/example/react-state',
    }],
  }));

  const testApp = createApp({
    dataDir,
    runCrawler: async () => ({ stdout: 'crawl complete', stderr: '' }),
  });
  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/crawl`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.knowledge.model, 'Codex-derived from crawled data');
  assert.equal(
    result.knowledge.categories[0].entries[0].source_url,
    'https://freedium-mirror.cfd/https://medium.com/example/react-state',
    'study entries link to the Freedium mirror so the article is readable past the paywall'
  );
});

test('rejects a cross-origin crawl request before starting the crawler', async (t) => {
  let wasCalled = false;
  const testApp = createApp({
    runCrawler: async () => {
      wasCalled = true;
      return { stdout: '', stderr: '' };
    },
  });
  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/crawl`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://attacker.example',
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 403);
  assert.equal(wasCalled, false);
});

test('serves a Codex-derived library directly from sourced crawl data without an external AI runner', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medium-crawler-test-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dataDir, 'crawled_posts.json'), JSON.stringify([
    { title: 'React state patterns', original_url: 'https://medium.com/example/react-state' },
  ]));
  fs.writeFileSync(path.join(dataDir, 'synthesized_knowledge.json'), JSON.stringify({
    all_questions: [{
      category: 'React',
      question: 'When should a reducer manage related state?',
      source_title: 'React state patterns',
      source_url: 'https://medium.com/example/react-state',
    }],
  }));

  const server = http.createServer(createApp({ dataDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/knowledge`);
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.knowledge.model, 'Codex-derived from crawled data');
  assert.equal(
    result.knowledge.categories[0].entries[0].source_url,
    'https://freedium-mirror.cfd/https://medium.com/example/react-state',
    'study entries link to the Freedium mirror so the article is readable past the paywall'
  );
});

test('lists the study documents available under the docs directory', async (t) => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-docs-test-'));
  t.after(() => fs.rmSync(docsDir, { recursive: true, force: true }));

  fs.writeFileSync(path.join(docsDir, 'core-insights.md'), '# Core Insights\n\nBody text.');
  fs.mkdirSync(path.join(docsDir, 'answers'));
  fs.writeFileSync(path.join(docsDir, 'answers', '01-javascript.md'), '# Answer Bank 1\n\nBody.');
  fs.writeFileSync(path.join(docsDir, 'notes.txt'), 'should be ignored');

  const server = http.createServer(createApp({ docsDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const payload = await (await fetch(`http://127.0.0.1:${port}/api/docs`)).json();

  assert.equal(payload.success, true);
  const slugs = payload.docs.map((doc) => doc.slug);
  assert.ok(slugs.includes('core-insights'));
  assert.ok(slugs.includes('answers/01-javascript'));
  assert.equal(slugs.some((slug) => slug.includes('notes')), false, 'non-markdown files are excluded');

  const root = payload.docs.find((doc) => doc.slug === 'core-insights');
  assert.equal(root.title, 'Core Insights', 'title comes from the first heading');
});

test('returns the markdown body for a known document slug', async (t) => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-docs-test-'));
  t.after(() => fs.rmSync(docsDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(docsDir, 'answers'));
  fs.writeFileSync(path.join(docsDir, 'answers', '01-javascript.md'), '# Answer Bank 1\n\nEvent loop.');

  const server = http.createServer(createApp({ docsDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const payload = await (await fetch(`http://127.0.0.1:${port}/api/docs/answers/01-javascript`)).json();

  assert.equal(payload.success, true);
  assert.equal(payload.doc.title, 'Answer Bank 1');
  assert.match(payload.doc.markdown, /Event loop\./);
});

test('refuses to serve files outside the docs directory', async (t) => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-docs-test-'));
  t.after(() => fs.rmSync(docsDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(docsDir, 'safe.md'), '# Safe');

  const secretPath = path.join(docsDir, '..', 'atlas-secret.md');
  fs.writeFileSync(secretPath, '# Secret');
  t.after(() => fs.rmSync(secretPath, { force: true }));

  const server = http.createServer(createApp({ docsDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const traversals = [
    '/api/docs/../atlas-secret',
    '/api/docs/..%2Fatlas-secret',
    '/api/docs/%2e%2e%2fatlas-secret',
    '/api/docs/....//atlas-secret',
  ];

  for (const attempt of traversals) {
    const response = await fetch(`http://127.0.0.1:${port}${attempt}`, { redirect: 'manual' });
    const body = await response.text();
    assert.equal(response.status >= 400, true, `${attempt} must not resolve to a document`);
    assert.equal(body.includes('Secret'), false, `${attempt} leaked file contents`);
  }
});

test('returns 404 for an unknown document slug', async (t) => {
  const docsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-docs-test-'));
  t.after(() => fs.rmSync(docsDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(docsDir, 'safe.md'), '# Safe');

  const server = http.createServer(createApp({ docsDir }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/docs/nope`);
  assert.equal(response.status, 404);
});

test('serves the repository study documents through the default docs directory', async (t) => {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const index = await (await fetch(`http://127.0.0.1:${port}/api/docs`)).json();

  assert.equal(index.success, true);
  const slugs = index.docs.map((doc) => doc.slug);
  for (const expected of [
    'frontend-react-insights',
    'frontend-knowledge-map',
    'core-insights',
    'answers/01-javascript',
    'answers/12-production',
    'answers/15-typescript',
    'answers/19-state-machines',
  ]) {
    assert.ok(slugs.includes(expected), `expected ${expected} in the document index`);
  }

  // Curated reading order puts the corpus analysis before the knowledge map.
  assert.ok(
    slugs.indexOf('frontend-react-insights') < slugs.indexOf('frontend-knowledge-map'),
    'documents follow the curated reading order'
  );
  // Nested answer-bank documents sort after the root overview documents.
  assert.ok(
    slugs.indexOf('core-insights') < slugs.indexOf('answers/01-javascript'),
    'root documents come before grouped documents'
  );

  const detail = await (await fetch(`http://127.0.0.1:${port}/api/docs/answers/11-security`)).json();
  assert.equal(detail.success, true);
  assert.equal(detail.doc.group, 'answers');
  assert.match(detail.doc.markdown, /same-origin policy/i);
});
