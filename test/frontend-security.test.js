const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('renders crawled Markdown as escaped React text instead of injecting HTML', () => {
  const modal = fs.readFileSync(path.join(root, 'dashboard-react/src/shared/components/Modal/index.tsx'), 'utf8');
  const synthesisCards = fs.readFileSync(path.join(root, 'dashboard-react/src/features/synthesis/components/SynthesisCardList/index.tsx'), 'utf8');
  const knowledgeLibrary = fs.readFileSync(path.join(root, 'dashboard-react/src/features/knowledge-library/components/KnowledgeLibraryView/index.tsx'), 'utf8');
  const markdownUtility = fs.readFileSync(path.join(root, 'dashboard-react/src/shared/utils/markdown.ts'), 'utf8');

  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(synthesisCards, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(knowledgeLibrary, /dangerouslySetInnerHTML/);
  assert.match(knowledgeLibrary, /new URL\(value\)\.protocol === 'https:'/);
  assert.doesNotMatch(markdownUtility, /innerHTML|onclick=/);
});
