import { useState } from 'react'
import { MessageSquareReply } from 'lucide-react'
import { OWNER_REPLY_MAX } from '@/services/admin/reviews.service'

interface ReviewReplyEditorProps {
  reviewId: string
  initial: string | null
  /** Saves the reply; an empty string removes it. Rejects on failure. */
  onSave: (reply: string) => Promise<void>
  isSaving: boolean
}

/** Write, edit or remove the business's public reply to a review (stays and experiences). */
export function ReviewReplyEditor({ reviewId, initial, onSave, isSaving }: ReviewReplyEditorProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(initial ?? '')
  const [error, setError] = useState<string | null>(null)

  async function handleSave(value: string) {
    setError(null)
    try {
      await onSave(value)
      if (!value.trim()) setText('')
      setEditing(false)
    } catch {
      setError("Couldn't save the reply. Please try again.")
    }
  }

  if (!editing) {
    return (
      <div className="mt-3">
        {initial && (
          <div className="rounded-lg border-l-2 border-teal-700 bg-sand-100 p-3">
            <p className="text-xs font-medium text-teal-900">Your public reply</p>
            <p className="mt-1 whitespace-pre-line text-sm text-charcoal-700">{initial}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setText(initial ?? '')
            setEditing(true)
          }}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-800 hover:underline"
        >
          <MessageSquareReply className="h-3.5 w-3.5" />
          {initial ? 'Edit reply' : 'Reply publicly'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label htmlFor={`reply-${reviewId}`} className="text-xs font-medium text-charcoal-700">
        Public reply (shown under the review)
      </label>
      <textarea
        id={`reply-${reviewId}`}
        rows={3}
        maxLength={OWNER_REPLY_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="rounded-lg border border-sand-400 bg-sand-50 px-3 py-2 text-base text-charcoal-900 outline-none focus:border-teal-700 sm:text-sm"
      />
      {error && <p className="text-xs text-coral-500">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving || !text.trim()}
          onClick={() => handleSave(text)}
          className="rounded-full bg-teal-900 px-4 py-1.5 text-xs font-medium text-sand-50 hover:bg-teal-800 disabled:opacity-60"
        >
          Save reply
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => setEditing(false)}
          className="rounded-full border border-sand-300 px-4 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-sand-100"
        >
          Cancel
        </button>
        {initial && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave('')}
            className="rounded-full border border-sand-300 px-4 py-1.5 text-xs font-medium text-coral-500 hover:bg-coral-500/10"
          >
            Remove reply
          </button>
        )}
      </div>
    </div>
  )
}
