"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { useState, useCallback, useRef, useEffect } from "react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
}

// Google Transliteration API (free, no key needed)
async function transliterate(word: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=te-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`
    );
    const data = await res.json();
    if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.length > 0) {
      return data[1][0][1];
    }
  } catch (e) {}
  return [word];
}

export function RichEditor({ content, onChange }: RichEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [inputMode, setInputMode] = useState<"telugu" | "english">("telugu");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentWord, setCurrentWord] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      TiptapImage.configure({ inline: false, allowBase64: true }),
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing your article..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Highlight,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "tiptap-editor" },
      handleKeyDown: (view, event) => {
        if (inputMode !== "telugu") return false;

        // On space or enter, transliterate the last word
        if (event.key === " " || event.key === "Enter") {
          const { state } = view;
          const { from } = state.selection;
          const textBefore = state.doc.textBetween(Math.max(0, from - 30), from, " ");
          const words = textBefore.split(/\s/);
          const lastWord = words[words.length - 1];

          if (lastWord && /^[a-zA-Z]+$/.test(lastWord)) {
            event.preventDefault();
            transliterate(lastWord).then((results) => {
              if (results.length > 0 && results[0] !== lastWord) {
                const tr = view.state.tr;
                const wordStart = from - lastWord.length;
                tr.replaceWith(wordStart, from, view.state.schema.text(results[0]));
                if (event.key === " ") {
                  tr.insertText(" ");
                } else {
                  // Enter - add new paragraph
                  const { $from } = tr.selection;
                  const after = $from.after();
                  tr.split(after);
                }
                view.dispatch(tr);
                onChange(view.state.doc.content.toString());
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Handle image file upload (drag & drop or file picker)
  const handleImageUpload = useCallback((file: File) => {
    if (!editor || !file.type.startsWith("image/")) return;

    // Convert to base64 for now (will switch to Cloudinary/S3 later)
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  // Handle drag & drop on editor
  useEffect(() => {
    if (!editor) return;
    const editorEl = document.querySelector(".tiptap-editor");
    if (!editorEl) return;

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files?.length) {
        handleImageUpload(files[0]);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      editorEl.classList.add("drag-over");
    };

    const handleDragLeave = () => {
      editorEl.classList.remove("drag-over");
    };

    editorEl.addEventListener("drop", handleDrop as any);
    editorEl.addEventListener("dragover", handleDragOver as any);
    editorEl.addEventListener("dragleave", handleDragLeave as any);

    return () => {
      editorEl.removeEventListener("drop", handleDrop as any);
      editorEl.removeEventListener("dragover", handleDragOver as any);
      editorEl.removeEventListener("dragleave", handleDragLeave as any);
    };
  }, [editor, handleImageUpload]);

  const addImageFromUrl = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl("");
      setShowImageInput(false);
    }
  }, [editor, imageUrl]);

  const setLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkInput(false);
    }
  }, [editor, linkUrl]);

  if (!editor) return null;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Input Mode Switcher */}
      <div style={{ padding: "8px 14px", background: "#111827", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <ModeBtn active={inputMode === "telugu"} onClick={() => setInputMode("telugu")} label="EN → తెలుగు" />
          <ModeBtn active={inputMode === "english"} onClick={() => setInputMode("english")} label="English" />
        </div>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {inputMode === "telugu"
            ? "Type English, press Space → auto Telugu (e.g. 'namaste' → నమస్తే)"
            : "Standard English typing"}
        </span>
      </div>

      {/* Formatting Toolbar */}
      <div style={{ borderBottom: "1px solid #e5e7eb", padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 2, background: "#fafafa" }}>
        <TG>
          <TB on={editor.isActive("bold")} fn={() => editor.chain().focus().toggleBold().run()} t="Bold (Ctrl+B)"><b>B</b></TB>
          <TB on={editor.isActive("italic")} fn={() => editor.chain().focus().toggleItalic().run()} t="Italic (Ctrl+I)"><i>I</i></TB>
          <TB on={editor.isActive("underline")} fn={() => editor.chain().focus().toggleUnderline().run()} t="Underline"><u>U</u></TB>
          <TB on={editor.isActive("strike")} fn={() => editor.chain().focus().toggleStrike().run()} t="Strike"><s>S</s></TB>
          <TB on={editor.isActive("highlight")} fn={() => editor.chain().focus().toggleHighlight().run()} t="Highlight">
            <span style={{ background: "#fef08a", padding: "0 3px", borderRadius: 2 }}>H</span>
          </TB>
        </TG>
        <D />
        <TG>
          <TB on={editor.isActive("heading", { level: 2 })} fn={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} t="Heading 2">H2</TB>
          <TB on={editor.isActive("heading", { level: 3 })} fn={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} t="Heading 3">H3</TB>
          <TB on={editor.isActive("heading", { level: 4 })} fn={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} t="Heading 4">H4</TB>
        </TG>
        <D />
        <TG>
          <TB on={editor.isActive("bulletList")} fn={() => editor.chain().focus().toggleBulletList().run()} t="Bullets">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
          </TB>
          <TB on={editor.isActive("orderedList")} fn={() => editor.chain().focus().toggleOrderedList().run()} t="Numbers">1.</TB>
          <TB on={editor.isActive("blockquote")} fn={() => editor.chain().focus().toggleBlockquote().run()} t="Quote">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
          </TB>
        </TG>
        <D />
        <TG>
          <TB on={editor.isActive({ textAlign: "left" })} fn={() => editor.chain().focus().setTextAlign("left").run()} t="Left">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M3 10h12M3 14h18M3 18h12"/></svg>
          </TB>
          <TB on={editor.isActive({ textAlign: "center" })} fn={() => editor.chain().focus().setTextAlign("center").run()} t="Center">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M6 10h12M3 14h18M6 18h12"/></svg>
          </TB>
        </TG>
        <D />
        <TG>
          <TB on={false} fn={() => setShowLinkInput(!showLinkInput)} t="Link">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round"/></svg>
          </TB>
          <TB on={false} fn={() => setShowImageInput(!showImageInput)} t="Image URL">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>
          </TB>
          <TB on={false} fn={() => fileInputRef.current?.click()} t="Upload Image">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </TB>
          <TB on={false} fn={() => editor.chain().focus().setHorizontalRule().run()} t="Divider">—</TB>
        </TG>
        <D />
        <TG>
          <TB on={false} fn={() => editor.chain().focus().undo().run()} t="Undo">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h10a5 5 0 015 5 5 5 0 01-5 5H3" strokeLinecap="round"/><path d="M7 6l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </TB>
          <TB on={false} fn={() => editor.chain().focus().redo().run()} t="Redo">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10H11a5 5 0 00-5 5 5 5 0 005 5h10" strokeLinecap="round"/><path d="M17 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </TB>
        </TG>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); e.target.value = ""; }}
      />

      {/* Link input bar */}
      {showLinkInput && (
        <div style={{ padding: "8px 12px", background: "#f0f9ff", borderBottom: "1px solid #bae6fd", display: "flex", gap: 8 }}>
          <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." onKeyDown={(e) => e.key === "Enter" && setLink()} autoFocus
            style={{ flex: 1, padding: "6px 10px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 13, outline: "none" }} />
          <button onClick={setLink} style={{ padding: "6px 14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
          <button onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false); }} style={{ padding: "6px 14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Remove</button>
          <button onClick={() => setShowLinkInput(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Image input bar */}
      {showImageInput && (
        <div style={{ padding: "8px 12px", background: "#f0fdf4", borderBottom: "1px solid #86efac", display: "flex", gap: 8, alignItems: "center" }}>
          <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (https://...)" onKeyDown={(e) => e.key === "Enter" && addImageFromUrl()} autoFocus
            style={{ flex: 1, padding: "6px 10px", border: "1px solid #86efac", borderRadius: 6, fontSize: 13, outline: "none" }} />
          <button onClick={addImageFromUrl} style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Insert</button>
          <span style={{ color: "#aaa", fontSize: 12 }}>or</span>
          <button onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 14px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Upload from Device
          </button>
          <button onClick={() => setShowImageInput(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Bubble Menu (Medium style - appears on text selection) */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <div style={{ display: "flex", gap: 1, background: "#1f2937", borderRadius: 8, padding: "4px 6px", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
          <BB on={editor.isActive("bold")} fn={() => editor.chain().focus().toggleBold().run()}><b>B</b></BB>
          <BB on={editor.isActive("italic")} fn={() => editor.chain().focus().toggleItalic().run()}><i>I</i></BB>
          <BB on={editor.isActive("underline")} fn={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></BB>
          <BB on={editor.isActive("highlight")} fn={() => editor.chain().focus().toggleHighlight().run()}>H</BB>
          <span style={{ width: 1, background: "#4b5563", margin: "0 3px" }} />
          <BB on={editor.isActive("heading", { level: 2 })} fn={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</BB>
          <BB on={editor.isActive("heading", { level: 3 })} fn={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</BB>
          <span style={{ width: 1, background: "#4b5563", margin: "0 3px" }} />
          <BB on={editor.isActive("link")} fn={() => setShowLinkInput(true)}>
            <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round"/></svg>
          </BB>
        </div>
      </BubbleMenu>

      {/* Floating Menu (Medium's + button on empty lines) */}
      <FloatingMenu editor={editor} tippyOptions={{ duration: 150 }}>
        <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <FB fn={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} t="Heading">H2</FB>
          <FB fn={() => editor.chain().focus().toggleBulletList().run()} t="List">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/></svg>
          </FB>
          <FB fn={() => editor.chain().focus().toggleBlockquote().run()} t="Quote">
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
          </FB>
          <FB fn={() => fileInputRef.current?.click()} t="Upload Image">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>
          </FB>
          <FB fn={() => editor.chain().focus().setHorizontalRule().run()} t="Divider">—</FB>
        </div>
      </FloatingMenu>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Drag & drop overlay hint */}
      <style>{`
        .tiptap-editor { min-height: 500px; padding: 32px 40px; font-size: 18px; line-height: 1.9; color: #1a1a1a; outline: none; font-family: "Noto Sans Telugu", Georgia, serif; position: relative; }
        .tiptap-editor > .tiptap { min-height: 500px; outline: none; }
        .tiptap-editor.drag-over::after { content: "Drop image here"; position: absolute; inset: 0; background: rgba(59,130,246,0.08); border: 3px dashed #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #3b82f6; font-weight: 700; pointer-events: none; z-index: 10; }
        .tiptap-editor p { margin-bottom: 18px; }
        .tiptap-editor h2 { font-size: 28px; font-weight: 800; margin: 40px 0 16px; color: #000; line-height: 1.3; }
        .tiptap-editor h3 { font-size: 22px; font-weight: 700; margin: 32px 0 12px; color: #111; }
        .tiptap-editor h4 { font-size: 19px; font-weight: 700; margin: 24px 0 10px; color: #222; }
        .tiptap-editor blockquote { border-left: 4px solid #FF2C2C; padding-left: 20px; margin: 28px 0; font-style: italic; color: #555; }
        .tiptap-editor img { max-width: 100%; border-radius: 8px; margin: 28px auto; display: block; box-shadow: 0 2px 12px rgba(0,0,0,0.1); cursor: pointer; }
        .tiptap-editor img:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .tiptap-editor img.ProseMirror-selectednode { outline: 3px solid #3b82f6; outline-offset: 2px; }
        .tiptap-editor a { color: #3b82f6; text-decoration: underline; }
        .tiptap-editor ul, .tiptap-editor ol { padding-left: 28px; margin: 16px 0; }
        .tiptap-editor li { margin-bottom: 8px; }
        .tiptap-editor hr { border: none; border-top: 2px solid #eee; margin: 40px 0; }
        .tiptap-editor mark { background: #fef08a; padding: 0 3px; border-radius: 2px; }
        .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #bbb; float: left; pointer-events: none; height: 0; font-size: 18px; }
      `}</style>
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
      fontSize: 12, fontWeight: 700,
      background: active ? "#FF2C2C" : "#374151", color: active ? "#fff" : "#9ca3af",
    }}>{label}</button>
  );
}
function TB({ on, fn, t, children }: { on: boolean; fn: () => void; t: string; children: React.ReactNode }) {
  return <button onClick={fn} title={t} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 700, background: on ? "#e5e7eb" : "transparent", color: on ? "#111" : "#666" }}>{children}</button>;
}
function BB({ on, fn, children }: { on: boolean; fn: () => void; children: React.ReactNode }) {
  return <button onClick={fn} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700, background: on ? "#4b5563" : "transparent", color: "#fff" }}>{children}</button>;
}
function FB({ fn, t, children }: { fn: () => void; t: string; children: React.ReactNode }) {
  return <button onClick={fn} title={t} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "#666" }}>{children}</button>;
}
function D() { return <div style={{ width: 1, height: 22, background: "#e5e7eb", margin: "0 5px", alignSelf: "center" }} />; }
function TG({ children }: { children: React.ReactNode }) { return <div style={{ display: "flex", gap: 1 }}>{children}</div>; }
