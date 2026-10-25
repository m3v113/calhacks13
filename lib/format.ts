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

// A list the AI wrote as one paragraph ("1. Do this. 2. Do that.") as separate lines.
export const splitList = (t: string) =>
  t.split(/\n+|\s*(?:^|\s)\d{1,2}[.)]\s+|\s+[-•*]\s+/).map((x) => x.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
