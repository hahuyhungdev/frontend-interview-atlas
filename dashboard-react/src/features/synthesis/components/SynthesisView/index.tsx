import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router';
import { SynthesisData } from '../../../../shared/types';
import { SalariesPanel } from '../SalariesPanel';
import { ReactPanel } from '../ReactPanel';
import { JSPanel } from '../JSPanel';
import { CSSPanel } from '../CSSPanel';
import { AlgoPanel } from '../AlgoPanel';

interface SynthesisViewProps {
  synthesis: SynthesisData;
  openArticleByTitle: (title: string) => void;
}

export function SynthesisView({ synthesis, openArticleByTitle }: SynthesisViewProps) {
  return (
    <div>
      <div className="bg-gradient-to-br from-surface to-bg-secondary border border-border-main rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden shadow-xs">
        <h2 className="text-xl font-bold text-text-primary mb-2">Knowledge Synthesis By Category</h2>
        <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">Aggregated salary benchmarks, core coding problem statements, and key behavioral interview takeaways extracted dynamically from the crawlers' dataset.</p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation list */}
        <div className="flex flex-col gap-1.5 shrink-0 lg:w-48 bg-surface/30 p-3 border border-border-main rounded-xl">
          <NavLink 
            to="/synthesis/salaries" 
            end
            className={({ isActive }) => `text-left px-3.5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            💰 Salaries
          </NavLink>
          <NavLink 
            to="/synthesis/react" 
            className={({ isActive }) => `text-left px-3.5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            ⚛️ React Hub
          </NavLink>
          <NavLink 
            to="/synthesis/javascript" 
            className={({ isActive }) => `text-left px-3.5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            🟨 JS Core
          </NavLink>
          <NavLink 
            to="/synthesis/css" 
            className={({ isActive }) => `text-left px-3.5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            🎨 CSS & HTML
          </NavLink>
          <NavLink 
            to="/synthesis/algorithms" 
            className={({ isActive }) => `text-left px-3.5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive ? 'bg-purple-600 text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
          >
            📊 Algorithms
          </NavLink>
        </div>
        
        {/* Render child routing nested panel */}
        <div className="flex-1 bg-surface/20 border border-border-main rounded-xl p-6 min-h-[400px]">
          <Routes>
            <Route index element={<Navigate to="salaries" replace />} />
            <Route path="salaries" element={
              <SalariesPanel salaryInsights={synthesis.salary_insights} openArticleByTitle={openArticleByTitle} />
            } />
            <Route path="react" element={
              <ReactPanel allQuestions={synthesis.all_questions} openArticleByTitle={openArticleByTitle} />
            } />
            <Route path="javascript" element={
              <JSPanel allQuestions={synthesis.all_questions} openArticleByTitle={openArticleByTitle} />
            } />
            <Route path="css" element={
              <CSSPanel allQuestions={synthesis.all_questions} openArticleByTitle={openArticleByTitle} />
            } />
            <Route path="algorithms" element={
              <AlgoPanel allQuestions={synthesis.all_questions} openArticleByTitle={openArticleByTitle} />
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default SynthesisView;
