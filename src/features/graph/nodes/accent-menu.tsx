import { Check } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ACCENT_CLASSES, ACCENT_LABELS } from '../accents'
import { ACCENTS, type Accent } from '../types'

export function AccentMenuItems({
  value,
  onSelect,
}: {
  value: Accent | undefined
  onSelect: (accent: Accent) => void
}) {
  return (
    <>
      <DropdownMenuLabel>Colour</DropdownMenuLabel>
      {ACCENTS.map((accent) => (
        <DropdownMenuItem key={accent} onSelect={() => onSelect(accent)}>
          <span className={cn('size-3 rounded-full', ACCENT_CLASSES[accent].dot)} aria-hidden />
          {ACCENT_LABELS[accent]}
          {(value ?? 'neutral') === accent && <Check className="ml-auto size-3.5" />}
        </DropdownMenuItem>
      ))}
    </>
  )
}
