import { salePercent } from '@/features/shop/sale'
import { formatKES } from '@/utils/currency'

/** A price, with the original crossed out when the product is on sale. */
export function Price({ price, compareAt, className = '' }: { price: number; compareAt?: number | null; className?: string }) {
  const percent = salePercent(price, compareAt)
  if (percent === null) return <span className={`font-figures ${className}`}>{formatKES(price)}</span>
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 font-figures ${className}`}>
      <span>{formatKES(price)}</span>
      <del className="text-[0.8em] text-charcoal-500">
        <span className="sr-only">Was </span>
        {formatKES(compareAt as number)}
      </del>
    </span>
  )
}

/** "Sale -20%" tag for a product image. Renders nothing when it is not on sale. */
export function SaleBadge({ price, compareAt, className = '' }: { price: number; compareAt?: number | null; className?: string }) {
  const percent = salePercent(price, compareAt)
  if (percent === null) return null
  return (
    <span className={`rounded-full bg-coral-500 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-sand-50 ${className}`}>
      Sale −{percent}%
    </span>
  )
}
