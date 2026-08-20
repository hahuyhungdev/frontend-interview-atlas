import React, { useEffect } from 'react';
import { CrawledPost } from '../../types';
import { Markdown } from '../Markdown';

interface ModalProps {
  selectedPost: CrawledPost | null;
  setSelectedPost: (post: CrawledPost | null) => void;
}

export function Modal({ selectedPost, setSelectedPost }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPost(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedPost]);

  if (!selectedPost) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" onClick={(e: React.MouseEvent<HTMLDivElement>) => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) setSelectedPost(null); }}>
      <div className="modal-overlay absolute inset-0" onClick={() => setSelectedPost(null)}></div>
      <div className="relative bg-surface border border-border-main rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        <div className="px-6 py-5 border-b border-border-main flex justify-between items-start gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-text-primary leading-snug">{selectedPost.title}</h2>
            <div className="flex flex-wrap items-center gap-2.5 text-sm text-text-secondary mt-1.5">
              <span>{selectedPost.date || 'August 2026'}</span>
              <span>•</span>
              <span>{selectedPost.role || 'Frontend Engineer'}</span>
              {selectedPost.salary && selectedPost.salary !== 'N/A' && (
                <>
                  <span>•</span>
                  <span className="text-emerald-500 font-semibold">Package: {selectedPost.salary}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedPost.original_url && (
              <a 
                href={selectedPost.original_url} 
                target="_blank" 
                rel="noreferrer" 
                className="px-3.5 py-1.5 bg-bg-secondary hover:bg-surface text-text-primary border border-border-main rounded-xl text-[11px] font-bold tracking-wide transition-all no-underline shrink-0 flex items-center gap-1 hover:border-purple-500/50"
              >
                Original ↗
              </a>
            )}
            {selectedPost.freedium_url && (
              <a 
                href={selectedPost.freedium_url} 
                target="_blank" 
                rel="noreferrer" 
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[11px] font-bold tracking-wide transition-all no-underline shrink-0 flex items-center gap-1 shadow-xs shadow-purple-600/20"
              >
                Freedium ↗
              </a>
            )}
            <button 
              className="p-1.5 hover:bg-bg-secondary text-text-secondary hover:text-text-primary rounded-xl transition-colors ml-1 cursor-pointer border border-transparent hover:border-border-main" 
              onClick={() => setSelectedPost(null)}
              aria-label="Close modal"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
          </div>
        </div>
        
        <div className="px-6 md:px-10 py-8 overflow-y-auto flex-1 select-text">
          <Markdown source={selectedPost.content_markdown} className="mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default Modal;
