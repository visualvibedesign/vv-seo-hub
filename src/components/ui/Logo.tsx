// The Visual Vibe Design wordmark (public/brand, made from Angel's logo file): ink + purple in
// light mode, the original white + lavender in dark mode. `height` sets the size; the width follows.
export default function Logo({ height = 34, className = '' }: { height?: number; className?: string }) {
  const style = { height, width: 'auto' }
  return (
    <span className={`inline-flex ${className}`}>
      <img src="/brand/logo-light.png" alt="Visual Vibe Design" style={style} className="block dark:hidden" />
      <img src="/brand/logo-dark.png" alt="Visual Vibe Design" style={style} className="hidden dark:block" />
    </span>
  )
}
