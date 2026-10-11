/** UI navigation only. Verified provider webhooks remain authoritative for payment success. */
export function hostedCheckoutRedirect(provider: string, rawUrl?: string): string | null {
  if (provider !== 'stripe') return null;
  if (!rawUrl) throw new Error('Payment provider did not return a checkout URL. Check the order before retrying.');
  let url: URL;
  try { url = new URL(rawUrl); }
  catch { throw new Error('Untrusted payment gateway redirect.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' ||
      url.username || url.password || url.port) {
    throw new Error('Untrusted payment gateway redirect.');
  }
  return url.href;
}
