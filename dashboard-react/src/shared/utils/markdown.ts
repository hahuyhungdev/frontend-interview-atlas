export function markdownToText(markdown: string | undefined): string {
  return markdown?.trim() || '';
}
