import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import Logo from '../components/ui/Logo'
import ThemeToggle from '../components/ui/ThemeToggle'
import { getSession, login, logout, safeNext } from '../lib/api'

// "Sign in" screen, copied from HQ's LoginPage (same layout, sizes and copy style), worded for SEO Hub.
// Same shared team password as HQ. The password is changed in HQ only (Settings), never here.
// Later, with custom domains, HQ_LOGIN_URL will send people to HQ's sign-in instead (CONTEXT.md §3).

const STAR = 'M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z'
const VIBE = 'Business doesn’t have to be boring.'

const ERRORS = {
  empty: 'Enter the team password.',
  wrong_password: "That's not the team password. Try again, or ask Alexia.",
  not_configured: "Sign-in isn't set up yet: the team password hasn't been added to the server.",
  network_error: "Couldn't reach the server. Check your connection and try again.",
} as const

type Step = 'checking' | 'form' | 'welcome'

export default function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const nextLabel = next === '/' ? 'Open SEO Hub ›' : 'Continue ›'

  const [step, setStep] = useState<Step>('checking')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotNote, setForgotNote] = useState(false)

  // Already signed in on this device (here or in HQ)? Show the "You're in" screen.
  useEffect(() => {
    let cancelled = false
    getSession()
      .catch(() => false)
      .then((signedIn) => !cancelled && setStep(signedIn ? 'welcome' : 'form'))
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!pw.trim()) return setErr(ERRORS.empty)
    setBusy(true)
    setErr('')
    const result = await login(pw, remember)
    setBusy(false)
    if (result === 'ok') {
      setPw('')
      setStep('welcome')
    } else {
      setErr(ERRORS[result])
    }
  }

  const signOut = async () => {
    await logout()
    setPw('')
    setStep('form')
  }

  return (
    <div className="flex min-h-screen flex-col bg-vv-cream font-body text-vv-ink">
      <header className="mx-auto box-border flex w-full max-w-[1240px] items-center justify-between gap-4 px-8 py-[22px] phone:px-4">
        <span className="flex flex-col text-vv-ink">
          <Logo height={38} className="phone:hidden" />
          <Logo height={30} className="hidden phone:inline-flex" />
          <span className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-vv-purple-deep">SEO Hub</span>
        </span>
        <ThemeToggle hideLabelOnPhone className="ml-auto border border-vv-toggle-line phone:min-h-11 phone:px-3" />
      </header>

      <main className="mx-auto box-border flex w-full max-w-[1080px] flex-auto items-center px-8 pb-16 pt-6 phone:px-4">
        <div className="flex w-full flex-wrap overflow-hidden rounded-[32px] border border-vv-line bg-vv-surface shadow-[0_30px_60px_-40px_rgba(91,63,208,0.55)] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,.7)]">
          {/* Left: welcome panel with floating stars */}
          <section
            aria-hidden="true"
            className="relative box-border flex min-h-[420px] min-w-0 flex-[1_1_380px] flex-col justify-between gap-7 overflow-hidden bg-vv-lavender-200 px-10 py-11 phone:min-h-0 phone:px-[22px] phone:py-7"
          >
            <FloatingStar size={120} fill="#BAD657" className="-right-6 -top-5" duration="6s" />
            <FloatingStar size={44} fill="#FFFFFF" className="bottom-[120px] left-[34px]" duration="5s" delay="1s" />
            <FloatingStar size={26} fill="#7C5CE6" className="bottom-[60px] right-[60px]" duration="4s" delay=".5s" />

            <div className="relative flex flex-col gap-3.5">
              <h1 className="m-0 font-display text-[52px] font-semibold leading-[1.02] tracking-[-0.02em] text-vv-purple-ink phone:text-[40px] phone:leading-[1.05] phone-sm:text-[36px]">
                Hey gorgeous, <em className="font-medium text-vv-purple">welcome back.</em>
              </h1>
              <p className="m-0 max-w-[360px] text-[17px] leading-normal text-vv-body">
                Every SEO client’s keywords, plans and results are waiting for you.
              </p>
            </div>

            <div className="relative flex max-w-[320px] flex-col gap-1 self-start rounded-[20px] bg-vv-surface px-[18px] py-3.5">
              <span className="text-xs font-bold text-vv-purple-deep">TODAY'S VIBE</span>
              <span className="font-display text-lg italic leading-[1.35]">{VIBE}</span>
            </div>
          </section>

          {/* Right: sign-in form, or "You're in" */}
          <section
            aria-labelledby="si-h"
            className="box-border flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-[22px] px-[52px] pb-11 pt-[52px] phone:px-[22px] phone:pb-8 phone:pt-8"
          >
            {step === 'checking' && (
              <span id="si-h" className="sr-only">
                Sign in
              </span>
            )}

            {step === 'form' && (
              <form onSubmit={signIn} noValidate className="contents">
                <div className="flex flex-col gap-2.5">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-vv-lavender-100">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={STAR} className="fill-vv-purple" />
                    </svg>
                  </span>
                  <h2 id="si-h" className="m-0 font-display text-[34px] font-semibold leading-[1.05] phone:text-[28px]">
                    Sign in to <em className="font-medium text-vv-purple">SEO Hub</em>
                  </h2>
                  <span className="text-[15px] leading-normal text-vv-muted">Same team password as Project HQ.</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pw" className="text-sm font-semibold">
                    Team password
                  </label>
                  <div
                    className={`flex items-center gap-2.5 rounded-[18px] border-[1.5px] bg-vv-field py-[5px] pl-4 pr-[5px] ${
                      err ? 'border-vv-error-line shadow-[0_0_0_4px_var(--vv-red-100)]' : 'border-vv-field-line shadow-[0_0_0_4px_var(--vv-lavender-50)]'
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="stroke-vv-purple" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="11" rx="3" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                    <input
                      id="pw"
                      type={show ? 'text' : 'password'}
                      value={pw}
                      onChange={(e) => {
                        setPw(e.target.value)
                        setErr('')
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-invalid={!!err}
                      aria-describedby={err ? 'pw-err' : undefined}
                      className="min-h-[46px] min-w-0 flex-auto border-0 bg-transparent text-[17px] text-vv-ink outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="min-h-10 rounded-[14px] border-0 bg-vv-lavender-100 px-3.5 text-[13px] font-bold text-vv-purple-deep"
                    >
                      {show ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {err && (
                    <span id="pw-err" role="alert" className="text-sm font-semibold text-vv-red">
                      {err}
                    </span>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={remember} onChange={() => setRemember((r) => !r)} className="h-5 w-5 accent-vv-purple" />
                  Keep me signed in on this device
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[58px] items-center justify-center gap-2.5 rounded-full border-0 bg-vv-green px-7 text-[17px] font-bold text-vv-on-green shadow-[0_14px_28px_-18px_rgba(110,140,30,0.9)] disabled:cursor-wait"
                >
                  {busy ? 'Signing you in…' : 'Sign in'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[13px] text-vv-muted">
                  <button type="button" onClick={() => setForgotNote(true)} className="min-h-8 border-0 bg-transparent p-0 text-sm font-bold text-vv-purple-deep">
                    Forgot password?
                  </button>
                </div>
                {forgotNote && (
                  <p role="status" className="m-0 -mt-3 text-sm text-vv-muted">
                    It’s the same password as Project HQ. Ask Alexia, or change it in HQ › Settings.
                  </p>
                )}
              </form>
            )}

            {step === 'welcome' && (
              <div aria-live="polite" className="flex flex-auto flex-col items-start justify-center gap-4">
                <span className="inline-flex h-[72px] w-[72px] animate-vv-pop items-center justify-center rounded-full bg-vv-green motion-reduce:animate-none">
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={STAR} fill="#131314" />
                  </svg>
                </span>
                <h2 id="si-h" className="m-0 font-display text-[40px] font-semibold leading-[1.05] phone:text-[28px]">
                  Hi team! <em className="font-medium text-vv-purple">You're in.</em>
                </h2>
                <p className="m-0 text-base leading-normal text-vv-body">Let's get into it.</p>
                <Link
                  to={next}
                  className="inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-vv-green px-[26px] text-base font-bold text-vv-on-green no-underline"
                >
                  {nextLabel}
                </Link>
                <button type="button" onClick={signOut} className="min-h-9 border-0 bg-transparent p-0 text-[13px] font-semibold text-vv-muted underline">
                  Sign out
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

type StarProps = { size: number; fill: string; className: string; duration: string; delay?: string }

function FloatingStar({ size, fill, className, duration, delay = '0s' }: StarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`absolute animate-vv-float motion-reduce:animate-none ${className}`}
      style={{ animationDuration: duration, animationDelay: delay }}
    >
      <path d={STAR} fill={fill} />
    </svg>
  )
}
