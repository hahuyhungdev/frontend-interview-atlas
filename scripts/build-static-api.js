const fs = require('fs');
const path = require('path');
const { buildKnowledgeLibrary } = require('../knowledge-library');

const rootDir = path.join(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const dataDir = path.join(rootDir, 'data');
const distDirs = [
  path.join(rootDir, 'dist'),
  path.join(rootDir, 'dashboard-react', 'dist'),
];

const DOC_ORDER = [
  'frontend-react-insights',
  'frontend-knowledge-map',
  'core-insights',
];

function readDocTitle(filePath, fallback) {
  try {
    const heading = fs.readFileSync(filePath, 'utf-8').match(/^#\s+(.+)$/m);
    return heading ? heading[1].trim() : fallback;
  } catch {
    return fallback;
  }
}

function collectDocs(docsDir) {
  const docs = new Map();
  if (!fs.existsSync(docsDir)) return docs;

  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, prefix ? `${prefix}/${entry.name}` : entry.name);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

      const base = entry.name.replace(/\.md$/, '');
      const slug = prefix ? `${prefix}/${base}` : base;
      docs.set(slug, {
        slug,
        group: prefix,
        path: absolute,
        title: readDocTitle(absolute, base),
      });
    }
  };

  walk(docsDir, '');
  return docs;
}

function sortDocs(docs) {
  const rank = (slug) => {
    const index = DOC_ORDER.indexOf(slug);
    return index === -1 ? DOC_ORDER.length : index;
  };
  return [...docs.values()].sort((a, b) => {
    if (Boolean(a.group) !== Boolean(b.group)) return a.group ? 1 : -1;
    const byRank = rank(a.slug) - rank(b.slug);
    return byRank !== 0 ? byRank : a.slug.localeCompare(b.slug);
  });
}

function readJsonIfPresent(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : fallback;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function build() {
  const crawledPostsPath = path.join(dataDir, 'crawled_posts.json');
  const synthesizedKnowledgePath = path.join(dataDir, 'synthesized_knowledge.json');

  const crawled_posts = readJsonIfPresent(crawledPostsPath, []);
  const synthesis = readJsonIfPresent(synthesizedKnowledgePath, {});
  const knowledge = buildKnowledgeLibrary(crawled_posts, synthesis);

  const docsMap = collectDocs(docsDir);
  const docsList = sortDocs(docsMap).map(({ slug, title, group }) => ({ slug, title, group }));

  distDirs.forEach((targetDist) => {
    if (!fs.existsSync(targetDist)) return;

    const targetApiDir = path.join(targetDist, 'api');
    if (fs.existsSync(targetApiDir)) {
      fs.rmSync(targetApiDir, { recursive: true, force: true });
    }

    // 1. /api/data.json
    writeJson(path.join(targetDist, 'api', 'data.json'), {
      success: true,
      crawled_posts,
      synthesis,
    });

    // 2. /api/knowledge.json
    writeJson(path.join(targetDist, 'api', 'knowledge.json'), {
      success: true,
      knowledge,
    });

    // 3. /api/docs.json
    writeJson(path.join(targetDist, 'api', 'docs.json'), {
      success: true,
      docs: docsList,
    });

    // 4. /api/docs/[slug].json for each doc
    for (const [slug, doc] of docsMap.entries()) {
      writeJson(path.join(targetDist, 'api', 'docs', `${slug}.json`), {
        success: true,
        doc: {
          slug: doc.slug,
          title: doc.title,
          group: doc.group,
          markdown: fs.readFileSync(doc.path, 'utf-8'),
        },
      });
    }
  });

  console.log(`✓ Static API endpoints generated for ${docsList.length} documents and ${crawled_posts.length} articles.`);
}

build();
