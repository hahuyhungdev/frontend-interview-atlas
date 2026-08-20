import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { resolveDocLink } from '../../utils/markdown';

interface MarkdownProps {
  source: string | undefined;
  className?: string;
  /** Group of the document being rendered, used to resolve relative .md links. */
  docBase?: string;
}

/**
 * Renders Markdown as React elements.
 *
 * react-markdown does not allow raw HTML unless rehype-raw is added, and it
 * sanitises URL schemes by default, so untrusted crawled article bodies are safe
 * to pass straight in. The component map below only attaches presentation
 * classes and rewrites cross-document links to in-app routes.
 */
export function Markdown({ source, className = '', docBase }: MarkdownProps) {
  const components = useMemo<Components>(() => ({
    h1: (props) => <h1 className="md-h1" {...props} />,
    h2: (props) => <h2 className="md-h2" {...props} />,
    h3: (props) => <h3 className="md-h3" {...props} />,
    h4: (props) => <h4 className="md-h4" {...props} />,
    h5: (props) => <h5 className="md-h5" {...props} />,
    h6: (props) => <h6 className="md-h6" {...props} />,
    p: (props) => <p className="md-p" {...props} />,
    ul: (props) => <ul className="md-list" {...props} />,
    ol: (props) => <ol className="md-list md-list-ordered" {...props} />,
    blockquote: (props) => <blockquote className="md-quote" {...props} />,
    hr: (props) => <hr className="md-hr" {...props} />,
    table: (props) => (
      <div className="md-table-scroll">
        <table className="md-table" {...props} />
      </div>
    ),
    img: ({ src, alt, ...rest }) => {
      // Crawled bodies reference local mirror paths that never resolve.
      if (typeof src === 'string' && src.startsWith('/img/')) {
        return <span className="md-image-placeholder">{alt || 'image'}</span>;
      }
      return <img className="md-image" src={src} alt={alt ?? ''} loading="lazy" {...rest} />;
    },
    a: ({ href, children, ...rest }) => {
      const docHref = href ? resolveDocLink(href, docBase) : null;
      if (docHref) {
        return <a href={docHref} data-doc-link="true" {...rest}>{children}</a>;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>
      );
    },
    pre: (props) => <pre className="md-pre" {...props} />,
    code: ({ className: codeClass, children, ...rest }) => {
      const language = /language-(\w+)/.exec(codeClass || '')?.[1];
      // Fenced blocks carry a language class; bare inline spans do not.
      if (!language && !codeClass) {
        return <code className="md-inline-code" {...rest}>{children}</code>;
      }
      return <code className={codeClass} data-language={language} {...rest}>{children}</code>;
    },
  }), [docBase]);

  if (!source) return null;

  return (
    <div className={`prose ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
