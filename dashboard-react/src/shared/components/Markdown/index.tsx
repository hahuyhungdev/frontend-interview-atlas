import { Suspense, lazy } from 'react';

// react-markdown + highlight.js are ~100kB gzipped. They are only needed once a
// user opens an article or the study docs, so they load on demand rather than
// sitting in the initial bundle.
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

interface MarkdownProps {
  source: string | undefined;
  className?: string;
  docBase?: string;
}

/** Skeleton sized like body text so nothing shifts when the renderer arrives. */
function MarkdownFallback() {
  return (
    <div className="doc-skeleton" aria-busy="true" aria-label="Rendering content">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="doc-skeleton-line" />
      ))}
    </div>
  );
}

export function Markdown(props: MarkdownProps) {
  if (!props.source) return null;
  return (
    <Suspense fallback={<MarkdownFallback />}>
      <MarkdownRenderer {...props} />
    </Suspense>
  );
}

export default Markdown;
