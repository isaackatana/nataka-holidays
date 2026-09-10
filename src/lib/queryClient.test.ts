import { describe, it, expect, vi, afterEach } from 'vitest'
import { queryClient } from './queryClient'

afterEach(() => {
  queryClient.clear()
  vi.restoreAllMocks()
})

describe('queryClient global error logging', () => {
  it('logs the real error to console when a query fails, with its query key', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const testError = new Error('column properties.video_url does not exist')

    await queryClient
      .fetchQuery({
        queryKey: ['test', 'failing-query'],
        queryFn: () => Promise.reject(testError),
        retry: false,
      })
      .catch(() => {
        // Expected — fetchQuery rethrows. The point of this test is what
        // happened to console.error before it rethrew, not this catch.
      })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('["test","failing-query"]'),
      testError,
    )
  })

  it('logs a mutation error to console when a mutation fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const testError = new Error('insufficient_privilege')

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(testError),
      retry: false,
    })

    await mutation.execute({}).catch(() => {})

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[mutation error]'), testError)
  })

  it('does NOT log anything when a query succeeds', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await queryClient.fetchQuery({
      queryKey: ['test', 'succeeding-query'],
      queryFn: () => Promise.resolve('ok'),
    })

    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
