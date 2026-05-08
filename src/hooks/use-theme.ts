import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'
const DEFAULT_THEME: Theme = 'light'

const listeners = new Set<() => void>()

let currentTheme: Theme | null = null

function resolveTheme(): Theme {
    if (typeof window === 'undefined') return DEFAULT_THEME

    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
}

function notifyThemeChange() {
    listeners.forEach((listener) => listener())
}

function getThemeSnapshot(): Theme {
    if (!currentTheme) {
        currentTheme = resolveTheme()
        applyTheme(currentTheme)
    }

    return currentTheme
}

export function setThemeValue(nextValue: Theme | ((prev: Theme) => Theme)) {
    const previousTheme = getThemeSnapshot()
    const nextTheme =
        typeof nextValue === 'function' ? nextValue(previousTheme) : nextValue

    currentTheme = nextTheme
    applyTheme(nextTheme)

    if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_KEY, nextTheme)
    }

    notifyThemeChange()
}

function subscribe(listener: () => void) {
    listeners.add(listener)

    if (typeof window === 'undefined') {
        return () => {
            listeners.delete(listener)
        }
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key && event.key !== THEME_KEY) return

        const nextTheme = resolveTheme()
        if (nextTheme === currentTheme) return

        currentTheme = nextTheme
        applyTheme(nextTheme)
        notifyThemeChange()
    }

    window.addEventListener('storage', handleStorage)

    return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', handleStorage)
    }
}

export function useTheme() {
    const theme = useSyncExternalStore(
        subscribe,
        getThemeSnapshot,
        () => DEFAULT_THEME,
    )

    const setTheme = useCallback(
        (value: Theme | ((prev: Theme) => Theme)) => {
            setThemeValue(value)
        },
        [],
    )

    const toggleTheme = useCallback(() => {
        setThemeValue((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'))
    }, [])

    return { theme, setTheme, toggleTheme }
}
