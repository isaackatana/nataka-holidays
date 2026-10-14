import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ImagePlus, Pencil, Plus, Trash2, Eye, EyeOff, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAdminProducts, useDeleteProduct, useSaveProduct } from '@/features/admin/shop/queries'
import { slugify } from '@/features/admin/shop/slug'
import { formatKES } from '@/utils/currency'
import { getResizedImageUrl } from '@/utils/storage'
import type { Product } from '@/types/domain'

interface FormState {
  id?: string
  name: string
  slug: string
  description: string
  price: string
  stock: string
  is_active: boolean
  image_path: string | null
  file: File | null
  removeImage: boolean
}

const EMPTY: FormState = { name: '', slug: '', description: '', price: '', stock: '', is_active: true, image_path: null, file: null, removeImage: false }

const inputClass =
  'w-full rounded-lg border border-sand-400 bg-sand-50 px-4 py-2.5 text-base text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700 sm:text-sm'

export default function AdminProducts() {
  const { data: products, isLoading } = useAdminProducts()
  const save = useSaveProduct()
  const remove = useDeleteProduct()
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  function edit(p: Product) {
    setError(null)
    setForm({ id: p.id, name: p.name, slug: p.slug, description: p.description, price: String(p.price), stock: String(p.stock), is_active: p.is_active, image_path: p.image_path, file: null, removeImage: false })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const price = Number(form.price)
    const stock = Number(form.stock)
    const slug = form.id ? form.slug : slugify(form.name)
    if (form.name.trim().length < 2) return setError('Enter a product name.')
    if (!slug) return setError('The name needs some letters or numbers.')
    if (!Number.isInteger(price) || price < 1 || price > 250000) return setError('Price must be a whole number of shillings, from 1 to 250,000.')
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be 0 or more.')

    try {
      await save.mutateAsync({
        id: form.id,
        input: { name: form.name.trim(), slug, description: form.description.trim(), price, stock, is_active: form.is_active },
        file: form.file,
        currentImagePath: form.image_path,
        removeImage: form.removeImage,
      })
      setForm(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(/duplicate|unique/i.test(msg) ? 'A product with this name already exists. Use a slightly different name.' : msg || 'Could not save the product.')
    }
  }

  const chosenFile = form?.file ?? null
  const localPreview = useMemo(() => (chosenFile ? URL.createObjectURL(chosenFile) : null), [chosenFile])
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])
  const preview = localPreview ?? (form?.image_path && !form.removeImage ? getResizedImageUrl('product-images', form.image_path, 300) : null)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Products</h1>
          <p className="mt-1 text-sm text-charcoal-500">What you sell in the shop. Stock goes down as orders come in.</p>
        </div>
        {!form && (
          <button type="button" onClick={() => { setError(null); setForm(EMPTY) }} className="flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">
            <Plus className="h-4 w-4" aria-hidden="true" /> New product
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 rounded-card border border-sand-200 bg-sand-50 p-5" noValidate>
          <h2 className="font-display text-lg font-medium text-teal-900">{form.id ? 'Edit product' : 'New product'}</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Name
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Description
            <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={2000} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Price (KSh)
              <input className={inputClass} type="number" inputMode="numeric" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              In stock
              <input className={inputClass} type="number" inputMode="numeric" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-sand-200 text-sand-300">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-8 w-8" aria-hidden="true" />}
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-teal-900 px-4 py-2 font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {preview ? 'Change photo' : 'Add photo'}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null, removeImage: false })} />
              </label>
              {preview && <button type="button" onClick={() => setForm({ ...form, file: null, removeImage: true })} className="self-start text-xs text-charcoal-500 underline">Remove photo</button>}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Show in the shop
          </label>

          {error && <p role="alert" className="text-sm text-coral-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={save.isPending}>{form.id ? 'Save changes' : 'Add product'}</Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Shown</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isLoading && <tr><td colSpan={5} className="px-4 py-6"><div className="h-8 animate-pulse rounded bg-sand-200" /></td></tr>}
            {!isLoading && products?.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-charcoal-500">No products yet. Add your first one.</td></tr>}
            {products?.map((p) => (
              <tr key={p.id} className="hover:bg-sand-100/60">
                <td className="px-4 py-3 font-medium text-charcoal-900">{p.name}</td>
                <td className="px-4 py-3 font-figures text-charcoal-700">{formatKES(p.price)}</td>
                <td className={`px-4 py-3 font-figures ${p.stock === 0 ? 'text-coral-500' : 'text-charcoal-700'}`}>{p.stock === 0 ? 'Sold out' : p.stock}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium ${p.is_active ? 'bg-teal-900/10 text-teal-800' : 'bg-charcoal-500/10 text-charcoal-500'}`}>
                    {p.is_active ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
                    {p.is_active ? 'Shown' : 'Hidden'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" aria-label={`Edit ${p.name}`} onClick={() => edit(p)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-sand-200 hover:text-teal-800"><Pencil className="h-4 w-4" /></button>
                    <button
                      type="button"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => { if (window.confirm(`Delete "${p.name}"? Past orders keep their record of it.`)) remove.mutate(p) }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500"
                    ><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remove.isError && <p role="alert" className="mt-3 text-sm text-coral-500">Could not delete that product.</p>}
    </div>
  )
}
