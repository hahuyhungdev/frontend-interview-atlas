import React from 'react';

/**
 * Minimal, dependency-free Markdown renderer that emits React elements.
 *
 * It deliberately never uses dangerouslySetInnerHTML: crawled article bodies are
 * untrusted third-party content, and returning React nodes means text is escaped
 * by React itself. Link and image URLs are additionally scheme-checked, which is
 * the one place React does not protect you.
 */

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

export function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw, window.location.origin);
    return SAFE_PROTOCOLS.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Strips Markdown syntax down to plain text, for previews and search. */
export function markdownToText(markdown: string | undefined): string {
  if (!markdown) return '';
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- inline pass

const INLINE_PATTERN =
  /(!?\[[^\]]*\]\([^)\s]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${index++}`;

    if (token.startsWith('![')) {
      const parsed = /!\[([^\]]*)\]\(([^)\s]+)\)/.exec(token);
      const href = parsed ? safeUrl(parsed[2]) : null;
      // Crawler output references local mirror paths that do not resolve; show alt text.
      nodes.push(
        href && !parsed![2].startsWith('/img/')
          ? <img key={key} src={href} alt={parsed![1]} loading="lazy" className="md-image" />
          : <span key={key} className="md-image-placeholder">{parsed?.[1] || 'image'}</span>
      );
    } else if (token.startsWith('[')) {
      const parsed = /\[([^\]]*)\]\(([^)\s]+)\)/.exec(token);
      const href = parsed ? safeUrl(parsed[2]) : null;
      nodes.push(
        href
          ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{parsed![1]}</a>
          : <span key={key}>{parsed?.[1] ?? token}</span>
      );
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// ----------------------------------------------------------------- block pass

function splitTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');
}

export function renderMarkdown(markdown: string | undefined): React.ReactNode[] {
  if (!markdown) return [];

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  const nextKey = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^\s*```/.test(line)) {
      const language = line.replace(/^\s*```/, '').trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={nextKey()} className="md-pre" data-language={language || undefined}>
          <code>{body.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level, 6)}` as 'h1';
      const k = nextKey();
      blocks.push(
        <Tag key={k} className={`md-h${level}`}>{renderInline(heading[2], k)}</Tag>
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={nextKey()} className="md-hr" />);
      i += 1;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      const k = nextKey();
      blocks.push(
        <div key={k} className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>{headers.map((cell, c) => <th key={c}>{renderInline(cell, `${k}-h${c}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => <td key={c}>{renderInline(cell, `${k}-${r}-${c}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      const k = nextKey();
      blocks.push(
        <blockquote key={k} className="md-quote">{renderInline(body.join(' '), k)}</blockquote>
      );
      continue;
    }

    // Lists (unordered and ordered)
    const listMatch = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: React.ReactNode[] = [];
      const k = nextKey();
      let itemIndex = 0;

      while (i < lines.length) {
        const current = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!current || /\d+\./.test(current[2]) !== ordered) break;

        const content = [current[3]];
        i += 1;
        // Absorb wrapped continuation lines that are not new list items.
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
          !/^(#{1,6})\s+/.test(lines[i]) &&
          !/^\s*```/.test(lines[i])
        ) {
          content.push(lines[i].trim());
          i += 1;
        }
        items.push(<li key={itemIndex}>{renderInline(content.join(' '), `${k}-l${itemIndex++}`)}</li>);
      }

      blocks.push(
        ordered
          ? <ol key={k} className="md-list md-list-ordered">{items}</ol>
          : <ul key={k} className="md-list">{items}</ul>
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^(\s*)([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*(---|\*\*\*|___)\s*$/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    if (paragraph.length > 0) {
      const k = nextKey();
      blocks.push(<p key={k} className="md-p">{renderInline(paragraph.join(' '), k)}</p>);
    }
  }

  return blocks;
}

