// Visual Vibe HQ, the one-login portal. Same address rule as the sidebar's "Switch app"
// (Sidebar.tsx): VITE_HQ_URL, else HQ's dev server on localhost, else HQ's live address.
const RAW = import.meta.env.VITE_HQ_URL || (import.meta.env.DEV ? 'http://localhost:5173' : 'https://visual-vibe-dashboard.vercel.app')
export const HQ_URL = RAW.endsWith('/') ? RAW.slice(0, -1) : RAW

/**
 * Sign in through HQ (2026-11-27): HQ's handoff signs you in there if needed, then sends you back to
 * `here` with a 60-second pass that /api/auth/handoff turns into this app's cookie.
 */
export const hqSignInUrl = (here: string) => `${HQ_URL}/api/auth/handoff?to=${encodeURIComponent(here)}`
