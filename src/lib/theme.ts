// Light / dark mode. Dark mode = class="dark" on <html> (see styles/tokens.css).
// The choice is remembered in this browser only: 'light', 'dark', or 'system' (match the
// computer's setting, chosen in Settings).
const KEY = 'vv-theme'
export type ThemeChoice = 'light' | 'dark' | 'system'

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function isDark() {
  return document.documentElement.classList.contains('dark')
}

export function themeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'system' ? v : 'light'
  } catch {
    return 'light'
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Storage blocked (private window etc.): it still applies for this visit.
  }
  document.documentElement.classList.toggle('dark', choice === 'dark' || (choice === 'system' && systemDark()))
}

/** The sidebar toggle: picks light or dark explicitly. */
export function setDark(dark: boolean) {
  setThemeChoice(dark ? 'dark' : 'light')
}

// Called once at startup, before the first render, so the page doesn't flash.
export function applySavedTheme() {
  const choice = themeChoice()
  document.documentElement.classList.toggle('dark', choice === 'dark' || (choice === 'system' && systemDark()))
  // "Match my computer": follow it when the computer switches (e.g. at sunset).
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
    if (themeChoice() === 'system') document.documentElement.classList.toggle('dark', e.matches)
  })
}
