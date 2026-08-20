const CATEGORY_DEFINITIONS = [
  {
    sourceCategory: 'React',
    id: 'react',
    title: 'React',
    summary: 'State modeling, rendering, effects, component architecture, and performance trade-offs for frontend interviews.',
    takeaways: [
      'Explain the state model before writing a component: source of truth, transitions, and derived values.',
      'For every effect, be ready to explain dependencies, cleanup, and how stale work is cancelled.',
      'Treat memoization as a measured trade-off, not a default optimization.',
    ],
  },
  {
    sourceCategory: 'JavaScript (Core)',
    id: 'javascript',
    title: 'JavaScript',
    summary: 'Language fundamentals that repeatedly appear in senior frontend screens and technical rounds.',
    takeaways: [
      'Trace execution order aloud: synchronous code, microtasks, then macrotasks.',
      'Connect closures, scope, this binding, and prototypes to a concrete code example.',
      'For utility questions, state input assumptions, edge cases, and time/space complexity.',
    ],
  },
  {
    sourceCategory: 'CSS & HTML',
    id: 'css-html',
    title: 'CSS, Browser & Accessibility',
    summary: 'Layout, browser behavior, semantic markup, and accessibility details that distinguish polished implementations.',
    takeaways: [
      'Prefer semantic HTML and keyboard behavior before adding visual polish.',
      'Know when Flexbox, Grid, positioning, and browser measurement each solve the layout problem.',
      'Describe responsive and loading states as part of the implementation, not as an afterthought.',
    ],
  },
  {
    sourceCategory: 'Algorithms & Data Structures',
    id: 'algorithms',
    title: 'Algorithms & Data Structures',
    summary: 'Problem-solving patterns that occur in frontend interview loops alongside UI and JavaScript questions.',
    takeaways: [
      'Start by naming the data structure and the invariant it maintains.',
      'Walk through a small example before presenting the final complexity.',
      'Call out boundary conditions explicitly: empty input, duplicates, and the first or last item.',
    ],
  },
  {
    sourceCategory: 'System Design & Architecture',
    id: 'system-design',
    title: 'Frontend System Design',
    summary: 'Scalable client architecture, data flow, rendering strategy, and the operational trade-offs behind them.',
    takeaways: [
      'Start from users, read/write volume, latency, and failure modes before naming technologies.',
      'Separate the browser experience, API/data boundaries, caching, observability, and rollout concerns.',
      'Explain why a trade-off fits the product rather than presenting one architecture as universal.',
    ],
  },
  {
    sourceCategory: 'General / Other',
    id: 'interview-practice',
    title: 'Interview Practice',
    summary: 'Cross-cutting live-coding, debugging, communication, and career-preparation prompts from the crawled interviews.',
    takeaways: [
      'In live coding, narrate the plan, validate the happy path, then cover failure and edge cases.',
      'Prepare project stories with context, trade-off, measurable impact, and the lesson learned.',
      'Use the source article after each prompt to understand the interview context, not just memorize an answer.',
    ],
  },
];

