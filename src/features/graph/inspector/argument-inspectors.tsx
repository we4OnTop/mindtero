import { AlertTriangle, Crosshair, Hash, Plus, Scale, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { claimEvidence, findGaps, isEvidence, questionScope, type GapSeverity } from '../argument'
import { cardLabel, normalizeTag, tagCounts } from '../board-search'
import { useCanvasUi } from '../canvas-ui'
import { CLAIM_STATUS } from '../claim-status'
import { useActiveBoard, useBoards } from '../store'
import type { ClaimNode, MindNode, QuestionNode } from '../types'
import { useFocusNode } from '../use-focus-node'

const NO_TAGS: string[] = []

/**
 * Board tags for one card. Tags inherited from a tag group are listed separately:
 * they belong to the group, so they are changed by moving the card, not here.
 */
export function TagEditor({ node }: { node: MindNode }) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const board = useActiveBoard()
  const viewOnly = useSettings((state) => state.viewOnly)
  const inherited = useCanvasUi((state) => state.inheritedTags.get(node.id) ?? NO_TAGS)
  const [draft, setDraft] = useState('')
  const own = ((node.data as { tags?: string[] }).tags ?? []).filter(Boolean)
  const suggestions = useMemo(() => (board ? tagCounts(board.nodes).map((entry) => entry.tag) : []), [board])

  const setTags = (tags: string[]) => updateNodeData(node.id, { tags: tags.length ? tags : undefined } as Partial<MindNode['data']>)
  const add = (raw: string) => {
    const additions = raw.split(',').map(normalizeTag).filter(Boolean)
    const known = new Set(own.map((tag) => tag.toLowerCase()))
    const fresh = additions.filter((tag) => !known.has(tag.toLowerCase()))
    if (fresh.length) setTags([...own, ...fresh])
    setDraft('')
  }
  const listId = `tag-suggestions-${node.id}`

  return (
    <section className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">Tags</Label>
      <div className="flex flex-wrap gap-1">
        {own.map((tag) => (
          <span key={tag} className="bg-secondary inline-flex items-center gap-0.5 rounded-full py-0.5 pr-1 pl-2 text-xs">
            <Hash className="size-3" />
            {tag}
            {!viewOnly && (
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => setTags(own.filter((entry) => entry !== tag))}
                className="hover:bg-background ml-0.5 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {inherited
          .filter((tag) => !own.some((entry) => entry.toLowerCase() === tag.toLowerCase()))
          .map((tag) => (
            <span
              key={`inherited:${tag}`}
              title="From the tag group this card sits in"
              className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
            >
              <Hash className="size-3" />
              {tag}
            </span>
          ))}
      </div>
      {!viewOnly && (
        <div className="flex gap-1.5">
          <Input
            value={draft}
            list={listId}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                add(draft)
              }
            }}
            placeholder="Add a tag…"
            className="h-7 min-w-0 flex-1 text-xs"
          />
          <datalist id={listId}>
            {suggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <Button size="icon-sm" variant="outline" aria-label="Add tag" onClick={() => add(draft)} disabled={!draft.trim()}>
            <Plus />
          </Button>
        </div>
      )}
      {inherited.length > 0 && (
        <p className="text-muted-foreground text-[11px]">Green tags come from the tag group around this card.</p>
      )}
    </section>
  )
}

function CardLink({ node, className }: { node: MindNode; className?: string }) {
  const focusNode = useFocusNode()
  return (
    <button
      type="button"
      onClick={() => focusNode(node.id)}
      className={cn('hover:bg-muted w-full rounded-md px-2 py-1 text-left text-xs leading-snug', className)}
      title="Show on the canvas"
    >
      <span className="line-clamp-2">{cardLabel(node)}</span>
    </button>
  )
}

export function ClaimInspector({ node }: { node: ClaimNode }) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const board = useActiveBoard()
  const nodes = board?.nodes ?? []
  const edges = board?.edges ?? []
  const evidence = claimEvidence(node.id, nodes, edges)
  const style = CLAIM_STATUS[evidence.status]
  const questions = nodes.filter(
    (candidate): candidate is QuestionNode =>
      candidate.type === 'question' && questionScope(candidate.id, nodes, edges).has(node.id),
  )

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Scale className="text-muted-foreground size-4" />
        <h2 className="text-base font-semibold">Claim</h2>
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', style.pill)}>{style.label}</span>
      </div>
      <Textarea
        value={node.data.text}
        onChange={(event) => updateNodeData(node.id, { text: event.target.value })}
        placeholder="What does your thesis claim?"
        className="min-h-24 text-sm"
      />

      <section className="space-y-1">
        <Label className="text-xs text-[var(--rel-supports)]">Supporting ({evidence.supporting.length})</Label>
        {evidence.supporting.map((entry) => (
          <CardLink key={entry.id} node={entry} />
        ))}
      </section>
      <section className="space-y-1">
        <Label className="text-xs text-[var(--rel-contradicts)]">Contradicting ({evidence.contradicting.length})</Label>
        {evidence.contradicting.map((entry) => (
          <CardLink key={entry.id} node={entry} />
        ))}
      </section>
      <p className="text-muted-foreground text-xs">
        Draw a line from a quote or source to this claim — it starts as “Supports”. Click the line’s label to
        switch it to “Contradicts”.
      </p>

      <section className="space-y-1">
        <Label className="text-muted-foreground text-xs">Answers</Label>
        {questions.length === 0 ? (
          <p className="text-muted-foreground text-xs">Not connected to a research question yet.</p>
        ) : (
          questions.map((question) => <CardLink key={question.id} node={question} />)
        )}
      </section>

      <TagEditor node={node} />
    </div>
  )
}

