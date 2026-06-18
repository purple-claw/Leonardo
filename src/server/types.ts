export interface Artifact {
  id: string;
  title: string;
  slug: string;
  type: "html" | "jsx";
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
  type: "html" | "jsx";
  desc: string;
  coverImg: string;
  category: string;
  tags: string[];
  wordCount: number;
  readTimeMin: number;
  createdAt: string;
  updatedAt: string;
}
