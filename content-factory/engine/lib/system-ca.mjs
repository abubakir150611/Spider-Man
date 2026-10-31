import tls from 'node:tls';

/**
 * Trusts the operating system's certificate store in addition to Node's bundled CAs.
 * Needed when an antivirus (Kaspersky, ESET, Avast…) or a corporate proxy inspects HTTPS
 * with its own root certificate: Windows trusts it, Node.js does not by default
 * (error UNABLE_TO_VERIFY_LEAF_SIGNATURE). Safe no-op on older Node versions.
 */
export function enableSystemCA() {
  try {
    if (typeof tls.getCACertificates !== 'function' || typeof tls.setDefaultCACertificates !== 'function') return false;
    const merged = [...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])];
    tls.setDefaultCACertificates(merged);
    return true;
  } catch {
    return false;
  }
}
