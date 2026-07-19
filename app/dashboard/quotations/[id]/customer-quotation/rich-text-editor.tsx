"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
} from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string, text: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-32 px-3 py-2 text-sm leading-6 text-zinc-800 outline-none dark:text-zinc-200 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML(), currentEditor.getText());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-40 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
    );
  }

  const toolbarButton = (
    label: string,
    active: boolean,
    action: () => void,
    icon: React.ReactNode,
  ) => (
    <Button
      aria-label={label}
      className={cn("size-8 rounded-md", active && "bg-zinc-200 dark:bg-zinc-800")}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
      onClick={action}
    >
      {icon}
    </Button>
  );

  return (
    <div className="overflow-hidden rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/70">
        {toolbarButton(
          "Bold",
          editor.isActive("bold"),
          () => editor.chain().focus().toggleBold().run(),
          <BoldIcon className="size-4" />,
        )}
        {toolbarButton(
          "Italic",
          editor.isActive("italic"),
          () => editor.chain().focus().toggleItalic().run(),
          <ItalicIcon className="size-4" />,
        )}
        {toolbarButton(
          "Underline",
          editor.isActive("underline"),
          () => editor.chain().focus().toggleUnderline().run(),
          <UnderlineIcon className="size-4" />,
        )}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        {toolbarButton(
          "Medium text",
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          <Heading3Icon className="size-4" />,
        )}
        {toolbarButton(
          "Large text",
          editor.isActive("heading", { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          <Heading2Icon className="size-4" />,
        )}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        {toolbarButton(
          "Bullet list",
          editor.isActive("bulletList"),
          () => editor.chain().focus().toggleBulletList().run(),
          <ListIcon className="size-4" />,
        )}
        {toolbarButton(
          "Numbered list",
          editor.isActive("orderedList"),
          () => editor.chain().focus().toggleOrderedList().run(),
          <ListOrderedIcon className="size-4" />,
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
