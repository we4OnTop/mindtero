import type { Accent } from './types'

/**
 * Node accents are chosen by the user for grouping, so they carry no data meaning
 * and are kept clearly distinct from the relation palette. Written as literal class
 * strings so Tailwind's scanner keeps them.
 */
export const ACCENT_CLASSES: Record<Accent, { bar: string; dot: string; ring: string; soft: string }> =
  {
    neutral: {
      bar: 'bg-muted-foreground/50',
      dot: 'bg-muted-foreground',
      ring: 'ring-muted-foreground/30',
      soft: 'bg-muted/60',
    },
    violet: {
      bar: 'bg-violet-500',
      dot: 'bg-violet-500',
      ring: 'ring-violet-500/40',
      soft: 'bg-violet-500/10',
    },
    sky: {
      bar: 'bg-sky-500',
      dot: 'bg-sky-500',
      ring: 'ring-sky-500/40',
      soft: 'bg-sky-500/10',
    },
    emerald: {
      bar: 'bg-emerald-500',
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-500/40',
      soft: 'bg-emerald-500/10',
    },
    amber: {
      bar: 'bg-amber-500',
      dot: 'bg-amber-500',
      ring: 'ring-amber-500/40',
      soft: 'bg-amber-500/10',
    },
    rose: {
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
      ring: 'ring-rose-500/40',
      soft: 'bg-rose-500/10',
    },
    cyan: {
      bar: 'bg-cyan-500',
      dot: 'bg-cyan-500',
      ring: 'ring-cyan-500/40',
      soft: 'bg-cyan-500/10',
    },
  }

export const ACCENT_LABELS: Record<Accent, string> = {
  neutral: 'Neutral',
  violet: 'Violet',
  sky: 'Sky',
  emerald: 'Emerald',
  amber: 'Amber',
  rose: 'Rose',
  cyan: 'Cyan',
}

export function accentClasses(accent: Accent | undefined) {
  return ACCENT_CLASSES[accent ?? 'neutral']
}
