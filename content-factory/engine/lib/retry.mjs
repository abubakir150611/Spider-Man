export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries an async operation with exponential backoff.
 * `shouldRetry(error)` may return false to fail fast, or a number of ms to wait.
 */
export async function withRetry(fn, { retries = 3, baseMs = 1000, factor = 2, label = 'operation', logger, shouldRetry } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      const decision = shouldRetry ? shouldRetry(error) : true;
      if (attempt >= retries || decision === false) throw error;
      const wait = typeof decision === 'number' ? decision : baseMs * factor ** attempt;
      logger?.warn(`${label}: попытка ${attempt + 1} не удалась (${error.message}). Повтор через ${Math.round(wait / 1000)}с`);
      await sleep(wait);
      attempt += 1;
    }
  }
}
