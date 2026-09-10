import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Without this, a failed query only ever surfaces as the boolean
      // `isError` flag in whatever component called it — the real
      // error (e.g. a Postgres "column does not exist" from a migration
      // that hasn't been applied yet) is silently discarded by React
      // Query and never reaches the console. This is the single place
      // that logs it, for every query in the app, rather than needing
      // that logging added to every page individually.
      console.error(`[query error] ${JSON.stringify(query.queryKey)}:`, error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error(`[mutation error] ${mutation.options.mutationKey ?? '(no key)'}:`, error)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute — property/experience data doesn't change second-to-second
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
