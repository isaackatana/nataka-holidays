import { parseVideoUrl } from '@/utils/video'

export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const video = parseVideoUrl(url)
  if (!video) return null

  if (video.kind === 'direct') {
    return (
      // No caption track: these are admin-pasted links with no captions
      // file available to attach, not an oversight.
      <video
        src={video.embedUrl}
        controls
        playsInline
        className="aspect-video w-full rounded-card bg-charcoal-900"
      >
        Your browser doesn't support embedded video.{' '}
        <a href={video.embedUrl} className="underline">
          Watch it directly
        </a>
        .
      </video>
    )
  }

  return (
    <iframe
      src={video.embedUrl}
      title={title}
      className="aspect-video w-full rounded-card"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}
