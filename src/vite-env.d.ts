/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /**
   * Where this app is published, as host + base path and no scheme
   * ("ergi88.github.io/xpp"). Used to build outward-facing links —
   * https:// for the browser, webapp:// for the installed app.
   * Unset in dev, where the current location is used instead.
   */
  readonly VITE_APP_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
