import { Hash } from 'lucide-react'
import { useCanvasUi } from '../canvas-ui'

const NONE: string[] = []

/**
 * Tag chips for a card: its own board tags plus the ones inherited from the tag
 * groups it sits in (shown filled, since they come and go with the card's position).
 */
export function NodeTags({ id, own, max = 4 }: { id: string; own?: string[]; max?: number }) {
  const inherited = useCanvasUi((state) => state.inheritedTags.get(id) ?? NONE)
  const ownTags = own ?? NONE
  const ownKeys = new Set(ownTags.map((tag) => tag.toLowerCase()))
  const fromGroups = inherited.filter((tag) => !ownKeys.has(tag.toLowerCase()))
  const all = [...ownTags.map((tag) => ({ tag, inherited: false })), ...fromGroups.map((tag) => ({ tag, inherited: true }))]
  if (all.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {all.slice(0, max).map(({ tag, inherited: fromGroup }) => (
        <span
          key={`${fromGroup ? 'g' : 'o'}:${tag}`}
          title={fromGroup ? `#${tag} — from the tag group this card sits in` : `#${tag}`}
          className={
            fromGroup
              ? 'inline-flex max-w-full items-center gap-0.5 truncate rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-300'
              : 'text-muted-foreground inline-flex max-w-full items-center gap-0.5 truncate rounded-full border px-1.5 py-px text-[10px]'
          }
        >
          <Hash className="size-2.5 shrink-0" />
          {tag}
        </span>
      ))}
      {all.length > max && <span className="text-muted-foreground text-[10px]">+{all.length - max}</span>}
    </div>
  )
}
