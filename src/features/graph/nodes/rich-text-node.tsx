import { NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  PenLine,
  Quote,
  Strikethrough,
  Trash2,
  Underline,
} from 'lucide-react'
import { memo, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { accentClasses } from '../accents'
import { useBoards } from '../store'
import type { RichTextNode } from '../types'
import { AccentMenuItems } from './accent-menu'
import { EdgeZones } from './handles'
import { NodeTags } from './node-tags'
import { WidthResizer } from './width-resizer'

function FormatButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      size="icon-xs"
      variant={active ? 'secondary' : 'ghost'}
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep focus (and the selection) inside the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function FormatBar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      quote: current.isActive('blockquote'),
    }),
  })
  const chain = () => editor.chain().focus()
  return (
    <>
      <FormatButton label="Heading" active={state.h1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </FormatButton>
      <FormatButton label="Subheading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </FormatButton>
      <FormatButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </FormatButton>
      <FormatButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </FormatButton>
      <FormatButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline />
      </FormatButton>
      <FormatButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </FormatButton>
      <FormatButton label="Bullet list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </FormatButton>
      <FormatButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered />
      </FormatButton>
      <FormatButton label="Quote block" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote />
      </FormatButton>
      <Separator orientation="vertical" className="mx-0.5 !h-4" />
    </>
  )
}

/**
 * A formatted text block (headings, emphasis, lists, quotes) for argument
 * outlines and longer syntheses. Content is stored as ProseMirror JSON, so the
 * schema decides what can exist in a board file — no raw HTML is ever rendered.
 */
function RichTextNodeComponent({ id, data, selected }: NodeProps<RichTextNode>) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const accents = accentClasses(data.accent)
  const [editing, setEditing] = useState(!data.doc && !viewOnly)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        // Links open through the app's external-link guard, never by navigating.
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto', 'zotero'] },
      }),
      Placeholder.configure({ placeholder: 'Write an argument, outline or synthesis…' }),
    ],
    content: data.doc ?? '',
    editable: editing && !viewOnly,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: current }) => updateNodeData(id, { doc: current.getJSON() }),
    onBlur: ({ event }) => {
      // Clicks on the format bar keep editing; anything else ends it.
      const next = event.relatedTarget as HTMLElement | null
      if (next?.closest('[data-rich-text-toolbar]')) return
      setEditing(false)
    },
  })

  // Board-level undo/redo replaces `data.doc` underneath a mounted editor.
  useEffect(() => {
    if (!editor || editing) return
    if (!data.doc) {
      if (!editor.isEmpty) editor.commands.setContent('', { emitUpdate: false })
      return
    }
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(data.doc)) {
      editor.commands.setContent(data.doc, { emitUpdate: false })
    }
  }, [editor, editing, data.doc])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editing && !viewOnly)
    if (editing && !viewOnly) editor.commands.focus('end')
  }, [editor, editing, viewOnly])

  return (
    <>
      <WidthResizer visible={selected && !viewOnly} minWidth={220} onResizeStart={commit} />

      <NodeToolbar isVisible={selected || editing} position={Position.Top} offset={8}>
        <div data-rich-text-toolbar className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          {editing && editor ? (
            <FormatBar editor={editor} />
          ) : (
            <Button size="xs" variant="ghost" disabled={viewOnly} onClick={() => setEditing(true)}>
              <PenLine /> Edit
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Block colour">
                <span className={cn('size-3 rounded-full', accents.dot)} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <AccentMenuItems value={data.accent} onSelect={(accent) => updateNodeData(id, { accent })} />
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={viewOnly}
            onClick={() => removeNodes([id])}
            aria-label="Delete text block"
          >
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <div
        className={cn(
          'bg-card text-card-foreground w-full rounded-xl border px-4 py-3 shadow-sm',
          data.accent && data.accent !== 'neutral' && accents.soft,
          selected && 'ring-primary/60 ring-2',
          // While editing, pointer and wheel belong to the text, not the canvas.
          editing && 'nodrag nowheel cursor-text',
        )}
        onDoubleClick={(event) => {
          event.stopPropagation()
          if (!viewOnly) setEditing(true)
        }}
      >
        <EditorContent editor={editor} className="mindtero-prose" />
        {!editing && <NodeTags id={id} own={data.tags} />}
      </div>

      <EdgeZones />
    </>
  )
}

export const RichTextNodeView = memo(RichTextNodeComponent)
