import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useParams, useNavigate, Navigate } from 'react-router';
import { Markdown } from '../../../../shared/components/Markdown';
import { useDocsIndex, useDoc } from '../../hooks/useDocs';

const GROUP_LABELS: Record<string, string> = {
  '': 'Overview',
  answers: 'Answer Bank',
};

/** Removes the document's leading H1 so it is not duplicated under the page header. */
function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s+.*\n+/, '');
}

function ReadingProgress({ target }: { target: React.RefObject<HTMLDivElement | null> }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = target.current;
    const bar = barRef.current;
    if (!scroller || !bar) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 0 ? scroller.scrollTop / max : 0;
      // Width is a compositor-friendly transform rather than a layout-triggering width.
      bar.style.transform = `scaleX(${Math.min(Math.max(ratio, 0), 1)})`;
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <div className="doc-progress-track" aria-hidden="true">
      <div ref={barRef} className="doc-progress-bar" />
    </div>
  );
}

function TableOfContents({ markdown }: { markdown: string }) {
  const headings = useMemo(() => {
    const found: { level: number; text: string; id: string }[] = [];
    const seen = new Map<string, number>();

    markdown.split('\n').forEach((line) => {
      const match = /^(#{2,3})\s+(.*)$/.exec(line);
      if (!match) return;
      const text = match[2].replace(/[*`_[\]]/g, '').replace(/\(([^)]*)\)/g, '').trim();
      if (!text) return;
      const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      found.push({ level: match[1].length, text, id: count === 0 ? base : `${base}-${count}` });
    });
    return found;
  }, [markdown]);

  if (headings.length < 3) return null;

  // Long documents list only top-level sections; the full outline is unusable at 30+ entries.
  const visible = headings.length > 14 ? headings.filter((h) => h.level === 2) : headings;

  return (
    <aside className="doc-toc" aria-label="On this page">
      <p className="doc-toc-title">On this page</p>
      <ul>
        {visible.map((heading) => (
          <li key={heading.id} data-level={heading.level}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function DocsView() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params['*'] || '';
  const { groups, status: indexStatus } = useDocsIndex();
  const { doc, status } = useDoc(slug || undefined);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [railNode, setRailNode] = useState<HTMLElement | null>(null);

  // The shell renders the rail container, so it only exists after mount.
  useEffect(() => {
    setRailNode(document.getElementById('context-rail'));
  }, []);

  // Cross-references between documents route in-app instead of reloading the page.
  const handleDocLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-doc-link]');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(link.getAttribute('href') || '/docs');
  };

  // A new document should start at the top, not at the previous scroll offset.
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [slug]);

  // Assign ids to rendered headings so the table of contents can link to them.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !doc) return;
    const seen = new Map<string, number>();
    root.querySelectorAll('.md-h2, .md-h3').forEach((node) => {
      const text = (node.textContent || '').trim();
      const base = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      node.id = count === 0 ? base : `${base}-${count}`;
    });
  }, [doc]);

  if (indexStatus === 'success' && !slug && groups.length > 0) {
    const first = groups[0][1][0];
    if (first) return <Navigate to={`/docs/${first.slug}`} replace />;
  }

  const documentIndex = (
    <nav className="doc-index" aria-label="Study documents">
      <p className="doc-index-heading">Study Material</p>

      {indexStatus === 'loading' && <p className="doc-note">Loading documents…</p>}
      {indexStatus === 'error' && (
        <p className="doc-note doc-note-error" role="alert">
          Could not load the document list. Is the server running?
        </p>
      )}

      {groups.map(([group, entries]) => (
        <section key={group || 'root'} className="doc-index-group">
          <p className="doc-index-group-label">{GROUP_LABELS[group] ?? group}</p>
          <ul>
            {entries.map((entry) => (
              <li key={entry.slug}>
                <NavLink
                  to={`/docs/${entry.slug}`}
                  className={({ isActive }) => `doc-index-link${isActive ? ' is-active' : ''}`}
                >
                  {entry.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <div className="doc-layout">
      {/* Rendered into the shell's sidebar so the app keeps one nav rail. */}
      {railNode ? createPortal(documentIndex, railNode) : null}

      <div className="doc-reader">
        <ReadingProgress target={scrollerRef} />
        <div className="doc-scroller" ref={scrollerRef}>
          {status === 'loading' && (
            <div className="doc-skeleton" aria-busy="true" aria-label="Loading document">
              <div className="doc-skeleton-line doc-skeleton-title" />
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="doc-skeleton-line" />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="doc-empty" role="alert">
              <h2>Document not found</h2>
              <p>Pick another document from the list on the left.</p>
            </div>
          )}

          {status === 'success' && doc && (
            <>
              <header className="doc-header">
                {doc.group && <p className="doc-eyebrow">{GROUP_LABELS[doc.group] ?? doc.group}</p>}
                <h1 className="doc-title">{doc.title}</h1>
              </header>
              <div className="doc-columns" onClick={handleDocLinkClick}>
                <article className="doc-article">
                  {/* The title is rendered above, so drop the document's own leading H1. */}
                  <Markdown source={stripLeadingH1(doc.markdown)} docBase={doc.group} />
                </article>
                <TableOfContents markdown={doc.markdown} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocsView;