export function QuestionInspector({ node }: { node: QuestionNode }) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const focused = useCanvasUi((state) => state.focusQuestion === node.id)
  const setFocusQuestion = useCanvasUi((state) => state.setFocusQuestion)
  const board = useActiveBoard()
  const nodes = board?.nodes ?? []
  const edges = board?.edges ?? []
  const scope = questionScope(node.id, nodes, edges)
  const members = nodes.filter((candidate) => scope.has(candidate.id))
  const claims = members.filter((candidate): candidate is ClaimNode => candidate.type === 'claim')
  const sources = members.filter(isEvidence)

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Input
          value={node.data.code}
          onChange={(event) => updateNodeData(node.id, { code: event.target.value.slice(0, 12) })}
          aria-label="Question code"
          className="h-8 w-20 font-semibold"
        />
        <h2 className="text-base font-semibold">Research question</h2>
      </div>
      <Textarea
        value={node.data.text}
        onChange={(event) => updateNodeData(node.id, { text: event.target.value })}
        placeholder="Which question does your research answer?"
        className="min-h-20 text-sm"
      />
      <Button size="sm" variant={focused ? 'secondary' : 'outline'} onClick={() => setFocusQuestion(focused ? null : node.id)}>
        <Crosshair /> {focused ? 'Show the whole board' : 'Focus the board on this question'}
      </Button>

      <section className="space-y-1">
        <Label className="text-muted-foreground text-xs">Claims ({claims.length})</Label>
        {claims.map((claim) => {
          const status = CLAIM_STATUS[claimEvidence(claim.id, nodes, edges).status]
          return (
            <div key={claim.id} className="flex items-start gap-1.5">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', status.bar)} title={status.label} />
              <CardLink node={claim} />
            </div>
          )
        })}
      </section>
      <section className="space-y-1">
        <Label className="text-muted-foreground text-xs">Sources and quotes ({sources.length})</Label>
        {sources.slice(0, 30).map((source) => (
          <CardLink key={source.id} node={source} />
        ))}
      </section>
      <p className="text-muted-foreground text-xs">
        Everything connected to this card — directly, through claims, or via a connected group — belongs to
        the question.
      </p>

      <TagEditor node={node} />
    </div>
  )
}

const SEVERITY_DOT: Record<GapSeverity, string> = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/50',
}

/** The board's argument gaps, each a jump to the card. */
export function GapList() {
  const board = useActiveBoard()
  const showGaps = useCanvasUi((state) => state.showGaps)
  const setShowGaps = useCanvasUi((state) => state.setShowGaps)
  const focusNode = useFocusNode()
  if (!board) return null
  const byId = new Map(board.nodes.map((node) => [node.id, node]))
  const gaps = findGaps(board.nodes, board.edges)

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <AlertTriangle className="size-3.5" /> Argument gaps ({gaps.length})
        </Label>
        <Button size="xs" variant={showGaps ? 'secondary' : 'ghost'} className="ml-auto" onClick={() => setShowGaps(!showGaps)}>
          {showGaps ? 'Hide on canvas' : 'Show on canvas'}
        </Button>
      </div>
      {gaps.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No gaps found. Add claims (C) and research questions (Q) to check your argument.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {gaps.slice(0, 40).map((gap) => {
            const node = byId.get(gap.nodeId)
            if (!node) return null
            return (
              <li key={`${gap.nodeId}:${gap.message}`}>
                <button
                  type="button"
                  onClick={() => focusNode(gap.nodeId)}
                  className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left"
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', SEVERITY_DOT[gap.severity])} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{gap.message}</span>
                    <span className="text-muted-foreground line-clamp-1 text-[11px]">{cardLabel(node)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
