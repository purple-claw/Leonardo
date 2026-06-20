export interface Artifact {
  id: string;
  title: string;
  slug: string;
  type: "html" | "jsx" | "md";
  content: string;
  desc: string;
  coverImg: string;
  category: string;
  tags: string[];
  wordCount: number;
  readTimeMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactMeta {
  id: string;
  title: string;
  slug: string;
  type: "html" | "jsx" | "md";
  desc: string;
  coverImg: string;
  category: string;
  tags: string[];
  wordCount: number;
  readTimeMin: number;
  createdAt: string;
  updatedAt: string;
}
