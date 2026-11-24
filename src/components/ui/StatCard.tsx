// Number card from the design (Main.png, Client.png): label, big number, a short colored bar, a caption.
// Missing data shows "—", never 0.

const BAR = { purple: 'bg-vv-purple', lime: 'bg-vv-green', red: 'bg-vv-red', orange: 'bg-vv-orange-ink' } as const

export default function StatCard({ label, value, caption, bar = 'purple' }: { label: string; value: string | number | null; caption: string; bar?: keyof typeof BAR }) {
  const empty = value === null || value === ''
  return (
    <div className="box-border flex min-w-0 flex-col gap-2 rounded-[22px] border border-solid border-vv-line bg-vv-surface px-6 py-5 shadow-[0_14px_30px_-24px_rgba(91,63,208,0.45)] phone:px-4 phone:py-4 dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,.7)]">
      <span className="text-[15px] text-vv-body phone:text-[13px]">{label}</span>
      <span className={`font-display text-[44px] font-semibold leading-none tracking-[-0.02em] phone:text-[32px] ${empty ? 'text-vv-muted' : 'text-vv-purple-ink'}`}>
        {empty ? '—' : typeof value === 'number' ? value.toLocaleString('en-US') : value}
      </span>
      <span aria-hidden="true" className={`h-1 w-12 rounded-full ${empty ? 'bg-vv-field-line' : BAR[bar]}`} />
      <span className="text-[14px] leading-snug text-vv-body phone:text-[12px]">{caption}</span>
    </div>
  )
}
