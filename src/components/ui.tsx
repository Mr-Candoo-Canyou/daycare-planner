import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold text-arctic-800">{children}</h2>
}

const badgeTones: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-rose-100 text-rose-800',
  blue: 'bg-sky-100 text-sky-800',
  arctic: 'bg-arctic-100 text-arctic-800',
}

export function Badge({ tone = 'slate', children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone] ?? badgeTones.slate}`}>
      {children}
    </span>
  )
}

const buttonVariants: Record<string, string> = {
  primary: 'bg-arctic-700 text-white hover:bg-arctic-800 disabled:bg-slate-300',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-300',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 disabled:text-rose-200',
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="flex-1 min-w-36">
      <div className="text-2xl font-bold text-arctic-800">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Card>
  )
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-arctic-800">{title}</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>
}
