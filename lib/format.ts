// Small text helpers shared by the page's AI results.
export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const host = (link: string) => { try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return link; } };

// A line from the AI as safe HTML: *italic* and **bold** (as the AI writes them), and web addresses as links.
export const richText = (t: string) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g, "$1<em>$2</em>")
  .replace(/(https?:\/\/[^\s<]+[^\s<.,;)])/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');

// Citations as paragraphs, for a Writing section.
export const citationsHtml = (items: string[]) => items.map((c) => `<p>${richText(c)}</p>`).join("");
