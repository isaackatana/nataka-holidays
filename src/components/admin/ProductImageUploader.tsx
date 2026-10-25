import { useRef, useState } from 'react'
import { ImagePlus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { getPublicImageUrl } from '@/utils/storage'
import { useDeleteProductImage, useReorderProductImages, useUploadProductImage } from '@/features/admin/shop/queries'
import type { ProductImage } from '@/types/domain'

const MAX_FILE_SIZE_MB = 25
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PRODUCT_PHOTOS = 8

/** Photos for one product. The first photo is the cover shown in the shop grid. */
export function ProductImageUploader({ productId, images }: { productId: string; images: ProductImage[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useUploadProductImage(productId)
  const remove = useDeleteProductImage()
  const reorder = useReorderProductImages(productId)
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    let count = sorted.length
    for (const file of Array.from(files)) {
      if (count >= MAX_PRODUCT_PHOTOS) {
        setError(`A product can have up to ${MAX_PRODUCT_PHOTOS} photos.`)
        break
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name}: only JPEG, PNG or WebP images are allowed.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`${file.name}: must be under ${MAX_FILE_SIZE_MB}MB.`)
        continue
      }
      try {
        // One at a time so each photo gets the next sort_order.
        await upload.mutateAsync({ file, currentCount: count })
        count += 1
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not upload ${file.name}.`)
      }
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const next = [...sorted]
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder.mutate(next.map((i) => i.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-charcoal-700">Photos ({sorted.length}/{MAX_PRODUCT_PHOTOS})</p>
        <p className="text-xs text-charcoal-500">The first photo is the cover in the shop. Use the arrows to reorder.</p>
      </div>

      {sorted.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {sorted.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-lg bg-sand-200">
              <div className="relative">
                <img
                  src={getPublicImageUrl('product-images', image.storage_path)}
                  alt={`Photo ${index + 1}${index === 0 ? ' (cover)' : ''}`}
                  className="aspect-square w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-pill bg-gold-600 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sand-50">Cover</span>
                )}
              </div>
              <div className="flex items-center justify-between bg-sand-100 px-1 py-1">
                <button type="button" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-700 hover:bg-sand-200 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" aria-label={`Move photo ${index + 1} later`} disabled={index === sorted.length - 1 || reorder.isPending} onClick={() => move(index, 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-700 hover:bg-sand-200 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                <button type="button" aria-label={`Delete photo ${index + 1}`} disabled={remove.isPending} onClick={() => remove.mutate(image)} className="flex h-8 w-8 items-center justify-center rounded-full text-coral-500 hover:bg-coral-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sorted.length < MAX_PRODUCT_PHOTOS && (
        <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-teal-900 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-900 hover:text-sand-50">
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
          {upload.isPending ? 'Uploading...' : sorted.length === 0 ? 'Add photos' : 'Add more photos'}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}

      {(error || remove.isError || reorder.isError) && (
        <p role="alert" className="text-sm text-coral-500">{error ?? 'Could not update the photos. Please try again.'}</p>
      )}
    </div>
  )
}
