// One place that knows where this app lives, for links that leave the app:
// iOS Shortcuts, QR codes, bookmarks, NFC tags.
//
// VITE_APP_HOST holds host + base path ("ergi88.github.io/xpp") so moving the
// app to another domain is a one-line change. Unset (dev), it falls back to
// whatever the page is currently served from.
//
// Two schemes reach the same page:
//   web    → https://ergi88.github.io/xpp/…   opens in the browser
//   webapp → webapp://ergi88.github.io/xpp/…  opens the installed app

export type LinkScheme = 'web' | 'webapp'

/** Strip any scheme and surrounding slashes: "https://host/xpp/" → "host/xpp". */
export function normalizeAppHost(raw: string): string {
  return raw
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/\/+$/, '')
}

/** Protocol declared in a configured host, if it carries one. */
export function schemeOf(raw: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw.trim())
  return match ? match[1].toLowerCase() : null
}

export function buildAppLink(
  host: string,
  path: string,
  scheme: LinkScheme,
  webProtocol = 'https',
): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  const prefix = scheme === 'webapp' ? 'webapp' : webProtocol
  return `${prefix}://${normalizeAppHost(host)}${suffix}`
}

const configuredHost = (): string => (import.meta.env.VITE_APP_HOST ?? '').trim()

/** Host + base path this app is published at, without a scheme. */
export function appHost(): string {
  const configured = configuredHost()
  if (configured) return normalizeAppHost(configured)
  return normalizeAppHost(`${window.location.host}${import.meta.env.BASE_URL}`)
}

/** Absolute link to an in-app path, in either scheme. */
export function appLink(path: string, scheme: LinkScheme = 'web'): string {
  const configured = configuredHost()
  const webProtocol = configured
    ? (schemeOf(configured) ?? 'https')
    : window.location.protocol.replace(':', '')
  return buildAppLink(appHost(), path, scheme, webProtocol)
}
