import React, { useMemo } from 'react';
import { QuestionItem } from '../../../../shared/types';
import { SynthesisCardList } from '../SynthesisCardList';

interface ReactPanelProps {
  allQuestions?: QuestionItem[];
  openArticleByTitle: (title: string) => void;
}

export function ReactPanel({ allQuestions, openArticleByTitle }: ReactPanelProps) {
  const list = useMemo(() => (allQuestions || []).filter(q => q.category === 'React'), [allQuestions]);
  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-1 uppercase tracking-wider">React Knowledge Area Synthesis</h3>
      <div className="text-xs text-text-secondary leading-relaxed bg-surface/30 p-4 border border-border-main rounded-lg mb-6 mt-3 space-y-2">
        <h4 className="font-bold text-text-primary">Core Concepts Screened:</h4>
        <p>Interviewers at major firms screen for advanced tree-diffing mechanisms, state management lifecycles, and component scaling behaviors:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Hooks Optimization</strong>: Referential equality variables (`useMemo`) and callbacks (`useCallback`).</li>
          <li><strong>Deep Context updates</strong>: Handling deep DOM node overrides and managing re-renders via useContext.</li>
          <li><strong>Machine Coding</strong>: Star ratings, Reddit nested lists, search dropdowns, and sequential progress queues.</li>
        </ul>
      </div>
      <h4 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">Curated React Questions & Challenges</h4>
      <SynthesisCardList list={list} openArticleByTitle={openArticleByTitle} />
    </div>
  );
}

export default ReactPanel;
