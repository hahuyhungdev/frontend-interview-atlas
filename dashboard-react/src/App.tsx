import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router';

// Types
import { CrawledPost } from './shared/types';

// Feature public index imports
import { ArticlesGridView } from './features/articles';
import { DocsView } from './features/docs';

// Shared layer imports
import { Modal } from './shared/components/Modal';

function App() {
  const [crawledPosts, setCrawledPosts] = useState<CrawledPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPost, setSelectedPost] = useState<CrawledPost | null>(null);
  const [theme, setTheme] = useState<string>('light');

  const location = useLocation();
  // Category chips only filter the posts grid, so they are hidden elsewhere.
  const showCategories = location.pathname === '/';

  // Load backend data
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/data', { signal: controller.signal })
      .then((response) => response.json())
      .then((res) => {
        if (res.success) setCrawledPosts(res.crawled_posts || []);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error fetching data:', error);
      });

    return () => controller.abort();
  }, []);

  // Theme setup
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  // Compile statistics
  const statistics = useMemo(() => {
    const companies = new Set<string>();
    let maxVal = 0;
    let maxStr = 'N/A';

    crawledPosts.forEach(post => {
      if (post.company && post.company !== 'General') {
        companies.add(post.company);
      }

      if (post.salary && post.salary !== 'N/A') {
        const match = post.salary.match(/(\d+)/);
        if (match) {
          const val = parseInt(match[0]);
          if (post.salary.toLowerCase().includes('lpa') || post.salary.toLowerCase().includes('lakh')) {
            if (val > maxVal) {
              maxVal = val;
              maxStr = `${val} LPA`;
            }
          } else if (post.salary.toLowerCase().includes('$') || post.salary.toLowerCase().includes('k')) {
            const usdVal = val * 0.85;
            if (usdVal > maxVal) {
              maxVal = usdVal;
              maxStr = post.salary;
            }
          }
        }
      }
    });

    return {
      postsCount: crawledPosts.length,
      companiesCount: companies.size,
      maxPackage: maxStr
    };
  }, [crawledPosts]);

  // Unique tags list
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    crawledPosts.forEach(post => {
      if (post.tags) {
        post.tags.forEach(t => tags.add(t.toLowerCase()));
      }
      if (post.company && post.company !== 'General') {
        tags.add(post.company.toLowerCase());
      }
    });
    return Array.from(tags).sort();
  }, [crawledPosts]);

  // Filtered and sorted posts
  const filteredPosts = useMemo(() => {
    let list = [...crawledPosts];

    if (selectedCategory !== 'all') {
      list = list.filter(post => {
        const matchTag = post.tags && post.tags.some(t => t.toLowerCase() === selectedCategory);
        const matchComp = post.company && post.company.toLowerCase() === selectedCategory;
        return matchTag || matchComp;
      });
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(post =>
        post.title.toLowerCase().includes(q) ||
        (post.company && post.company.toLowerCase().includes(q)) ||
        (post.content_markdown && post.content_markdown.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    return list;
  }, [crawledPosts, selectedCategory, searchQuery]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
      isActive
        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10'
        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
    }`;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg-primary text-text-primary transition-all duration-200">
      {/* Sidebar navigation */}
      <aside className="w-full md:w-80 bg-bg-secondary border-b md:border-b-0 md:border-r border-border-main flex flex-col shrink-0 h-auto md:h-screen sticky top-0 z-20">
        <div className="p-4 md:p-5 border-b border-border-main flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center shadow-lg shadow-purple-600/25">FA</div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-text-primary">Interview Atlas</h1>
              <p className="text-xs text-text-muted">Frontend study workspace</p>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-surface text-text-secondary hover:text-text-primary transition-all shrink-0 cursor-pointer" aria-label="Toggle theme">
            {theme === 'light' ? (
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.46 5.05L5.75 4.35a1 1 0 10-1.41 1.41l.71.71zm10.607 10.607a1 1 0 01-1.414 0l-.707-.707a1 1 0 111.414-1.414l.707.707a1 1 0 010 1.414zM5 11a1 1 0 110-2h1a1 1 0 110 2H5z" clipRule="evenodd" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            )}
          </button>
        </div>

        {/* Statistics panel widget */}
        <div className="p-4 md:p-5 border-b border-border-main shrink-0">
          <div className="grid grid-cols-3 md:grid-cols-2 gap-2.5 md:gap-3 text-center">
            <div className="bg-surface/40 border border-border-main/50 p-2 md:p-2.5 rounded-xl flex flex-col justify-center">
              <span className="text-2xl md:text-3xl font-extrabold text-purple-500 leading-tight">{statistics.postsCount}</span>
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Posts</span>
            </div>
            <div className="bg-surface/40 border border-border-main/50 p-2 md:p-2.5 rounded-xl flex flex-col justify-center">
              <span className="text-2xl md:text-3xl font-extrabold text-emerald-500 leading-tight">{statistics.companiesCount}</span>
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Companies</span>
            </div>
            <div className="col-span-1 md:col-span-2 bg-surface/40 border border-border-main/50 p-2 rounded-xl flex flex-col justify-center">
              <span className="text-lg md:text-xl font-extrabold text-amber-500 leading-tight">{statistics.maxPackage}</span>
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Max Package</span>
            </div>
          </div>
        </div>

        {/* Navigation Sidebar links */}
        <nav className="p-3 md:p-4 flex flex-col gap-1 shrink-0" aria-label="Primary">
          <div className="text-xs text-text-muted font-bold uppercase tracking-wider px-2 mb-2">Navigation</div>
          <NavLink to="/" className={navLinkClass}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
            Crawled Posts
          </NavLink>
          <NavLink to="/docs" className={navLinkClass}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
            Study Docs
          </NavLink>
        </nav>

        {/* Contextual rail: routes portal their own secondary navigation here,
            so the shell keeps one sidebar instead of stacking two. */}
        {!showCategories && (
          <div id="context-rail" className="flex-1 min-h-0 overflow-y-auto border-t border-border-main/50" />
        )}

        {/* Category filters, only meaningful on the posts grid */}
        {showCategories && (
          <div className="p-3 md:p-4 flex-1 overflow-y-auto border-t border-border-main/50 max-h-48 md:max-h-none">
            <div className="text-xs text-text-muted font-bold uppercase tracking-wider px-2 mb-2.5">Categories</div>
            <div className="flex flex-wrap gap-1.5 px-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`cursor-pointer px-2.5 py-1 rounded-full text-[13px] font-semibold border transition-all ${selectedCategory === 'all' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-surface border-border-main text-text-secondary hover:text-text-primary'}`}
              >
                📁 all
              </button>
              {uniqueTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedCategory(tag)}
                  className={`cursor-pointer px-2.5 py-1 rounded-full text-[13px] font-semibold border transition-all ${selectedCategory === tag ? 'bg-purple-600 border-purple-500 text-white' : 'bg-surface border-border-main text-text-secondary hover:text-text-primary'}`}
                >
                  # {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main content pane */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-h-screen">
        <Routes>
          <Route path="/" element={
            <ArticlesGridView
              filteredPosts={filteredPosts}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setSelectedPost={setSelectedPost}
            />
          } />
          <Route path="/docs/*" element={<DocsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Shared Modal component */}
      <Modal selectedPost={selectedPost} setSelectedPost={setSelectedPost} />
    </div>
  );
}

export default App;
