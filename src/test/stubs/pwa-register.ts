// Stand-in for `virtual:pwa-register/react`, which only exists once the
// vite-plugin-pwa build plugin is loaded. Tests importing the app shell get an
// inert service-worker hook instead.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (v: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (v: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
