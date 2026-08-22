import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { getPublicImageUrl } from '@/utils/storage'

interface GalleryImage {
  storage_path: string
  sort_order: number
}

interface GalleryProps {
  images: GalleryImage[]
  title: string
  /** Which Storage bucket these images live in — properties and
   * experiences use separate buckets (see supabase/migrations/0004_storage.sql). */
  bucket: 'property-images' | 'experience-images'
}

export function Gallery({ images, title, bucket }: GalleryProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)
  const urls = sorted.map((img) => getPublicImageUrl(bucket, img.storage_path))

  if (urls.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-card bg-sand-200 text-charcoal-400">
        <span className="font-mono text-sm">No photos yet</span>
      </div>
    )
  }

  return (
    <>
      {/* Desktop grid: hero + up to 4 thumbnails */}
      <div className="hidden gap-2 md:grid md:h-[420px] md:grid-cols-4 md:grid-rows-2">
        <button
          onClick={() => setViewerIndex(0)}
          className="relative col-span-2 row-span-2 overflow-hidden rounded-l-card"
        >
          <img src={urls[0]} alt={title} className="h-full w-full object-cover transition-transform hover:scale-105" />
        </button>
        {urls.slice(1, 5).map((url, i) => (
          <button
            key={url}
            onClick={() => setViewerIndex(i + 1)}
            className={`relative overflow-hidden ${i === 1 ? 'rounded-tr-card' : ''} ${i === 3 ? 'rounded-br-card' : ''}`}
          >
            <img src={url} alt={`${title} photo ${i + 2}`} className="h-full w-full object-cover transition-transform hover:scale-105" />
            {i === 3 && urls.length > 5 && (
              <span className="absolute inset-0 flex items-center justify-center bg-charcoal-900/50 text-sm font-medium text-sand-50">
                +{urls.length - 5} more
              </span>
            )}
          </button>
        ))}
        {/* Fill empty slots if fewer than 5 photos */}
        {Array.from({ length: Math.max(0, 5 - urls.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-sand-200" />
        ))}
      </div>

      <button
        onClick={() => setViewerIndex(0)}
        className="mt-2 hidden items-center gap-1.5 text-xs font-medium text-charcoal-500 hover:text-teal-800 md:flex"
      >
        <Expand className="h-3.5 w-3.5" />
        View all {urls.length} photos
      </button>

      {/* Mobile: swipeable strip */}
      <div className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 md:hidden">
        {urls.map((url, i) => (
          <button
            key={url}
            onClick={() => setViewerIndex(i)}
            className="aspect-[4/3] w-[85vw] shrink-0 snap-center overflow-hidden rounded-card"
          >
            <img src={url} alt={`${title} photo ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {viewerIndex !== null && (
        <FullscreenViewer
          urls={urls}
          index={viewerIndex}
          title={title}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </>
  )
}

function FullscreenViewer({
  urls,
  index,
  title,
  onClose,
  onNavigate,
}: {
  urls: string[]
  index: number
  title: string
  onClose: () => void
  onNavigate: (i: number) => void
}) {
  const goPrev = () => onNavigate((index - 1 + urls.length) % urls.length)
  const goNext = () => onNavigate((index + 1) % urls.length)

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-charcoal-900/95"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'ArrowLeft') goPrev()
        if (e.key === 'ArrowRight') goNext()
      }}
      tabIndex={-1}
      ref={(el) => el?.focus()}
    >
      <div className="flex items-center justify-between px-6 py-4 text-sand-50">
        <span className="font-mono text-xs">
          {index + 1} / {urls.length}
        </span>
        <button onClick={onClose} aria-label="Close gallery">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-6">
        <button
          onClick={goPrev}
          aria-label="Previous photo"
          className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/10 text-sand-50 hover:bg-sand-50/20 md:left-6"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <img
          src={urls[index]}
          alt={`${title} photo ${index + 1}`}
          className="max-h-full max-w-full rounded-lg object-contain"
        />

        <button
          onClick={goNext}
          aria-label="Next photo"
          className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/10 text-sand-50 hover:bg-sand-50/20 md:right-6"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
