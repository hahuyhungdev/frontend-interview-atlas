const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { buildKnowledgeLibrary } = require('./knowledge-library');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const execFileAsync = promisify(execFile);

function isSameOriginRequest(req) {
  const origin = req.get('origin');
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    return originUrl.host === req.get('host') && ['http:', 'https:'].includes(originUrl.protocol);
  } catch {
    return false;
  }
}

function readJsonIfPresent(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : fallback;
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(temporaryPath, filePath);
}

function normalizeMediumUrl(value) {
  if (typeof value !== 'string' || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'medium.com' || url.pathname === '/') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

// Reading order for the study documents; anything unlisted sorts alphabetically after these.
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

/**
 * Builds a slug -> absolute path map by walking the docs directory.
 *
 * Requests are resolved by looking a slug up in this map, so a user-supplied
 * string is never turned into a filesystem path and traversal is impossible
 * by construction rather than by sanitising the input.
 */
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

async function runCrawler(url) {
  return execFileAsync(path.join(__dirname, 'run_crawler.sh'), url ? [url] : [], {
    cwd: __dirname,
    maxBuffer: 20 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  });
}

function createApp({
  dataDir = path.join(__dirname, 'data'),
  docsDir = path.join(__dirname, 'docs'),
  runCrawler: crawl = runCrawler,
} = {}) {
  const app = express();
  const crawledPostsPath = path.join(dataDir, 'crawled_posts.json');
  const synthesizedKnowledgePath = path.join(dataDir, 'synthesized_knowledge.json');
  let isCrawling = false;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.join(__dirname, 'dashboard-react', 'dist')));

  app.get('/api/data', (req, res) => {
    try {
      res.json({
        success: true,
        crawled_posts: readJsonIfPresent(crawledPostsPath, []),
        synthesis: readJsonIfPresent(synthesizedKnowledgePath, {}),
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to load crawl data.' });
    }
  });

  app.get('/api/knowledge', (req, res) => {
    try {
      const articles = readJsonIfPresent(crawledPostsPath, []);
      const synthesis = readJsonIfPresent(synthesizedKnowledgePath, {});
      return res.json({ success: true, knowledge: buildKnowledgeLibrary(articles, synthesis) });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to load the Codex study library.' });
    }
  });

  app.get('/api/docs', (req, res) => {
    try {
      const docs = sortDocs(collectDocs(docsDir))
        .map(({ slug, title, group }) => ({ slug, title, group }));
      return res.json({ success: true, docs });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to list study documents.' });
    }
  });

  app.get('/api/docs/*', (req, res) => {
    try {
      const slug = req.params[0];
      const doc = collectDocs(docsDir).get(slug);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found.' });
      }
      return res.json({
        success: true,
        doc: {
          slug: doc.slug,
          title: doc.title,
          group: doc.group,
          markdown: fs.readFileSync(doc.path, 'utf-8'),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to read the document.' });
    }
  });

  app.post('/api/crawl', async (req, res) => {
    if (!isSameOriginRequest(req)) {
      return res.status(403).json({ success: false, error: 'Crawling only accepts same-origin requests.' });
    }
    if (isCrawling) {
      return res.status(409).json({ success: false, error: 'A crawl is already in progress.' });
    }

    const rawUrl = req.body && req.body.url;
    const url = rawUrl ? normalizeMediumUrl(rawUrl) : null;
    if (rawUrl && !url) {
      return res.status(400).json({ success: false, error: 'URL must be an HTTPS medium.com article link.' });
    }

    isCrawling = true;
    try {
      const { stdout = '', stderr = '' } = await crawl(url);
      const crawledPosts = readJsonIfPresent(crawledPostsPath, []);
      const synthesis = readJsonIfPresent(synthesizedKnowledgePath, {});
      const knowledge = buildKnowledgeLibrary(crawledPosts, synthesis);

      return res.json({
        success: true,
        message: 'Crawl and Codex study library refresh completed successfully.',
        crawled_posts: crawledPosts,
        synthesis,
        knowledge,
        stdout,
        stderr,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Crawl failed.',
        stderr: error && typeof error.stderr === 'string' ? error.stderr : '',
      });
    } finally {
      isCrawling = false;
    }
  });

  // BrowserRouter routes must resolve to the application document on refresh.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(__dirname, 'dashboard-react', 'dist', 'index.html'));
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

// Attach properties to the app function so that standard destructured imports
// like: const { app, createApp, HOST } = require('./server') still work.
app.app = app;
app.createApp = createApp;
app.HOST = HOST;
app.normalizeMediumUrl = normalizeMediumUrl;

module.exports = app;

