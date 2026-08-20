import React from 'react';
import { CrawledPost } from '../../../../shared/types';
import { getCompanyBadgeClass } from '../../../../shared/utils/company';

interface ArticlesGridViewProps {
  filteredPosts: CrawledPost[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSelectedPost: (post: CrawledPost | null) => void;
}

export function ArticlesGridView({ filteredPosts, searchQuery, setSearchQuery, setSelectedPost }: ArticlesGridViewProps) {
  return (
    <div>
      <div className="bg-gradient-to-br from-surface to-bg-secondary border border-border-main rounded-2xl p-6 md:p-8 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Crawled Interview Posts</h2>
          <p className="text-sm text-text-secondary max-w-xl leading-relaxed">Interview rounds, coding questions, and salary breakdowns for senior and mid-level frontend roles, scraped from Gourav Hammad's Frontend Army publication.</p>
        </div>
        <div className="relative w-full md:w-80 shrink-0">
          <svg className="absolute left-3 top-3.5 w-4 h-4 text-text-muted" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-bg-primary border border-border-main rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all" 
            placeholder="Search title or company..."
          />
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" className="text-purple-500"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd"/></svg>
          All Discovered Articles ({filteredPosts.length})
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-muted text-xs">
            No articles found matching your criteria.
          </div>
        ) : (
          filteredPosts.map(post => {
            const companyClass = getCompanyBadgeClass(post.company);
            const cleanContent = post.content_markdown ? post.content_markdown.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/[#*`>]/g, '') : '';
            const excerpt = cleanContent.length > 120 ? cleanContent.trim().substring(0, 120) + '...' : cleanContent.trim();
            
            return (
              <div 
                key={post.original_url} 
                onClick={() => setSelectedPost(post)} 
                className="bg-surface/30 border border-border-main hover:border-purple-500/50 rounded-xl p-5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between cursor-pointer group shadow-xs"
              >
                <div>
                  <div className="flex justify-between items-center mb-4 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${companyClass}`}>{post.company || 'General'}</span>
                    {post.salary && post.salary !== 'N/A' && <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 px-2 py-0.5 rounded text-[9px] font-bold">{post.salary}</span>}
                  </div>
                  <h3 className="text-sm font-bold text-text-primary group-hover:text-purple-500 transition-colors mb-2 leading-snug line-clamp-2">{post.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 mb-4">{excerpt || 'Read the full interview experience, technical rounds, questions, and insights.'}</p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-border-main/40 text-[10px] text-text-muted shrink-0">
                  <span>{post.date || 'August 2026'}</span>
                  <button className="flex items-center gap-1 font-bold text-purple-500 hover:text-purple-400 group-hover:translate-x-0.5 transition-all cursor-pointer">
                    Read details
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ArticlesGridView;
