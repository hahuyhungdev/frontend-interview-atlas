import React, { useMemo } from 'react';
import { QuestionItem } from '../../../../shared/types';
import { SynthesisCardList } from '../SynthesisCardList';

interface CSSPanelProps {
  allQuestions?: QuestionItem[];
  openArticleByTitle: (title: string) => void;
}

export function CSSPanel({ allQuestions, openArticleByTitle }: CSSPanelProps) {
  const list = useMemo(() => (allQuestions || []).filter(q => q.category === 'CSS & HTML'), [allQuestions]);
  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-1 uppercase tracking-wider">CSS & HTML Layout Synthesis</h3>
      <div className="text-xs text-text-secondary leading-relaxed bg-surface/30 p-4 border border-border-main rounded-lg mb-6 mt-3 space-y-2">
        <h4 className="font-bold text-text-primary">Core Concepts Screened:</h4>
        <p>Pixel-perfect responsive design structures, rendering animations, and layouts:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Grids & Flexbox</strong>: Aligning dynamic items, comment hierarchies, and responsive widgets.</li>
          <li><strong>Pure CSS</strong>: Hover cards, menus, tooltips, and sliders with zero JavaScript overhead.</li>
          <li><strong>Skeletal Shimmers</strong>: Animation effects for layout load skeletons to reduce layout shifts.</li>
        </ul>
      </div>
      <h4 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-wider">Curated CSS Questions</h4>
      <SynthesisCardList list={list} openArticleByTitle={openArticleByTitle} />
    </div>
  );
}

export default CSSPanel;
