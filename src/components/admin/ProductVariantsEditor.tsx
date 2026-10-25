import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useAddVariant, useDeleteVariant, useUpdateVariant } from '@/features/admin/shop/queries'
import type { ProductVariant } from '@/types/domain'

const inputClass =
  'w-full rounded-lg border border-sand-400 bg-sand-50 px-3 py-2 text-base text-charcoal-900 outline-none focus:border-teal-700 sm:text-sm'

function parseStock(raw: string): number | null {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 100000 ? n : null
}

function VariantRow({ variant }: { variant: ProductVariant }) {
  const update = useUpdateVariant()
  const remove = useDeleteVariant()
  const [name, setName] = useState(variant.name)
  const [stock, setStock] = useState(String(variant.stock))
  const [error, setError] = useState<string | null>(null)
  const dirty = name.trim() !== variant.name || stock !== String(variant.stock)

  async function save() {
    const n = parseStock(stock)
    if (!name.trim()) return setError('Enter a name.')
    if (n === null) return setError('Stock must be 0 or more.')
    setError(null)
    try {
      await update.mutateAsync({ id: variant.id, name: name.trim(), stock: n })
    } catch (err) {
      setError(/duplicate|unique/i.test(err instanceof Error ? err.message : '') ? 'You already have an option with that name.' : 'Could not save.')
    }
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input aria-label={`Option name (${variant.name})`} className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <input aria-label={`Stock of ${variant.name}`} className={`${inputClass} w-24 shrink-0`} type="number" inputMode="numeric" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
        <button type="button" aria-label={`Save ${variant.name}`} disabled={!dirty || update.isPending} onClick={save} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-teal-800 hover:bg-sand-200 disabled:opacity-30"><Save className="h-4 w-4" /></button>
        <button
          type="button"
          aria-label={`Delete ${variant.name}`}
          onClick={() => { if (window.confirm(`Delete the option "${variant.name}"? Past orders keep their record of it.`)) remove.mutate(variant.id) }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-coral-500 hover:bg-coral-500/10"
        ><Trash2 className="h-4 w-4" /></button>
      </div>
      {error && <p role="alert" className="text-xs text-coral-500">{error}</p>}
    </li>
  )
}

/**
 * Colours / options for one product, each with its own stock. While a product has
 * options, the product's own stock is the total of them (the database keeps it so).
 */
export function ProductVariantsEditor({ productId, variants }: { productId: string; variants: ProductVariant[] }) {
  const add = useAddVariant(productId)
  const [name, setName] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onAdd() {
    const n = parseStock(stock)
    if (!name.trim()) return setError('Enter a name, e.g. Blue.')
    if (n === null) return setError('Enter how many are in stock (0 or more).')
    setError(null)
    try {
      await add.mutateAsync({ name: name.trim(), stock: n, sortOrder: variants.length })
      setName('')
      setStock('')
    } catch (err) {
      setError(/duplicate|unique/i.test(err instanceof Error ? err.message : '') ? 'You already have an option with that name.' : 'Could not add the option.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-charcoal-700">Colours / options</p>
        <p className="text-xs text-charcoal-500">
          Optional. Add these when guests must choose (like a kikoy colour). Each has its own stock, and the product's "In stock" number becomes their total.
        </p>
      </div>

      {variants.length > 0 && (
        <ul className="flex flex-col gap-2">
          {variants.map((v) => <VariantRow key={`${v.id}-${v.name}-${v.stock}`} variant={v} />)}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input aria-label="New option name" className={inputClass} placeholder="e.g. Blue" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <input aria-label="New option stock" className={`${inputClass} w-24 shrink-0`} type="number" inputMode="numeric" min={0} placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} />
        <button type="button" onClick={onAdd} disabled={add.isPending} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-900 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50 disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-coral-500">{error}</p>}
    </div>
  )
}
