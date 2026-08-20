# Frontend Interview Atlas

A frontend interview knowledge base with its own ingestion pipeline. It crawls real interview experiences, synthesizes them into study material, and serves the result through a dashboard.

The source corpus is the interview experiences, salary insights, and preparation strategies published by **Gourav Hammad** (Founder of *Frontend Army*) on Medium.

The distilled study material lives in [`docs/`](./docs) — see [Study Material](#study-material) below.

## Project Features

1. **RSS Feed Auto-Discovery**: Automatically fetches the latest posts from the author's personal feed and publication feed.
2. **Freedium Mirror Bypassing**: Maps Medium article URLs to a Freedium mirror to bypass paywalls and scrape clean Markdown content.
3. **Incremental Scraper**: Loads cached results and only crawls new posts.
4. **On-Demand Crawling**: Accepts CLI arguments or frontend API inputs to scrape and compile specific Medium URLs instantly.
5. **Aesthetic UI Dashboard**:
   - **Interactive Statistics**: Total posts, distinct companies, and top salaries.
   - **Search & Tag Filters**: Search keywords and click tags/companies to filter cards instantly.
   - **Synthesized Knowledge Sections**: Grouped salary benchmarks, dynamic DSA accordion, and preparation take-away lists.
   - **Codex Study Library**: An automatically refreshed, source-linked review curriculum. Original questions stay linked to their crawled articles; clearly labeled Codex supplementary drills cover important interview fundamentals that the corpus is sparse on.
   - **Modal Viewer**: Renders scraped Markdown articles in an inline glassmorphism reading overlay with custom **Copy Code** snippets.
   - **Crawler Shell Console**: Run crawls directly from the dashboard and monitor real-time output.

---

## File Structure

- `crawler.py`: Core Python script for feed parsing, HTML content fetching, Markdown conversion, metadata parsing, and report writing.
- `run_crawler.sh`: Shell script that initializes a `.venv`, installs dependencies (`beautifulsoup4`), and runs the Python crawler.
- `server.js`: Express backend server that serves static frontend files and exposes GET/POST endpoints for data fetching and crawl executions.
- `package.json`: Lists Node.js dependencies (`express`) and package scripts.
- **`data/`**: Compiled results folder
  - `crawled_posts.json`: Full scraped articles list.
  - `synthesized_knowledge.json`: Extracted data grouped by company, questions, and salaries.
  - `synthesized_knowledge.md`: Markdown report summarizing insights.
- **`frontend/`**: Beautiful single-page interface files.
  - `index.html`: Structure and layout.
  - `index.css`: Dark zinc theme & responsive styles.
  - `index.js`: Filter logic, tab toggles, modal rendering, and API synchronization.
- **`docs/`**: Study material distilled from the crawled corpus (see below).

---

## Study Material

The crawler produces raw data; `docs/` is what that data was for. Read in this order:

| Document | What it is |
|---|---|
| [`docs/frontend-react-insights.md`](./docs/frontend-react-insights.md) | Analysis of the corpus — what 23 interview loops across 19 companies actually reveal, including which rejection reasons repeat |
| [`docs/frontend-knowledge-map.md`](./docs/frontend-knowledge-map.md) | Every concept to cover, in 21 categories across 6 layers, priority-marked by how much each decides outcomes |
| [`docs/core-insights.md`](./docs/core-insights.md) | The eight mental models that generate the answers, plus what an interview corpus structurally cannot teach |
| [`docs/answers/`](./docs/answers) | Model answers and reference implementations — 8 files covering JavaScript, React, machine coding, CSS/a11y/design, testing, security, modern data patterns, and production engineering |

Files `01`–`04` of the answer bank come from the corpus. Files `05`–`08` fill the gaps the corpus never covered — testing, security, Server Components, and the production work nobody interviews on.

---

## Getting Started

### 1. Setup and Run Server
To start the application, navigate to the project directory and run:

```bash
npm start
```

This will launch the Express server at **`http://localhost:3000`**.

### 2. Review the Codex Study Library

The study library is built directly from `crawled_posts.json` and the source-backed questions in `synthesized_knowledge.json`. Each crawl refreshes it automatically; no API key, external AI CLI, or separate manual generation step is required.

Supplementary drills deliberately use the source label **Codex supplementary drill**, so they are never confused with knowledge extracted from a Medium article.

### 3. Manual CLI Crawler Execution
To run a full re-sync of the feeds:
```bash
./run_crawler.sh
```

To crawl a specific new URL:
```bash
.venv/bin/python3 crawler.py "https://medium.com/frontend-army/amazon-frontend-engineer-interview-experience-2026-a81e237279aa"
```
