const assert = require('node:assert/strict');
const test = require('node:test');

const { buildKnowledgeLibrary } = require('../knowledge-library');

test('buildKnowledgeLibrary turns sourced crawl questions into a Codex study curriculum', () => {
  const articles = [{
    title: 'React state patterns',
    original_url: 'https://medium.com/example/react-state',
    freedium_url: 'https://freedium-mirror.cfd/https://medium.com/example/react-state',
  }];
  const synthesis = {
    all_questions: [{
      category: 'React',
      company: 'Example Co',
      role: 'Frontend Engineer',
      question: 'When should a reducer manage related state?',
      solution: 'Use a reducer when transitions are related.',
      source_title: 'React state patterns',
      source_url: 'https://medium.com/example/react-state',
    }],
  };

  const library = buildKnowledgeLibrary(articles, synthesis);
  const react = library.categories.find((category) => category.id === 'react');

  assert.equal(library.model, 'Codex-derived from crawled data');
  assert.equal(library.source_count, 1);
  assert.ok(react);
  assert.equal(react.entries[0].title, 'When should a reducer manage related state?');
  assert.equal(react.entries[0].source_url, articles[0].freedium_url);
  assert.match(react.entries[0].code, /Use a reducer/);
});

test('buildKnowledgeLibrary adds clearly labeled Codex drills for sparse interview topics', () => {
  const library = buildKnowledgeLibrary([], { all_questions: [] });
  const algorithms = library.categories.find((category) => category.id === 'algorithms');

  assert.ok(algorithms);
  assert.ok(algorithms.entries.some((entry) => entry.title.includes('LRU Cache')));
  assert.equal(algorithms.entries[0].source_title, 'Codex supplementary drill');
});
