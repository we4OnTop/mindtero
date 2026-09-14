import { useState } from 'react'
import { clampYear } from '../timeline'

/** A four-digit year field that commits on blur or Enter. */
export function YearInput({
  value,
  placeholder,
  onChange,
  label,
  disabled,
}: {
  value: number | undefined
  placeholder?: string
  onChange: (year: number | undefined) => void
  label: string
  disabled?: boolean
}) {
  // Typing "2015" passes through "2" and "20"; only commit whole values. Callers
  // key this input by its value, so an outside change (dragging a bar) resets it.
  const [draft, setDraft] = useState(value === undefined ? '' : String(value))
  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10)
    const next = Number.isFinite(parsed) ? clampYear(parsed) : undefined
    if (next !== value) onChange(next)
    // Rejected input snaps back; accepted input remounts with the new value.
    setDraft(value === undefined ? '' : String(value))
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      placeholder={placeholder}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 4))}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="nodrag border-input bg-background h-6 w-16 rounded-md border px-1.5 text-center text-xs tabular-nums outline-none focus-visible:ring-2"
    />
  )
}
