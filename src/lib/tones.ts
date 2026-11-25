// Pastel tones for the client Overview tiles (docs/design/overview): lilac, pink, green, peach, from our tokens (dark mode included).
export type Tone = 'purple' | 'pink' | 'green' | 'orange'
export const TONE: Record<Tone, { bg: string; ink: string }> = {
  purple: { bg: 'bg-vv-lavender-100', ink: 'text-vv-purple-ink' },
  pink: { bg: 'bg-vv-pink-100', ink: 'text-vv-pink-ink' },
  green: { bg: 'bg-vv-green-100', ink: 'text-vv-green-ink' },
  orange: { bg: 'bg-vv-orange-100', ink: 'text-vv-orange-ink' },
}
