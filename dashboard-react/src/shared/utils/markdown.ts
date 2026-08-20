/**
 * Markdown helpers.
 *
 * Rendering itself is handled by react-markdown (see shared/components/Markdown),
 * which emits React elements and disallows raw HTML, so untrusted crawled article
 * bodies are safe to render. These helpers cover the two things it does not do:
 * plain-text extraction, and rewriting cross-document links to in-app routes.
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

/**
 * Turns a relative link to another Markdown document into an in-app docs route.
 * Returns null when the href is not a relative .md reference.
 */
export function resolveDocLink(raw: string, docBase = ''): string | null {
  if (!/^\.{0,2}\/?[\w./-]+\.md(#.*)?$/.test(raw)) return null;
  try {
    const base = `http://docs.local/${docBase ? `${docBase}/` : ''}`;
    const resolved = new URL(raw, base);
    const slug = resolved.pathname.replace(/^\//, '').replace(/\.md$/, '');
    return slug ? `/docs/${slug}${resolved.hash}` : null;
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
