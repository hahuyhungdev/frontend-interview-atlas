// Helper function to dynamically map company tags to beautiful styled badges
export function getCompanyBadgeClass(company?: string): string {
  const c = company ? company.toLowerCase() : '';
  if (c === 'apple') return 'bg-brand-amber-glow border border-brand-amber/20 text-brand-amber';
  if (c === 'amazon') return 'bg-brand-purple-glow border border-brand-purple/20 text-brand-purple';
  if (c === 'linkedin') return 'bg-blue-500/10 border border-blue-500/20 text-blue-400';
  if (c === 'makemytrip' || c === 'goibibo' || c === 'deel') return 'bg-brand-emerald-glow border border-brand-emerald/20 text-brand-emerald';
  if (c === 'oracle' || c === 'paypal') return 'bg-brand-rose-glow border border-brand-rose/20 text-brand-rose';
  return 'bg-surface border border-border-main text-text-secondary';
}
