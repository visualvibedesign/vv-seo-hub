import { useState } from 'react'
import { isDark, setDark } from '../../lib/theme'

// "Dark mode" / "Light mode" pill from design-ref (.vv-dkbtn).
// Used in the sidebar and in the header of full-page screens (Sign in, Landing).
type Props = {
  className?: string
  hideLabelOnPhone?: boolean // the sidebar's phone top bar shows the icon only
  iconOnly?: boolean // moon/sun icon only, everywhere (Landing header)
}

export default function ThemeToggle({ className = '', hideLabelOnPhone = false, iconOnly = false }: Props) {
  const [dark, setDarkState] = useState(isDark)
  const label = dark ? 'Light mode' : 'Dark mode'

  const toggle = () => {
    setDark(!dark)
    setDarkState(!dark)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={`inline-flex min-h-10 select-none items-center gap-2 rounded-full bg-vv-toggle px-3.5 text-[13px] font-bold text-vv-toggle-ink ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      {!iconOnly && <span className={hideLabelOnPhone ? 'phone:hidden' : ''}>{label}</span>}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
