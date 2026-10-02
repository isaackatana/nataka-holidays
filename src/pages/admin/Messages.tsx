import { useState } from 'react'
import { Mail, MailOpen, Trash2, Phone } from 'lucide-react'
import {
  useAdminContactMessages,
  useMarkContactMessageRead,
  useDeleteContactMessage,
} from '@/features/admin/contactMessages/queries'

export default function AdminMessages() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: messages, isLoading } = useAdminContactMessages(unreadOnly ? { unreadOnly: true } : {})
  const markRead = useMarkContactMessageRead()
  const deleteMessage = useDeleteContactMessage()

  function toggleExpand(id: string, isRead: boolean) {
    setExpandedId(expandedId === id ? null : id)
    // Mark as read the moment an admin actually opens it — a simpler,
    // more honest signal than a separate "mark read" button nobody clicks.
    if (!isRead) markRead.mutate({ id, isRead: true })
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this message? This can't be undone.")) return
    deleteMessage.mutate(id)
    if (expandedId === id) setExpandedId(null)
  }

  const unreadCount = messages?.filter((m) => !m.is_read).length ?? 0

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Messages</h1>
          <p className="mt-1 text-sm text-charcoal-500">Submissions from the public Contact page.</p>
        </div>
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
            unreadOnly ? 'bg-teal-900 text-sand-50' : 'bg-sand-100 text-charcoal-600 hover:bg-sand-200'
          }`}
        >
          Unread only{!isLoading && unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-card bg-sand-200" />
          ))}

        {!isLoading && messages?.length === 0 && (
          <div className="rounded-card border border-sand-200 bg-sand-50 py-12 text-center text-charcoal-500">
            {unreadOnly ? 'No unread messages.' : 'No messages yet.'}
          </div>
        )}

        {messages?.map((msg) => {
          const isExpanded = expandedId === msg.id
          return (
            <div
              key={msg.id}
              className={`rounded-card border p-5 transition-colors ${
                msg.is_read ? 'border-sand-200 bg-sand-50' : 'border-teal-700/30 bg-teal-700/5'
              }`}
            >
              <button
                onClick={() => toggleExpand(msg.id, msg.is_read)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div className="flex items-start gap-3">
                  {msg.is_read ? (
                    <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-600" />
                  ) : (
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  )}
                  <div>
                    <p className={`text-sm ${msg.is_read ? 'font-medium text-charcoal-700' : 'font-semibold text-charcoal-900'}`}>
                      {msg.name}
                      {msg.subject && <span className="text-charcoal-500"> — {msg.subject}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-charcoal-500">{msg.email}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-charcoal-600">
                  {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </button>

              {isExpanded && (
                <div className="mt-4 border-t border-sand-200 pt-4">
                  <p className="whitespace-pre-line text-sm text-charcoal-700">{msg.message}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-charcoal-500">
                      <a href={`mailto:${msg.email}`} className="flex items-center gap-1.5 hover:text-teal-800">
                        <Mail className="h-3.5 w-3.5" />
                        Reply by email
                      </a>
                      {msg.phone && (
                        <a href={`tel:${msg.phone}`} className="flex items-center gap-1.5 hover:text-teal-800">
                          <Phone className="h-3.5 w-3.5" />
                          {msg.phone}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(msg.id)}
                      aria-label="Delete message"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-coral-500 hover:bg-coral-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
