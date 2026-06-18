import { Artifact, ArtifactMeta } from "./types.js";

export interface DBAdapter {
  init(): Promise<void>;
  list(): Promise<ArtifactMeta[]>;
  get(id: string): Promise<Artifact | null>;
  create(data: {
    title: string;
    type: "html" | "jsx";
    content: string;
    desc?: string;
    slug?: string;
    coverImg?: string;
    category?: string;
    tags?: string[];
  }): Promise<Artifact>;
  update(
    id: string,
    data: Partial<{
      title: string;
      slug: string;
      type: "html" | "jsx";
      content: string;
      desc: string;
      coverImg: string;
      category: string;
      tags: string[];
    }>
  ): Promise<Artifact | null>;
  del(id: string): Promise<boolean>;
}
