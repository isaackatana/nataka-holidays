import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, Eye, EyeOff, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProductVariantsEditor } from '@/components/admin/ProductVariantsEditor'
import { ProductImageUploader } from '@/components/admin/ProductImageUploader'
import { useBusinessSettings } from '@/features/settings/queries'
import { useAdminProducts, useDeleteProduct, useSaveProduct } from '@/features/admin/shop/queries'
import { slugify } from '@/features/admin/shop/slug'
import { formatKES } from '@/utils/currency'
import { getResizedImageUrl } from '@/utils/storage'
import type { ProductWithImages } from '@/types/domain'

interface FormState {
  id?: string
  name: string
  slug: string
  description: string
  price: string
  stock: string
  category: string
  is_active: boolean
}

const EMPTY: FormState = { name: '', slug: '', description: '', price: '', stock: '', category: '', is_active: true }

const inputClass =
  'w-full rounded-lg border border-sand-400 bg-sand-50 px-4 py-2.5 text-base text-charcoal-900 outline-none placeholder:text-charcoal-500 focus:border-teal-700 sm:text-sm'

export default function AdminProducts() {
  const { data: products, isLoading } = useAdminProducts()
  const { data: settings } = useBusinessSettings()
  const lowAt = settings?.shop_low_stock_threshold ?? 2
  const save = useSaveProduct()
  const remove = useDeleteProduct()
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [notice, setNotice] = useState<string | null>(null)

  function edit(p: ProductWithImages, message: string | null = null) {
    setError(null)
    setNotice(message)
    setForm({ id: p.id, name: p.name, slug: p.slug, description: p.description, price: String(p.price), stock: String(p.stock), category: p.category, is_active: p.is_active })
  }

  const categoryOptions = [...new Set((products ?? []).map((p) => p.category))].sort()
  // Photos come from the live list, so they refresh as soon as one is added or removed.
  const editing = form?.id ? products?.find((p) => p.id === form.id) : undefined
  const hasOptions = (editing?.product_variants.length ?? 0) > 0

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setError(null)
    const price = Number(form.price)
    const stock = hasOptions ? (editing?.stock ?? 0) : Number(form.stock)
    const slug = form.id ? form.slug : slugify(form.name)
    if (form.name.trim().length < 2) return setError('Enter a product name.')
    if (!slug) return setError('The name needs some letters or numbers.')
    if (!Number.isInteger(price) || price < 1 || price > 250000) return setError('Price must be a whole number of shillings, from 1 to 250,000.')
    if (!Number.isInteger(stock) || stock < 0) return setError('Stock must be 0 or more.')
    const category = form.category.trim() || 'Other'
    if (category.length < 2 || category.length > 40) return setError('Category must be 2 to 40 characters.')

    try {
      const saved = await save.mutateAsync({
        id: form.id,
        input: { name: form.name.trim(), slug, description: form.description.trim(), price, stock, category, is_active: form.is_active },
      })
      if (form.id) {
        setForm(null)
      } else {
        // A new product needs to exist before photos can be attached to it.
        edit({ ...saved, product_images: [], product_variants: [] }, 'Product added. Now add its photos and colours below.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(/duplicate|unique/i.test(msg) ? 'A product with this name already exists. Use a slightly different name.' : msg || 'Could not save the product.')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Products</h1>
          <p className="mt-1 text-sm text-charcoal-500">What you sell in the shop. Stock goes down as orders come in.</p>
        </div>
        {!form && (
          <button type="button" onClick={() => { setError(null); setNotice(null); setForm(EMPTY) }} className="flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800">
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
          <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
            Category
            <input
              className={inputClass}
              list="product-categories"
              placeholder="e.g. Textiles, Baskets, Jewellery"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              maxLength={40}
            />
            <datalist id="product-categories">
              {categoryOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
            <span className="text-xs font-normal text-charcoal-500">Guests filter the shop by this. Pick an existing one or type a new one. Left empty it becomes "Other".</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              Price (KSh)
              <input className={inputClass} type="number" inputMode="numeric" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-700">
              In stock
              <input
                className={`${inputClass} disabled:opacity-60`}
                type="number"
                inputMode="numeric"
                min={0}
                value={hasOptions ? String(editing?.stock ?? 0) : form.stock}
                disabled={hasOptions}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
              {hasOptions && <span className="text-xs font-normal text-charcoal-500">Total of the colours / options below.</span>}
            </label>
          </div>

          {notice && <p role="status" className="rounded-lg bg-teal-900/10 px-4 py-2 text-sm text-teal-900">{notice}</p>}
          {editing ? (
            <>
              <ProductVariantsEditor productId={editing.id} variants={editing.product_variants} />
              <ProductImageUploader productId={editing.id} images={editing.product_images} />
            </>
          ) : (
            <p className="text-xs text-charcoal-500">Save the product first, then you can add its photos and colours.</p>
          )}

          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Show in the shop
          </label>

          {error && <p role="alert" className="text-sm text-coral-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={save.isPending}>{form.id ? 'Save changes' : 'Add product'}</Button>
            <Button type="button" variant="secondary" onClick={() => setForm(null)}>{form.id ? 'Done' : 'Cancel'}</Button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Product</th>
              <th scope="col" className="px-4 py-3 font-medium">Category</th>
              <th scope="col" className="px-4 py-3 font-medium">Price</th>
              <th scope="col" className="px-4 py-3 font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 font-medium">Shown</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isLoading && <tr><td colSpan={6} className="px-4 py-6"><div className="h-8 animate-pulse rounded bg-sand-200" /></td></tr>}
            {!isLoading && products?.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-charcoal-500">No products yet. Add your first one.</td></tr>}
            {products?.map((p) => (
              <tr key={p.id} className="hover:bg-sand-100/60">
                <td className="px-4 py-3 font-medium text-charcoal-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-sand-200 text-sand-300">
                      {p.image_path ? <img src={getResizedImageUrl('product-images', p.image_path, 80)} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div>
                      {p.name}
                      <span className="block text-xs font-normal text-charcoal-500">{p.product_images.length} photo{p.product_images.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-charcoal-700">{p.category}</td>
                <td className="px-4 py-3 font-figures text-charcoal-700">{formatKES(p.price)}</td>
                <td className={`px-4 py-3 font-figures ${p.stock === 0 ? 'text-coral-500' : 'text-charcoal-700'}`}>
                  {p.stock === 0 ? 'Sold out' : p.stock}
                  {p.stock > 0 && lowAt > 0 && p.stock <= lowAt && <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 font-sans text-[11px] text-charcoal-900">Low</span>}
                  {p.product_variants.some((v) => lowAt > 0 && v.stock <= lowAt && p.stock > lowAt) && <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 font-sans text-[11px] text-charcoal-900">A colour is low</span>}
                </td>
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
