import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router';

// Types
import { CrawledPost, SynthesisData } from './shared/types';

// Feature public index imports
import { ArticlesGridView } from './features/articles';
import { SynthesisView } from './features/synthesis';
import { SettingsView } from './features/crawler';
import { KnowledgeLibrarySection } from './features/knowledge-library';
import { DocsView } from './features/docs';

// Shared layer imports
import { Modal } from './shared/components/Modal';

function App() {
  const [crawledPosts, setCrawledPosts] = useState<CrawledPost[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisData>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPost, setSelectedPost] = useState<CrawledPost | null>(null);
  const [theme, setTheme] = useState<string>('dark');
  
  // Crawler states
  const [crawlUrl, setCrawlUrl] = useState<string>('');
  const [isCrawling, setIsCrawling] = useState<boolean>(false);
  const [crawlLogs, setCrawlLogs] = useState<string>('[SYSTEM] Responsive React TypeScript Dashboard loaded. Awaiting crawler events...');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Load backend data
  const loadData = async () => {
    try {
      const response = await fetch('/api/data');
      const res = await response.json();
      if (res.success) {
        setCrawledPosts(res.crawled_posts || []);
        setSynthesis(res.synthesis || {});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Theme setup
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
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
    const count = crawledPosts.length;
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
      postsCount: count,
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

  // Custom crawl trigger
  const handleCrawlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!crawlUrl) return;
    
    setIsCrawling(true);
    setCrawlLogs(`[INFO] Initializing crawl for: ${crawlUrl}\n[INFO] Contacting local crawler script...\n`);
    
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: crawlUrl })
      });
      
      const result = await response.json();
      if (result.success) {
        setCrawlLogs(prev => prev + `\n[SUCCESS] Scraped and compiled article!\n[SUCCESS] Codex study library refreshed from sourced crawl data.\n\n=== Crawler stdout ===\n${result.stdout}`);
        setCrawlUrl('');
        await loadData();
        navigate('/knowledge');
      } else {
        setCrawlLogs(prev => prev + `\n[ERROR] Crawl failed!\nReason: ${result.error}\nStderr: ${result.stderr || ''}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown network error.';
      setCrawlLogs(prev => prev + `\n[ERROR] Network error contacting endpoint: ${message}`);
    } finally {
      setIsCrawling(false);
    }
  };

  // Full Feed sync trigger
  const handleFullSync = async () => {
    setIsSyncing(true);
    setCrawlLogs(`[INFO] Starting full feed synchronization...\n[INFO] Checking RSS feeds and seed lists...\n`);
    
    try {
      const response = await fetch('/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const result = await response.json();
      if (result.success) {
        setCrawlLogs(prev => prev + `\n[SUCCESS] Full RSS synchronization completed!\n[SUCCESS] Codex study library refreshed from sourced crawl data.\n\n=== Crawler stdout ===\n${result.stdout}`);
        await loadData();
        navigate('/knowledge');
      } else {
        setCrawlLogs(prev => prev + `\n[ERROR] Sync failed: ${result.error}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown network error.';
      setCrawlLogs(prev => prev + `\n[ERROR] Server communication error: ${message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Open modal matching article title
  const openArticleByTitle = (title: string) => {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const post = crawledPosts.find(p => {
      const postTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return postTitle.includes(cleanTitle) || cleanTitle.includes(postTitle);
    });
    if (post) {
      setSelectedPost(post);
    } else {
      console.warn(`Article matching title "${title}" not found.`);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg-primary text-text-primary transition-all duration-200">
      {/* Sidebar navigation */}
      <aside className="w-full md:w-72 bg-bg-secondary border-b md:border-b-0 md:border-r border-border-main flex flex-col shrink-0 h-auto md:h-screen sticky top-0 z-20">
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
              <span className="text-sm md:text-base font-extrabold text-amber-500 leading-tight">{statistics.maxPackage}</span>
              <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Max Package</span>
            </div>
          </div>
        </div>
        
        {/* Navigation Sidebar links */}
        <nav className="p-3 md:p-4 flex flex-col gap-1 shrink-0">
          <div className="text-xs text-text-muted font-bold uppercase tracking-wider px-2 mb-1.5">Navigation</div>
          <NavLink 
            to="/" 
            className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
            All Crawled Posts
          </NavLink>
          <NavLink 
            to="/synthesis" 
            className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive || location.pathname.startsWith('/synthesis') ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.082l1.949.835a1 1 0 00.788 0l7-3a1 1 0 000-1.84l-7-3zM2.883 10.962a1 1 0 00-.378 1.342l3 5.5a1 1 0 001.73-.008l3-5.5a1 1 0 10-1.735-.988L6.852 14.3l-2.627-4.819a1 1 0 00-1.342-.378zM17.117 10.962a1 1 0 01.378 1.342l-3 5.5a1 1 0 01-1.73-.008l-3-5.5a1 1 0 111.735-.988l1.649 3.023 2.627-4.819a1 1 0 011.342-.378z"/></svg>
            Synthesized Knowledge
          </NavLink>
          <NavLink
            to="/knowledge"
            className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h11a1 1 0 100-2H4V5h11a1 1 0 100-2H4z"/><path d="M8 6a1 1 0 011-1h7a2 2 0 012 2v8a1 1 0 11-2 0V7H9a1 1 0 01-1-1z"/><path d="M6 8a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"/></svg>
            Codex Study Library
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive || location.pathname.startsWith('/docs') ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
            Study Docs
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }: { isActive: boolean }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.533 1.533 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
            Crawler Settings
          </NavLink>
        </nav>
        
        {/* Categories filters menu tags */}
        <div className="p-3 md:p-4 flex-1 overflow-y-auto border-t border-border-main/50 max-h-48 md:max-h-none">
          <div className="text-xs text-text-muted font-bold uppercase tracking-wider px-2 mb-2">Categories</div>
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
          <Route path="/synthesis/*" element={
            <SynthesisView 
              synthesis={synthesis} 
              openArticleByTitle={openArticleByTitle}
            />
          } />
          <Route path="/knowledge" element={<KnowledgeLibrarySection />} />
          <Route path="/docs/*" element={<DocsView />} />
          <Route path="/settings" element={
            <SettingsView 
              crawlUrl={crawlUrl} 
              setCrawlUrl={setCrawlUrl} 
              isCrawling={isCrawling} 
              crawlLogs={crawlLogs} 
              isSyncing={isSyncing} 
              handleCrawlSubmit={handleCrawlSubmit} 
              handleFullSync={handleFullSync}
            />
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Shared Modal component */}
      <Modal selectedPost={selectedPost} setSelectedPost={setSelectedPost} />
    </div>
  );
}

export default App;
