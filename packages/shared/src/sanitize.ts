export const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul"
];

export const ALLOWED_ATTR = ["alt", "href", "src", "target", "title", "rel"];

export function stripDangerousHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}
