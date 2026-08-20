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

export interface QuestionItem {
  category: string;
  company?: string;
  role?: string;
  question: string;
  solution?: string;
  source_title: string;
}

export interface SalaryInsight {
  company: string;
  role: string;
  salary: string;
}

export interface SynthesisData {
  salary_insights?: SalaryInsight[];
  all_questions?: QuestionItem[];
}

export interface KnowledgeEntry {
  title: string;
  summary: string;
  concepts: string[];
  source_title: string;
  source_url: string;
  code: string;
}

export interface KnowledgeCategory {
  id: string;
  title: string;
  summary: string;
  takeaways: string[];
  entries: KnowledgeEntry[];
}

export interface KnowledgeLibrary {
  overview: string;
  categories: KnowledgeCategory[];
  generated_at: string;
  model: string;
  source_count: number;
}
