import { renderMarkdown } from '../../utils/markdown';

interface MarkdownProps {
  source: string | undefined;
  className?: string;
}

/** Renders Markdown as React elements. See utils/markdown for the safety notes. */
export function Markdown({ source, className = '' }: MarkdownProps) {
  return <div className={`prose ${className}`.trim()}>{renderMarkdown(source)}</div>;
}

export default Markdown;
