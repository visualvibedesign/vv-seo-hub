import ThemeToggle from '../ui/ThemeToggle'

// Top-right of a page header, like HQ's RefreshButton block: the icon-only dark mode button
// (desktop; on phones it's in the sidebar's top bar), then the page's own buttons.
export default function HeaderTools({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <ThemeToggle iconOnly className="min-h-11 min-w-11 justify-center border border-solid border-vv-toggle-line px-0 phone:hidden" />
      {children}
    </div>
  )
}
