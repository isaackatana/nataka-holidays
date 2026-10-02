import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | undefined
  icon: LucideIcon
  loading?: boolean
  /** Formats the value for display (money, percentages). Defaults to the raw number. */
  format?: (value: number) => string
}

export function StatCard({ label, value, icon: Icon, loading, format }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-card border border-sand-200 bg-sand-50 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-900/10">
        <Icon className="h-5 w-5 text-teal-800" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-500">{label}</p>
        {loading ? (
          <div className="mt-1 h-7 w-12 animate-pulse rounded bg-sand-200" />
        ) : (
          <p className="font-figures text-2xl font-medium text-teal-900">{format ? format(value ?? 0) : (value ?? 0)}</p>
        )}
      </div>
    </div>
  )
}
