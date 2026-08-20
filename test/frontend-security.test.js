const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('renders crawled Markdown as escaped React text instead of injecting HTML', () => {
  const modal = fs.readFileSync(path.join(root, 'dashboard-react/src/shared/components/Modal/index.tsx'), 'utf8');
  const markdownRenderer = fs.readFileSync(path.join(root, 'dashboard-react/src/shared/components/Markdown/MarkdownRenderer.tsx'), 'utf8');
  const docsView = fs.readFileSync(path.join(root, 'dashboard-react/src/features/docs/components/DocsView/index.tsx'), 'utf8');
  const markdownUtility = fs.readFileSync(path.join(root, 'dashboard-react/src/shared/utils/markdown.ts'), 'utf8');

  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(markdownRenderer, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(docsView, /dangerouslySetInnerHTML/);
  assert.match(markdownUtility, /safeUrl/);
  assert.match(markdownUtility, /SAFE_PROTOCOLS/);
  assert.doesNotMatch(markdownUtility, /innerHTML|onclick=/);
});

