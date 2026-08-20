import React from 'react';

interface SettingsViewProps {
  crawlUrl: string;
  setCrawlUrl: (url: string) => void;
  isCrawling: boolean;
  crawlLogs: string;
  isSyncing: boolean;
  handleCrawlSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleFullSync: () => void;
}

export function SettingsView({ 
  crawlUrl, 
  setCrawlUrl, 
  isCrawling, 
  crawlLogs, 
  isSyncing, 
  handleCrawlSubmit, 
  handleFullSync 
}: SettingsViewProps) {
  return (
    <div>
      <div className="bg-gradient-to-br from-surface to-bg-secondary border border-border-main rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden shadow-xs">
        <h2 className="text-xl font-bold text-text-primary mb-2">Crawler Settings & Controls</h2>
          <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">Sync RSS feeds or add one Medium article. Every successful crawl automatically regenerates the source-linked study library so new material is ready to review by category.</p>
      </div>
      
      <div className="max-w-2xl bg-surface/30 border border-border-main rounded-2xl p-6 shadow-xs mb-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-3 uppercase tracking-wider">Add Custom Medium Article</h3>
          <form onSubmit={handleCrawlSubmit}>
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-semibold text-text-secondary" htmlFor="crawl-url-input">Medium URL</label>
              <div className="flex gap-2.5">
                <input 
                  type="url" 
                  id="crawl-url-input" 
                  value={crawlUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCrawlUrl(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-bg-primary border border-border-main rounded-xl text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all" 
                  placeholder="https://medium.com/frontend-army/..." 
                  required
                />
                <button type="submit" disabled={isCrawling} className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer">
                  {isCrawling ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16"></circle></svg>
                      Crawling...
                    </>
                  ) : 'Run Crawler'}
                </button>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">URL will automatically be mapped to <strong>Freedium Mirror</strong> to bypass paywalls and retrieve clean Markdown.</p>
            </div>
          </form>
        </div>
        
        <div className="pt-6 border-t border-border-main/50">
          <h3 className="text-sm font-bold text-text-primary mb-2 uppercase tracking-wider">Sync Database with RSS Feeds</h3>
          <p className="text-xs text-text-secondary mb-4 leading-relaxed">This will scan the RSS feeds of Gourav Hammad and Frontend Army to search for the 10 most recent posts, downloading and compiling any articles not yet present in the local database.</p>
          <button disabled={isSyncing} onClick={handleFullSync} className="bg-surface hover:bg-bg-secondary border border-border-main text-text-primary text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer">
            {isSyncing ? 'Syncing...' : 'Sync Feeds'}
          </button>
        </div>
      </div>
      
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary mb-3">Crawler Console Logs Output</h3>
      <pre className="bg-bg-secondary border border-border-main rounded-xl p-4 font-mono text-[11px] text-emerald-500 leading-relaxed overflow-x-auto max-h-[300px] select-text">
        {crawlLogs}
      </pre>
    </div>
  );
}

export default SettingsView;
