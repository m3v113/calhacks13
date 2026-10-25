"use client";
import { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

// Older writing sections were plain text; turn them into paragraphs.
function toHtml(text: string) {
  if (!text.trim() || text.trim().startsWith("<")) return text;
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n/).map((l) => `<p>${esc(l)}</p>`).join("");
}

const TOOLS = [
  { label: "Bold", short: "B", run: "toggleBold", active: "bold", style: { fontWeight: 700 } },
  { label: "Italic", short: "I", run: "toggleItalic", active: "italic", style: { fontStyle: "italic" } },
  { label: "Heading", short: "H1", run: "h1", active: "h1" },
  { label: "Subheading", short: "H2", run: "h2", active: "h2" },
  { label: "List", short: "•", run: "toggleBulletList", active: "bulletList" },
  { label: "Numbered list", short: "1.", run: "toggleOrderedList", active: "orderedList" },
] as const;

// A writing section: formatted text with a small toolbar that shows while you're writing. Saves as you type.
export default function Writing({ value, onSave, label }: { value: string; onSave: (html: string) => void; label: string }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saved = useRef(value);
  const save = (html: string) => {
    clearTimeout(timer.current);
    if (html !== saved.current) { saved.current = html; onSave(html); }
  };
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } } })],
    content: toHtml(value),
    immediatelyRender: false,
    editorProps: { attributes: { class: "writing-text", "aria-label": label, "data-placeholder": "Write here" } },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => save(html), 700);
    },
    onBlur: ({ editor }) => save(editor.isEmpty ? "" : editor.getHTML()),
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }),
      bulletList: e.isActive("bulletList"), orderedList: e.isActive("orderedList"), empty: e.isEmpty,
    } : null,
  });

  const run = (cmd: (typeof TOOLS)[number]["run"]) => {
    if (!editor) return;
    const c = editor.chain().focus();
    if (cmd === "h1") c.toggleHeading({ level: 1 }).run();
    else if (cmd === "h2") c.toggleHeading({ level: 2 }).run();
    else c[cmd]().run();
  };

  return (
    <div className={`writing ${state?.empty ? "empty" : ""}`}>
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button key={t.label} aria-label={t.label} data-tip={t.label} aria-pressed={!!state?.[t.active]} className={state?.[t.active] ? "on" : ""}
            style={"style" in t ? t.style : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => run(t.run)}>
            {t.short}
          </button>
        ))}
      </div>
      {/* Pressing a link opens it in a new tab, instead of putting the cursor in it. (On press, not on click:
          focusing the editor shows the toolbar, which moves the text before the click lands.) */}
      <div onMouseDownCapture={(e) => {
        const href = e.button === 0 ? (e.target as HTMLElement).closest("a")?.href : null;
        if (href) { e.preventDefault(); e.stopPropagation(); window.open(href, "_blank", "noopener,noreferrer"); }
      }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
