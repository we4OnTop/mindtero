import { useQueryClient } from '@tanstack/react-query'
import { Camera, ExternalLink, Link2, Plus, Quote, RefreshCw, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ItemTypeIcon } from '@/components/common/item-type-icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  creatorName,
  itemTitle,
  itemTypeLabel,
  parseRelatedKeys,
  stripHtml,
  zoteroSelectUrl,
} from '@/features/zotero/format'
import { useZoteroSource } from '@/features/zotero/provider'
import {
  useItem,
  useItemAnnotations,
  useItemChildren,
  useItemsByKeys,
  zoteroKeys,
} from '@/features/zotero/queries'
import { useSettings } from '@/lib/settings'
import { createEdge, createImageNode, createItemNode, createQuoteNode, toSnapshot } from '../factory'
import { ringPositions } from '../factory'
import { fileAccessAvailable, renderPdfPage } from '../pdf-pages'
import { useBoards } from '../store'
import { nodeId, type ItemNode } from '../types'

export function ItemInspector({ node }: { node: ItemNode }) {
  const source = useZoteroSource()
  const queryClient = useQueryClient()
  const { snapshot, itemKey, comment } = node.data
  const { data: item, isLoading, isError, error } = useItem(itemKey)
  const { data: children } = useItemChildren(itemKey)
  const relatedKeys = parseRelatedKeys(item?.data.relations)
  const { data: related } = useItemsByKeys(relatedKeys)

  const updateNodeData = useBoards((state) => state.updateNodeData)
  const addNodes = useBoards((state) => state.addNodes)
  const addEdges = useBoards((state) => state.addEdges)
  const commit = useBoards((state) => state.commit)
  const viewOnly = useSettings((state) => state.viewOnly)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: zoteroKeys.item(source.id, itemKey),
        queryFn: ({ signal }) => source.getItem(itemKey, signal),
        staleTime: 0,
      })
      updateNodeData(node.id, { snapshot: toSnapshot(fresh) })
      toast.success('Snapshot refreshed from Zotero')
    } catch (err) {
      toast.error('Could not reach Zotero', { description: (err as Error).message })
    } finally {
      setRefreshing(false)
    }
  }

  const notes = (children ?? []).filter((child) => child.data.itemType === 'note')
  const attachments = (children ?? []).filter(
    (child) => child.data.itemType === 'attachment' && child.data.contentType === 'application/pdf',
  )
  const canSnapPages = fileAccessAvailable(source)
  const [snapping, setSnapping] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState('1')

  const snapPage = async (attachmentKey: string) => {
    const pageNumber = Number.parseInt(pageInput, 10) || 1
    setSnapping(attachmentKey)
    try {
      const info = await renderPdfPage(source, attachmentKey, pageNumber)
      addNodes([
        createImageNode(
          info.dataUrl,
          { x: node.position.x + 340, y: node.position.y + 40 },
          `p. ${pageNumber} — ${snapshot.title.slice(0, 60)}`,
        ),
      ])
      toast.success(`Page ${pageNumber} added to the board`)
    } catch (err) {
      toast.error('Could not render the page', { description: (err as Error).message })
    } finally {
      setSnapping(null)
    }
  }

  // --- highlight picker: only checked annotations become quote cards ---
  const { data: meatyAnnotations, isLoading: loadingAnnotations } = useItemAnnotations(itemKey)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const toggleKey = (key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const addQuotes = () => {
    const picked = (meatyAnnotations ?? []).filter((annotation) => selectedKeys.has(annotation.key))
    if (picked.length === 0) return
    commit()
    const origin = { x: node.position.x, y: node.position.y }
    const positions = ringPositions(origin, picked.length)
    const nodes = picked.map((annotation, index) =>
      createQuoteNode(annotation, snapshot.title, positions[index]!),
    )
    addNodes(nodes)
    addEdges(
      picked.map((annotation) => ({
        ...createEdge(node.id, nodeId.item(annotation.key), 'context'),
        data: { kind: 'context' as const, label: 'highlight' },
      })),
    )
    setSelectedKeys(new Set())
    toast.success(`${picked.length} highlight(s) on the board`)
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ItemTypeIcon itemType={snapshot.itemType} className="size-3.5" />
          {itemTypeLabel(snapshot.itemType)}
          {snapshot.year && <span className="tabular-nums">· {snapshot.year}</span>}
        </div>
        <h2 className="text-base leading-snug font-semibold">{snapshot.title}</h2>
        {snapshot.source && <p className="text-muted-foreground text-xs italic">{snapshot.source}</p>}
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" variant="outline" asChild>
          <a href={zoteroSelectUrl(itemKey, source.library)}>
            <ExternalLink /> Open in Zotero
          </a>
        </Button>
        {snapshot.doi && (
          <Button size="xs" variant="outline" asChild>
            <a href={`https://doi.org/${snapshot.doi}`} target="_blank" rel="noreferrer">
              <Link2 /> DOI
            </a>
          </Button>
        )}
        {snapshot.url && (
          <Button size="xs" variant="outline" asChild>
            <a href={snapshot.url} target="_blank" rel="noreferrer">
              <Link2 /> Link
            </a>
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} /> Refresh
        </Button>
      </div>

      <Separator />

      <section className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Your note on this board</Label>
        <Textarea
          value={comment ?? ''}
          onChange={(event) => updateNodeData(node.id, { comment: event.target.value })}
          placeholder="Why is this here? What does it connect to?"
          className="min-h-20 text-sm"
        />
      </section>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-muted-foreground text-xs">
          Showing the saved snapshot — Zotero is unreachable ({(error as Error).message}).
        </p>
      )}

      {item && (
        <>
          {(item.data.creators ?? []).length > 0 && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Creators</Label>
              <ul className="space-y-0.5 text-sm">
                {(item.data.creators ?? []).map((creator, index) => (
                  <li key={`${creator.creatorType}-${index}`} className="flex gap-2">
                    <span className="text-muted-foreground w-16 shrink-0 text-xs capitalize">
                      {creator.creatorType}
                    </span>
                    <span className="truncate">{creatorName(creator)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {typeof item.data.abstractNote === 'string' && item.data.abstractNote && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Abstract</Label>
              <p className="text-muted-foreground max-h-48 overflow-y-auto text-sm leading-relaxed">
                {item.data.abstractNote}
              </p>
            </section>
          )}

          {(item.data.tags ?? []).length > 0 && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Tags</Label>
              <div className="flex flex-wrap gap-1">
                {(item.data.tags ?? []).map((tag) => (
                  <Badge key={tag.tag} variant="secondary" className="font-normal">
                    {tag.tag}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {notes.length > 0 && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Notes in Zotero ({notes.length})</Label>
              <ul className="space-y-1.5">
                {notes.map((note) => (
                  <li
                    key={note.key}
                    className="bg-muted/50 text-muted-foreground rounded-md p-2 text-xs leading-relaxed"
                  >
                    <StickyNote className="mr-1 inline size-3" />
                    {stripHtml(String(note.data.note ?? '')).slice(0, 220)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {loadingAnnotations && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">PDF highlights</Label>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </section>
          )}

          {(meatyAnnotations ?? []).length > 0 && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                PDF highlights ({selectedKeys.size}/{meatyAnnotations?.length} selected)
              </Label>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {(meatyAnnotations ?? []).map((annotation) => {
                  const text = stripHtml(String(annotation.data.annotationText ?? ''))
                  const page =
                    typeof annotation.data.annotationPageLabel === 'string'
                      ? annotation.data.annotationPageLabel
                      : undefined
                  const checked = selectedKeys.has(annotation.key)
                  return (
                    <label
                      key={annotation.key}
                      className={cn(
                        'hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 text-xs transition-colors',
                        checked && 'border-border bg-accent',
                        viewOnly && 'pointer-events-none opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKey(annotation.key)}
                        className="accent-primary mt-0.5 size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="line-clamp-3 leading-snug">{text}</span>
                        <span className="text-muted-foreground block text-[10px] uppercase">
                          {page ? `p. ${page}` : 'no page label'}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedKeys(new Set((meatyAnnotations ?? []).map((entry) => entry.key)))}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedKeys(new Set())}
                >
                  None
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  disabled={viewOnly || selectedKeys.size === 0}
                  onClick={addQuotes}
                >
                  <Quote /> To board ({selectedKeys.size})
                </Button>
              </div>
            </section>
          )}

          {attachments.length > 0 && canSnapPages && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">PDF snapshot</Label>
              {attachments.map((attachment) => (
                <div key={attachment.key} className="flex items-center gap-1.5">
                  <Input
                    value={pageInput}
                    onChange={(event) =>
                      setPageInput(event.target.value.replace(/[^\d]/g, ''))
                    }
                    inputMode="numeric"
                    aria-label="Page number"
                    className="w-16 text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void snapPage(attachment.key)}
                    disabled={snapping === attachment.key}
                    className="flex-1"
                  >
                    <Camera /> Page {pageInput || '1'} to board
                  </Button>
                </div>
              ))}
              <p className="text-muted-foreground text-xs">
                Renders the page as an image card. Read-only GET from Zotero —
                the PDF itself is untouched.
              </p>
            </section>
          )}

          {(related ?? []).length > 0 && (
            <section className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Related in Zotero ({related?.length})
              </Label>
              <ul className="space-y-1">
                {(related ?? []).map((relatedItem) => (
                  <li key={relatedItem.key} className="flex items-start gap-1.5">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Add ${itemTitle(relatedItem)} to the board`}
                      onClick={() => {
                        addNodes([
                          createItemNode(relatedItem, {
                            x: node.position.x + 340,
                            y: node.position.y + 40,
                          }),
                        ])
                        addEdges([
                          {
                            ...createEdge(node.id, nodeId.item(relatedItem.key), 'related'),
                            data: { kind: 'related', label: 'related' },
                          },
                        ])
                      }}
                    >
                      <Plus />
                    </Button>
                    <span className="pt-1 text-xs leading-snug">{itemTitle(relatedItem)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
