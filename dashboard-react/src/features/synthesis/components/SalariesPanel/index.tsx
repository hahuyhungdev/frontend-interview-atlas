import React from 'react';
import { SalaryInsight } from '../../../../shared/types';

interface SalariesPanelProps {
  salaryInsights?: SalaryInsight[];
  openArticleByTitle: (title: string) => void;
}

export function SalariesPanel({ salaryInsights, openArticleByTitle }: SalariesPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-bold text-text-primary mb-1 uppercase tracking-wider">Stated Salary Benchmarks</h3>
      <p className="text-xs text-text-secondary mb-5">Comparative view of salaries and compensation packages stated across Gourav Hammad's interview experiences.</p>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-main text-left">
          <thead>
            <tr className="border-b border-border-main text-[10px] uppercase font-bold text-text-muted tracking-wider">
              <th className="pb-3">Company</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Package</th>
              <th className="pb-3 text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main/50 text-xs">
            {salaryInsights && salaryInsights.length > 0 ? (
              salaryInsights.map((item, idx) => (
                <tr key={idx} className="hover:bg-surface/20 transition-colors">
                  <td className="py-3.5 font-bold text-text-primary">{item.company}</td>
                  <td className="py-3.5 text-text-secondary">{item.role}</td>
                  <td className="py-3.5"><span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold">{item.salary}</span></td>
                  <td className="py-3.5 text-right"><a href="#" className="text-purple-500 hover:underline font-bold" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); openArticleByTitle(item.company); }}>View details ↗</a></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="text-center py-6 text-text-muted">No salary benchmarks available yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SalariesPanel;
