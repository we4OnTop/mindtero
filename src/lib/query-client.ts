import { QueryClient } from '@tanstack/react-query'
import { ZoteroUnavailableError } from '@/features/zotero/source'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // Retrying against a closed Zotero just delays the "not connected" screen.
      retry: (failureCount, error) =>
        error instanceof ZoteroUnavailableError ? false : failureCount < 2,
    },
  },
})
