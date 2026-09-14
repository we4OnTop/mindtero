import { AlertTriangle, ChevronDown, Crosshair, Search, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
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
import { cn } from '@/lib/utils'
import { findGaps } from './argument'
import { useCanvasUi } from './canvas-ui'
import { DetailSwitch } from './detail-switch'
import { useBoards } from './store'

function useQuestions(): { id: string; code: string; text: string }[] {
  // Unchanged nodes keep their identity across board updates, so a shallow
  // compare only re-renders when a question itself changes.
  const nodes = useBoards(
    useShallow((state) => {
      const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
      return (board?.nodes ?? []).filter((node) => node.type === 'question')
    }),
  )
  return nodes.flatMap((node) =>
    node.type === 'question' ? [{ id: node.id, code: node.data.code, text: node.data.text }] : [],
  )
}

function useGapCount(): number {
  return useBoards((state) => {
    const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
    return board ? findGaps(board.nodes, board.edges).length : 0
  })
}

/** Bottom bar: how much of the board to show, and which lens to look through. */
export function ViewBar() {
  const showGaps = useCanvasUi((state) => state.showGaps)
  const setShowGaps = useCanvasUi((state) => state.setShowGaps)
  const focusQuestion = useCanvasUi((state) => state.focusQuestion)
  const setFocusQuestion = useCanvasUi((state) => state.setFocusQuestion)
  const setSearchOpen = useCanvasUi((state) => state.setSearchOpen)
  const questions = useQuestions()
  const gapCount = useGapCount()
  const focused = questions.find((question) => question.id === focusQuestion)

  return (
    <div className="flex items-center gap-1.5">
      <DetailSwitch />

      <div className="bg-card/95 flex items-center gap-0.5 rounded-xl border p-1 shadow-sm backdrop-blur">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-pressed={showGaps}
              onClick={() => setShowGaps(!showGaps)}
              className={cn(
                'text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
                showGaps && 'bg-secondary text-foreground',
              )}
            >
              <AlertTriangle className={gapCount ? 'text-amber-500' : undefined} />
              Gaps
              <span className="bg-muted rounded-full px-1.5 text-[10px] tabular-nums">{gapCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Highlights claims without evidence, open research questions and sources you have not used yet.
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-0.5 !h-4" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 max-w-52 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
                focused && 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
              )}
            >
              <Crosshair />
              <span className="truncate">{focused ? `Focus: ${focused.code}` : 'Questions'}</span>
              <ChevronDown />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Show only what belongs to…</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {questions.length === 0 && (
              <p className="text-muted-foreground px-2 py-1.5 text-xs">
                No research questions yet — add one with the question tool (Q) and connect claims to it.
              </p>
            )}
            {questions.map((question) => (
              <DropdownMenuItem
                key={question.id}
                onSelect={() => setFocusQuestion(question.id)}
                className="flex-col items-start gap-0"
              >
                <span className="font-medium">
                  {question.code}
                  {question.id === focusQuestion && ' ✓'}
                </span>
                <span className="text-muted-foreground line-clamp-2 text-xs">{question.text || 'Untitled question'}</span>
              </DropdownMenuItem>
            ))}
            {focused && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setFocusQuestion(null)}>
                  <X /> Show the whole board
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {focused && (
          <Button size="icon-xs" variant="ghost" aria-label="Clear question focus" onClick={() => setFocusQuestion(null)}>
            <X />
          </Button>
        )}

        <Separator orientation="vertical" className="mx-0.5 !h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5"
            >
              <Search /> Search
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Search this board — text, citations, tags (<kbd className="bg-muted rounded px-1">Ctrl</kbd>+
            <kbd className="bg-muted rounded px-1">F</kbd>)
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
