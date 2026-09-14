import { useShallow } from 'zustand/react/shallow'
import { claimEvidence, type ClaimStatus } from './argument'
import { useBoards } from './store'

/** Label and colours per claim status, shared by the card and the inspector. */
export const CLAIM_STATUS: Record<ClaimStatus, { label: string; bar: string; pill: string }> = {
  unsupported: {
    label: 'No evidence',
    bar: 'bg-muted-foreground/40',
    pill: 'bg-muted text-muted-foreground',
  },
  supported: {
    label: 'Supported',
    bar: 'bg-[var(--rel-supports)]',
    pill: 'bg-[color-mix(in_oklab,var(--rel-supports)_18%,transparent)] text-[var(--rel-supports)]',
  },
  contested: {
    label: 'Contested',
    bar: 'bg-amber-500',
    pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  contradicted: {
    label: 'Contradicted',
    bar: 'bg-[var(--rel-contradicts)]',
    pill: 'bg-[color-mix(in_oklab,var(--rel-contradicts)_18%,transparent)] text-[var(--rel-contradicts)]',
  },
}

/** Evidence counts for one claim, re-read whenever the board changes. */
export function useClaimCounts(id: string): { supporting: number; contradicting: number; status: ClaimStatus } {
  const [supporting, contradicting, status] = useBoards(
    useShallow((state) => {
      const board = state.activeBoardId ? state.boards[state.activeBoardId] : undefined
      if (!board) return [0, 0, 'unsupported'] as const
      const evidence = claimEvidence(id, board.nodes, board.edges)
      return [evidence.supporting.length, evidence.contradicting.length, evidence.status] as const
    }),
  )
  return { supporting, contradicting, status }
}
