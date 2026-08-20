import React, { useMemo } from 'react';
import { QuestionItem } from '../../../../shared/types';
import { SynthesisCardList } from '../SynthesisCardList';

interface JSPanelProps {
  allQuestions?: QuestionItem[];
  openArticleByTitle: (title: string) => void;
}

export function JSPanel({ allQuestions, openArticleByTitle }: JSPanelProps) {
  const list = useMemo(() => (allQuestions || []).filter(q => q.category === 'JavaScript (Core)'), [allQuestions]);
  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-1 uppercase tracking-wider">JavaScript Core Knowledge Area</h3>
      <div className="text-xs text-text-secondary leading-relaxed bg-surface/30 p-4 border border-border-main rounded-lg mb-6 mt-3 space-y-2">
        <h4 className="font-bold text-text-primary">Core Concepts Screened:</h4>
        <p>Firms screen deep closure scopes, customized classes, asynchronous loops, and event-driven patterns:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Promises & Async Schedulers</strong>: Custom retriers, throttling, debouncing, and parallel task runners.</li>
          <li><strong>Closure caching</strong>: Custom memoize implementations and key hashing patterns.</li>
          <li><strong>OOP/Events</strong>: Custom EventEmitters, observer pipelines, and publisher/subscriber structures.</li>
        </ul>
      </div>
      <h4 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">Curated JavaScript Questions</h4>
      <SynthesisCardList list={list} openArticleByTitle={openArticleByTitle} />
    </div>
  );
}

export default JSPanel;
