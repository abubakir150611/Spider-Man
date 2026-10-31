/** Checks that URLs respond (HEAD, then GET fallback). Network failures are reported, not thrown. */
export async function checkLinks(urls, { concurrency = 4, timeoutMs = 12000, fetchImpl = fetch } = {}) {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = [];
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const url = unique[i++];
      results.push(await checkOne(url, timeoutMs, fetchImpl));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return results.sort((a, b) => unique.indexOf(a.url) - unique.indexOf(b.url));
}

async function checkOne(url, timeoutMs, fetchImpl) {
  const headers = { 'user-agent': 'Mozilla/5.0 (AI Content Factory link checker)' };
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetchImpl(url, { method, redirect: 'follow', headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return { url, ok: true, status: res.status, finalUrl: res.url };
      if (method === 'GET' || ![403, 405, 501].includes(res.status)) {
        // 403 from bot protection is common on real sites; treat as reachable but flag it.
        return { url, ok: res.status === 403 || res.status === 429, status: res.status, note: res.status === 403 ? 'защита от ботов' : undefined };
      }
    } catch (error) {
      if (method === 'GET') return { url, ok: false, status: 0, error: error.cause?.code || error.name };
    }
  }
  return { url, ok: false, status: 0 };
}

export function collectUrls(research) {
  const urls = [];
  for (const item of research.items || []) urls.push(item.website, item.github, item.docs, ...(item.sources || []), ...(item.install || []).map((i) => i.source));
  for (const s of research.sources || []) urls.push(s.url);
  for (const f of research.facts || []) urls.push(f.source);
  return urls.filter(Boolean);
}
