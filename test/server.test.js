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
  assert.equal(result.knowledge.categories[0].entries[0].source_url, 'https://medium.com/example/react-state');
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
  assert.equal(result.knowledge.categories[0].entries[0].source_url, 'https://medium.com/example/react-state');
});
