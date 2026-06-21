declare module "markdown-it-footnote" {
  import type MarkdownIt from "markdown-it";
  const plugin: (md: MarkdownIt) => void;
  export default plugin;
}

declare module "markdown-it-container" {
  import type MarkdownIt from "markdown-it";
  interface ContainerOptions {
    validate?: (params: string) => boolean;
    render?: (tokens: any[], idx: number) => string;
  }
  const plugin: (md: MarkdownIt, name: string, opts?: ContainerOptions) => void;
  export default plugin;
}
