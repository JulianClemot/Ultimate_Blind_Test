const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * URL a player scans to join `code`. When the host page is opened through localhost the URL would be
 * useless on a phone, so the machine's LAN address is substituted for the hostname.
 */
export const buildJoinUrl = (code: string, location: URL, lanAddress?: string): string => {
  const url = new URL('/', location);
  if (LOOPBACK.has(location.hostname) && lanAddress) url.hostname = lanAddress;
  url.searchParams.set('code', code);
  return url.toString();
};
