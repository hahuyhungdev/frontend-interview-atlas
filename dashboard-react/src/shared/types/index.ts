export interface CrawledPost {
  title: string;
  company?: string;
  salary?: string;
  date?: string;
  role?: string;
  content_markdown: string;
  original_url: string;
  freedium_url: string;
  tags?: string[];
}

export interface DocSummary {
  slug: string;
  title: string;
  group: string;
}

export interface DocDetail extends DocSummary {
  markdown: string;
}
