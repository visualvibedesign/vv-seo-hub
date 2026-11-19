// Loading states, copied from Visual Vibe HQ (src/components/ui/Loading.tsx). Only the pieces
// SEO Hub uses so far; copy more from HQ when needed. Reduce motion: shapes stay, nothing moves.

const STAR = 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z'

/** One shimmering block. Size and shape come from className (h-4 w-1/2 rounded-full…). */
export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`vv-skel block rounded-lg ${className}`} />
}

/** Three bouncing dots, like someone typing. */
export function TypingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="vv-motion h-1.5 w-1.5 animate-vv-dot rounded-full bg-current" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  )
}

/** The brand star, slowly turning: a purple one with a small lime one beside it. */
export function SpinningStar({ size = 30 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="relative inline-flex flex-none" style={{ width: size + 8, height: size + 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" className="vv-motion animate-vv-star">
        <path d={STAR} fill="var(--vv-purple)" />
      </svg>
      <svg width={size / 2.2} height={size / 2.2} viewBox="0 0 24 24" className="vv-motion absolute bottom-0 right-0 animate-vv-star" style={{ animationDelay: '-1.2s' }}>
        <path d={STAR} fill="var(--vv-green)" />
      </svg>
    </span>
  )
}

/** First load of the whole app. */
export function BootLoader() {
  return (
    <div aria-busy="true" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-vv-cream font-body text-vv-ink">
      <span role="status" className="sr-only">
        Opening SEO Hub
      </span>
      <SpinningStar size={44} />
      <span aria-hidden="true" className="flex items-center gap-2 text-sm font-semibold text-vv-purple-deep">
        Opening SEO Hub <TypingDots />
      </span>
    </div>
  )
}

/** Thin purple bar across the top while the next page downloads. */
export function TopBar() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] overflow-hidden">
      <div className="vv-motion h-full w-1/3 animate-vv-bar rounded-full bg-vv-purple" />
    </div>
  )
}
