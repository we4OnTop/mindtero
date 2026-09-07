import { FolderOpen, Tag, User } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { CollectionNode, CreatorNode, TagNode } from '../types'
import { EdgeZones } from './handles'

/** Shared pill shape for the derived nodes (tags, creators, collections). */
function Chip({
  icon,
  label,
  selected,
  className,
}: {
  icon: ReactNode
  label: string
  selected?: boolean
  className?: string
}) {
  return (
    // Handles anchor to this wrapper, so it must hug the pill instead of a
    // fixed-size node box (chips auto-size to their label).
    <div className="w-fit">
      <div
        className={cn(
          'bg-card text-card-foreground relative flex max-w-[200px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm',
          selected && 'ring-primary/60 ring-2',
          className,
        )}
      >
        {icon}
        <span className="truncate font-medium">{label}</span>
      </div>
      <EdgeZones />
    </div>
  )
}

export const TagNodeView = memo(function TagNodeView({ data, selected }: NodeProps<TagNode>) {
  return (
    <Chip
      icon={<Tag className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
      label={data.tag}
      selected={selected}
      className="border-emerald-500/30 bg-emerald-500/5"
    />
  )
})

export const CreatorNodeView = memo(function CreatorNodeView({
  data,
  selected,
}: NodeProps<CreatorNode>) {
  return (
    <Chip
      icon={<User className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />}
      label={data.name}
      selected={selected}
      className="border-sky-500/30 bg-sky-500/5"
    />
  )
})

export const CollectionNodeView = memo(function CollectionNodeView({
  data,
  selected,
}: NodeProps<CollectionNode>) {
  return (
    <Chip
      icon={<FolderOpen className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />}
      label={data.name}
      selected={selected}
      className="border-violet-500/30 bg-violet-500/5"
    />
  )
})
