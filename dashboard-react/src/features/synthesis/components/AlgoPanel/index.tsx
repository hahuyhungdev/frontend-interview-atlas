import React, { useMemo } from 'react';
import { QuestionItem } from '../../../../shared/types';
import { SynthesisCardList } from '../SynthesisCardList';

interface AlgoPanelProps {
  allQuestions?: QuestionItem[];
  openArticleByTitle: (title: string) => void;
}

export function AlgoPanel({ allQuestions, openArticleByTitle }: AlgoPanelProps) {
  const list = useMemo(() => (allQuestions || []).filter(q => 
    q.category === 'Algorithms & Data Structures' || 
    q.category === 'System Design & Architecture' || 
    q.category === 'General / Other'
  ), [allQuestions]);

  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-1 uppercase tracking-wider">Algorithms & Data Structures</h3>
      <div className="text-xs text-text-secondary leading-relaxed bg-surface/30 p-4 border border-border-main rounded-lg mb-6 mt-3 space-y-2">
        <h4 className="font-bold text-text-primary">Core Concepts Screened:</h4>
        <p>First-round screening problems on time/space optimizations, binary tree traversals, matrices, and arrays:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Traversals & Linked Lists</strong>: BST checking, sorting, inversion, and loop detection.</li>
          <li><strong>Two-Pointer & Windows</strong>: Finding duplicate patterns, subarrays, and dynamic windows.</li>
          <li><strong>Sorted Grid search</strong>: Matrix values lookup in O(M+N) time.</li>
        </ul>
      </div>
      <h4 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">Curated Algorithmic Questions</h4>
      <SynthesisCardList list={list} openArticleByTitle={openArticleByTitle} />
    </div>
  );
}

export default AlgoPanel;
