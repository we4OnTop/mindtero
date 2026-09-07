import { useReactFlow } from '@xyflow/react'
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Download,
  FileJson,
  Frame,
  Image,
  ImagePlus,
  LayoutGrid,
  Maximize2,
  Quote,
  Redo2,
  Route,
  StickyNote,
  Undo2,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useZoteroSource } from '@/features/zotero/provider'
import { useSettings } from '@/lib/settings'
import { createImageNode } from './factory'
import { EDGE_SHAPES, EDGE_SHAPE_LABELS, type EdgeShape } from './types'
import { createFrameNode, createNoteNode, NODE_SIZE } from './factory'
import { bibliographyHtml, boardItemKeys, downloadBlob, exportBoardJson, exportBoardPng, slugify } from './export'
import { layoutGraph, layoutGrid, type LayoutDirection } from './layout'
import { useActiveBoard, useBoards } from './store'
import type { MindEdge, MindNode } from './types'

export function GraphToolbar() {
  const board = useActiveBoard()
  const addNodes = useBoards((state) => state.addNodes)
  const setNodes = useBoards((state) => state.setNodes)
  const commit = useBoards((state) => state.commit)
  const undo = useBoards((state) => state.undo)
  const redo = useBoards((state) => state.redo)
  const canUndo = useBoards((state) => state.canUndo(state.activeBoardId))
  const canRedo = useBoards((state) => state.canRedo(state.activeBoardId))

  const edgeShape = useSettings((state) => state.edgeShape)
  const setEdgeShape = useSettings((state) => state.setEdgeShape)
  const viewOnly = useSettings((state) => state.viewOnly)

  const { fitView, getViewport, screenToFlowPosition } = useReactFlow<MindNode, MindEdge>()
  const source = useZoteroSource()
  const citationStyle = useSettings((state) => state.citationStyle)
  const { resolvedTheme } = useTheme()
  const [busy, setBusy] = useState(false)
  const [imageInput, setImageInput] = useState<HTMLInputElement | null>(null)

  if (!board) return null

  /** Places new nodes near the middle of what the user is currently looking at. */
  const centerOfView = () => {
    const { zoom } = getViewport()
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - 40 * zoom,
    })
  }

  const applyLayout = (direction: LayoutDirection | 'grid') => {
    commit()
    const next =
      direction === 'grid'
        ? layoutGrid(board.nodes)
        : layoutGraph(board.nodes, board.edges, { direction })
    setNodes(next)
    window.setTimeout(() => void fitView({ padding: 0.2, duration: 320 }), 30)
  }

  const exportPng = async () => {
    setBusy(true)
    try {
      await exportBoardPng(board, resolvedTheme === 'dark' ? '#0f0f0f' : '#ffffff')
      toast.success('PNG exported')
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const exportBibliography = async () => {
    const keys = boardItemKeys(board.nodes)
    if (keys.length === 0) {
      toast.info('No Zotero items on this board yet')
      return
    }
    setBusy(true)
    try {
      const entries = await source.getBibliography(keys, citationStyle)
      downloadBlob(
        new Blob([bibliographyHtml(board, entries)], { type: 'text/html' }),
        `${slugify(board.name)}-bibliography.html`,
      )
      toast.success(`Bibliography exported`, { description: `${keys.length} references, ${citationStyle}` })
    } catch (error) {
      toast.error('Could not build the bibliography', { description: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-card/95 flex items-center gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              const center = centerOfView()
              addNodes([
                createNoteNode({
                  x: center.x - NODE_SIZE.note.width / 2,
                  y: center.y - NODE_SIZE.note.height / 2,
                }),
              ])
            }}
            aria-label="Add note"
          >
            <StickyNote />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add a note — or double-click the canvas</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={viewOnly}
            onClick={() => imageInput?.click()}
            aria-label="Add image"
          >
            <ImagePlus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add an image (also used by PDF page snaps)</TooltipContent>
      </Tooltip>
      <input
        ref={setImageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const center = centerOfView()
            addNodes([
              createImageNode(
                String(reader.result),
                {
                  x: center.x - NODE_SIZE.image.width / 2,
                  y: center.y - NODE_SIZE.image.height / 2,
                },
              ),
            ])
          }
          reader.readAsDataURL(file)
        }}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              const center = centerOfView()
              addNodes([
                createFrameNode({
                  x: center.x - NODE_SIZE.frame.width / 2,
                  y: center.y - NODE_SIZE.frame.height / 2,
                }),
              ])
            }}
            aria-label="Add frame"
          >
            <Frame />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add a grouping frame</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Default line style">
                <Route /> {EDGE_SHAPE_LABELS[edgeShape]} <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Line style for new connections</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Default line style</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {EDGE_SHAPES.map((shapeOption: EdgeShape) => (
            <DropdownMenuItem
              key={shapeOption}
              onSelect={() => setEdgeShape(shapeOption)}
            >
              {EDGE_SHAPE_LABELS[shapeOption]}
              {edgeShape === shapeOption && ' ✓'}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Wand2 /> Layout <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Auto-arrange the graph</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Auto-layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => applyLayout('TB')}>
            <ArrowDown /> Top to bottom
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => applyLayout('LR')}>
            <ArrowRight /> Left to right
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => applyLayout('grid')}>
            <LayoutGrid /> Grid
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void fitView({ padding: 0.2, duration: 300 })}
            aria-label="Fit view"
          >
            <Maximize2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to screen</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon-sm" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 !h-5" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" disabled={busy}>
            <Download /> Export <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => void exportPng()}>
            <Image /> Board as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportBoardJson(board)}>
            <FileJson /> Board as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportBibliography()}>
            <Quote /> Bibliography ({citationStyle})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
