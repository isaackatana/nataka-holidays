import { useRef, useState } from 'react'
import { ImagePlus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import type { ExperienceImage } from '@/services/admin/experienceImages.service'
import { getPublicImageUrl } from '@/utils/storage'
import {
  useUploadExperienceImage,
  useDeleteExperienceImage,
  useReorderExperienceImages,
} from '@/features/admin/experienceImages/queries'

const MAX_FILE_SIZE_MB = 8
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ExperienceImageUploaderProps {
  experienceId: string
  images: ExperienceImage[]
}

export function ExperienceImageUploader({ experienceId, images }: ExperienceImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = useUploadExperienceImage(experienceId)
  const deleteImage = useDeleteExperienceImage(experienceId)
  const reorder = useReorderExperienceImages(experienceId)

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)

    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`${file.name}: only JPEG, PNG, or WebP images are allowed.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`${file.name}: must be under ${MAX_FILE_SIZE_MB}MB.`)
        continue
      }
      try {
        // Sequential, not Promise.all — same reasoning as the property
        // uploader: currentCount (and therefore sort_order) needs the
        // previous upload's result, not a race between simultaneous ones.
        await upload.mutateAsync({ file, currentCount: sorted.length })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : `Failed to upload ${file.name}`)
      }
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const reordered = [...sorted]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    reorder.mutate(reordered.map((img) => img.id))
  }

  return (
    <div className="rounded-card border border-sand-200 bg-sand-50 p-6">
      <h2 className="font-display text-lg font-medium text-teal-900">Photos</h2>
      <p className="mt-1 text-xs text-charcoal-500">
        JPEG, PNG, or WebP, up to {MAX_FILE_SIZE_MB}MB each. The first photo is used as the cover
        image on the Experiences page.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? 'border-teal-700 bg-teal-700/5' : 'border-sand-300 hover:border-sand-400'
        }`}
      >
        {upload.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        ) : (
          <ImagePlus className="h-6 w-6 text-charcoal-400" />
        )}
        <p className="text-sm text-charcoal-600">
          {upload.isPending ? 'Uploading...' : 'Drag photos here, or click to browse'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {uploadError && <p className="mt-2 text-sm text-coral-500">{uploadError}</p>}

      {sorted.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((image, index) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg bg-sand-200">
              <img
                src={getPublicImageUrl('experience-images', image.storage_path)}
                alt={`Experience photo ${index + 1}${index === 0 ? ' (cover)' : ''}`}
                className="aspect-square w-full object-cover"
              />

              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-pill bg-gold-600 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sand-50">
                  Cover
                </span>
              )}

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-charcoal-900/0 opacity-0 transition-all group-hover:bg-charcoal-900/50 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => deleteImage.mutate({ id: image.id, storage_path: image.storage_path, sort_order: image.sort_order })}
                  aria-label="Delete photo"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-sand-50 text-coral-500 hover:bg-coral-500 hover:text-sand-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move earlier"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-sand-50 text-charcoal-700 hover:bg-teal-800 hover:text-sand-50 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === sorted.length - 1}
                    aria-label="Move later"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-sand-50 text-charcoal-700 hover:bg-teal-800 hover:text-sand-50 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <p className="mt-4 text-center text-sm text-charcoal-400">No photos uploaded yet.</p>
      )}
    </div>
  )
}