const SUPPLEMENTARY_DRILLS = {
  react: [
    {
      title: 'Supplementary drill: Accessible async autocomplete',
      summary: 'Design a search box that debounces requests, cancels stale responses, supports keyboard navigation, and exposes the correct combobox semantics.',
      concepts: ['Debounce', 'AbortController', 'ARIA combobox', 'Race conditions'],
    },
    {
      title: 'Supplementary drill: Modal focus management',
      summary: 'Implement an accessible modal with focus trapping, Escape handling, focus restoration, and safe scroll locking.',
      concepts: ['Focus management', 'Keyboard support', 'Portals', 'Accessibility'],
    },
  ],
  javascript: [
    {
      title: 'Supplementary drill: Promise concurrency and cancellation',
      summary: 'Compare sequential, parallel, and bounded-concurrency requests, then explain how cancellation and partial failures affect the UI.',
      concepts: ['Promises', 'Concurrency', 'AbortController', 'Error handling'],
    },
    {
      title: 'Supplementary drill: Debounce with cancel and flush',
      summary: 'Write a debounce utility that preserves this and arguments, and supports explicit cancel and flush operations.',
      concepts: ['Closures', 'Timers', 'this binding', 'API design'],
    },
  ],
  'css-html': [
    {
      title: 'Supplementary drill: Responsive tooltip collision handling',
      summary: 'Position a tooltip that stays in the viewport across small screens, zoom, and dynamic content changes.',
      concepts: ['Layout measurement', 'Viewport', 'Positioning', 'ResizeObserver'],
    },
    {
      title: 'Supplementary drill: Keyboard-first form errors',
      summary: 'Build a form that exposes validation errors accessibly, moves focus predictably, and keeps visual and semantic states aligned.',
      concepts: ['Semantic HTML', 'aria-describedby', 'Focus order', 'Validation'],
    },
  ],
  algorithms: [
    {
      title: 'Supplementary drill: LRU Cache with Map and doubly linked list',
      summary: 'Implement get and put in O(1), explain the ownership of each pointer, and test eviction and update edge cases.',
      concepts: ['Hash map', 'Doubly linked list', 'O(1) operations', 'Invariants'],
    },
    {
      title: 'Supplementary drill: Sliding window for longest unique substring',
      summary: 'Derive the window invariant, trace duplicate handling, and state the time and space complexity.',
      concepts: ['Sliding window', 'Set or map', 'String traversal', 'Complexity'],
    },
    {
      title: 'Supplementary drill: Merge intervals and boundary cases',
      summary: 'Sort and merge overlapping intervals while handling touching endpoints, empty input, and mutation expectations.',
      concepts: ['Sorting', 'Intervals', 'Boundary conditions', 'Complexity'],
    },
  ],
  'system-design': [
    {
      title: 'Supplementary drill: Typeahead search end-to-end',
      summary: 'Design the client state, request lifecycle, caching, rate limits, empty states, and observability for search suggestions.',
      concepts: ['Caching', 'Debouncing', 'Request cancellation', 'Observability'],
    },
    {
      title: 'Supplementary drill: Infinite feed pagination and consistency',
      summary: 'Explain cursor pagination, duplicate prevention, optimistic updates, cache invalidation, and failure recovery in an infinite feed.',
      concepts: ['Cursor pagination', 'Caching', 'Consistency', 'Optimistic UI'],
    },
  ],
  'interview-practice': [
    {
      title: 'Supplementary drill: Debugging a slow React screen',
      summary: 'Walk through a performance investigation from measurement to hypothesis, fix, regression test, and impact validation.',
      concepts: ['Profiling', 'Rendering', 'Network waterfalls', 'Regression testing'],
    },
    {
      title: 'Supplementary drill: STAR story with engineering metrics',
      summary: 'Prepare a concise project story that names context, decision, trade-off, measurable impact, and what you would change next.',
      concepts: ['Communication', 'Trade-offs', 'Metrics', 'Reflection'],
    },
  ],
};

function toFreediumSourceUrl(sourceUrl, freediumUrlByOriginalUrl) {
  if (freediumUrlByOriginalUrl.has(sourceUrl)) {
    return freediumUrlByOriginalUrl.get(sourceUrl);
  }

  return sourceUrl.startsWith('https://medium.com/')
    ? `https://freedium-mirror.cfd/${sourceUrl}`
    : sourceUrl;
}

function toEntry(question, freediumUrlByOriginalUrl) {
  const solution = typeof question.solution === 'string' ? question.solution : '';
  return {
    title: question.question,
    summary: solution
      ? 'Practice the prompt first, then compare your reasoning and edge cases with the source-backed solution.'
      : 'Prepare a concise explanation, a concrete example, and the trade-offs the interviewer is likely to probe.',
    concepts: [question.company, question.role].filter(Boolean),
    source_title: question.source_title,
    source_url: toFreediumSourceUrl(question.source_url, freediumUrlByOriginalUrl),
    code: solution,
  };
}

function toSupplementaryEntry(drill) {
  return {
    ...drill,
    source_title: 'Codex supplementary drill',
    source_url: '',
    code: '',
  };
}

function buildKnowledgeLibrary(articles, synthesis) {
  const questions = Array.isArray(synthesis?.all_questions) ? synthesis.all_questions : [];
  const freediumUrlByOriginalUrl = new Map(
    articles
      .filter((article) => article?.original_url && article?.freedium_url)
      .map((article) => [article.original_url, article.freedium_url]),
  );
  const categories = CATEGORY_DEFINITIONS.map((definition) => {
    const sourcedEntries = questions
      .filter((question) => question.category === definition.sourceCategory)
      .filter((question) => question.question && question.source_title && question.source_url)
      .map((question) => toEntry(question, freediumUrlByOriginalUrl));
    const supplementaryEntries = (SUPPLEMENTARY_DRILLS[definition.id] || []).map(toSupplementaryEntry);
    return { ...definition, entries: [...sourcedEntries, ...supplementaryEntries] };
  });

  return {
    overview: `A Codex-authored review curriculum built directly from ${articles.length} crawled interview articles and their sourced questions.`,
    categories,
    generated_at: new Date().toISOString(),
    model: 'Codex-derived from crawled data',
    source_count: articles.length,
  };
}

module.exports = { buildKnowledgeLibrary };
