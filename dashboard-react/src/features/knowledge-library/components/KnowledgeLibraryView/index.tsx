import { useEffect, useMemo, useState } from 'react';
import { KnowledgeCategory, KnowledgeLibrary } from '../../../../shared/types';

interface KnowledgeLibraryViewProps {
  error: string | null;
  isLoading: boolean;
  library: KnowledgeLibrary | null;
}

function formatGeneratedAt(generatedAt: string) {
  const date = new Date(generatedAt);
  return Number.isNaN(date.valueOf()) ? 'Unknown time' : date.toLocaleString();
}

function isSafeSourceUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function KnowledgeEntries({ category }: { category: KnowledgeCategory }) {
  return (
    <div className="space-y-6">
      {category.entries.map((entry, index) => (
        <article key={`${entry.source_url}-${entry.title}-${index}`} className="border-b border-border-main pb-8 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold text-text-primary">{entry.title}</h3>
              <p className="mt-2 text-[20px] leading-relaxed text-text-secondary">{entry.summary}</p>
            </div>
            {isSafeSourceUrl(entry.source_url) && (
              <a
                className="shrink-0 text-sm font-semibold text-amber-500 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500"
                href={entry.source_url}
                rel="noreferrer"
                target="_blank"
              >
                Source ↗
              </a>
            )}
          </div>

          {entry.concepts.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Key concepts">
              {entry.concepts.map((concept) => (
                <li key={concept} className="rounded border border-border-main bg-surface/50 px-3 py-1 text-sm font-medium text-text-secondary">{concept}</li>
              ))}
            </ul>
          )}

          {entry.code && (
            <pre className="mt-5 overflow-x-auto rounded-lg border-l-4 border-amber-500 bg-bg-secondary p-5 text-base leading-relaxed text-text-primary">
              <code>{entry.code}</code>
            </pre>
          )}

          <p className="mt-3 text-sm text-text-muted">From {entry.source_title}</p>
        </article>
      ))}
    </div>
  );
}

export function KnowledgeLibraryView({ error, isLoading, library }: KnowledgeLibraryViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const categories = useMemo(() => library?.categories || [], [library]);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || categories[0];

  useEffect(() => {
    if (categories.length > 0 && !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  return (
    <section className="mx-auto max-w-6xl pb-12">
      <header className="border-b-2 border-text-primary pb-6 md:flex md:items-end md:justify-between md:gap-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500">Codex study library</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">Everything learned, arranged for study.</h2>
          <p className="mt-3 max-w-3xl text-[20px] leading-relaxed text-text-secondary">Every crawl refreshes the source-linked questions and solutions. Extra practice is clearly marked as a Codex supplementary drill, so you can distinguish it from the original articles while closing important interview gaps.</p>
        </div>
      </header>

      {error && <p className="mt-5 border-l-2 border-rose-500 bg-surface px-4 py-3 text-sm text-text-primary" role="alert">{error}</p>}

      {isLoading && <p className="mt-8 text-lg text-text-secondary">Loading saved knowledge library…</p>}

      {!isLoading && !library && !error && (
        <div className="mt-8 border border-dashed border-border-main p-8">
          <h3 className="text-xl font-semibold text-text-primary">No study material yet</h3>
          <p className="mt-2 max-w-xl text-[20px] leading-relaxed text-text-secondary">Run a crawl to extract source-linked questions and build the study curriculum.</p>
        </div>
      )}

      {library && selectedCategory && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-border-main lg:pr-6">
            <p className="text-[20px] leading-relaxed text-text-secondary">{library.overview}</p>
            <p className="mt-4 text-xs text-text-muted">Generated {formatGeneratedAt(library.generated_at)} from {library.source_count} sources.</p>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible" aria-label="Knowledge categories">
              {categories.map((category) => (
                <button
                  className={`min-h-11 shrink-0 cursor-pointer border px-4 py-2.5 text-left text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${category.id === selectedCategory.id ? 'border-text-primary bg-text-primary text-bg-primary shadow-sm' : 'border-border-main text-text-secondary hover:border-text-secondary hover:text-text-primary'}`}
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  type="button"
                >
                  {category.title}
                  <span className="ml-2 text-xs opacity-70">({category.entries.length})</span>
                </button>
              ))}
            </div>
          </aside>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">{selectedCategory.title}</p>
            <h3 className="mt-2 text-2xl font-bold text-text-primary md:text-3xl">{selectedCategory.summary}</h3>
            {selectedCategory.takeaways.length > 0 && (
              <ul className="mt-5 grid gap-3 border-y border-border-main py-5 text-[20px] leading-relaxed text-text-secondary">
                {selectedCategory.takeaways.map((takeaway) => <li key={takeaway}>— {takeaway}</li>)}
              </ul>
            )}
            <div className="mt-8"><KnowledgeEntries category={selectedCategory} /></div>
          </div>
        </div>
      )}
    </section>
  );
}
