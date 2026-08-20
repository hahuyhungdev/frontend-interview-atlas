import React from 'react';
import { QuestionItem } from '../../../../shared/types';
import { markdownToText } from '../../../../shared/utils/markdown';
import { getCompanyBadgeClass } from '../../../../shared/utils/company';

interface SynthesisCardListProps {
  list: QuestionItem[];
  openArticleByTitle: (title: string) => void;
}

export function SynthesisCardList({ list, openArticleByTitle }: SynthesisCardListProps) {
  if (!list || list.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-xs">
        No questions found under this category. Sync feeds to pull new items.
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {list.map((item, idx) => {
        const badgeColor = getCompanyBadgeClass(item.company);
        return (
          <div key={idx} className="bg-surface/40 border border-border-main rounded-xl p-5 hover:border-zinc-700/80 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3 shrink-0">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${badgeColor}`}>{item.company || 'General'}</span>
                <span className="text-xs text-text-secondary font-medium">{item.role || 'Frontend Engineer'}</span>
              </div>
              <p className="text-xs font-medium text-text-primary bg-bg-secondary/40 border-l-2 border-purple-500 px-4 py-3 rounded-r-lg italic leading-relaxed mb-4">
                {item.question}
              </p>
              {item.solution && (
                <details className="border border-border-main/80 rounded-lg overflow-hidden mt-3 bg-bg-secondary/20">
                  <summary className="px-4 py-2 bg-surface text-[11px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer select-none transition-colors">
                    View Solution & Details
                  </summary>
                  <pre className="whitespace-pre-wrap break-words p-4 border-t border-border-main text-xs leading-relaxed text-text-secondary select-text overflow-x-auto">
                    {markdownToText(item.solution)}
                  </pre>
                </details>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-border-main/40 text-[10px] text-text-muted shrink-0">
              <span>Source: <a href="#" className="text-emerald-500 hover:underline font-bold" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); openArticleByTitle(item.source_title); }}>{item.source_title}</a></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SynthesisCardList;
