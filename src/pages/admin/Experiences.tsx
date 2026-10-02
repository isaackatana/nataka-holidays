import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import {
  useAdminExperiences,
  useDeleteExperience,
  useToggleExperiencePublished,
} from '@/features/admin/experiences/queries'
import { formatKES } from '@/utils/currency'

export default function AdminExperiences() {
  const { data: experiences, isLoading } = useAdminExperiences()
  const deleteExperience = useDeleteExperience()
  const togglePublished = useToggleExperiencePublished()

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return
    deleteExperience.mutate(id)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Experiences</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Local trips and activities shown on the public Experiences page.
          </p>
        </div>
        <Link
          to="/admin/experiences/new"
          className="flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          New experience
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="h-8 animate-pulse rounded bg-sand-200" />
                  </td>
                </tr>
              ))}

            {!isLoading && experiences?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-charcoal-500">
                  No experiences yet. Add your first one.
                </td>
              </tr>
            )}

            {experiences?.map((exp) => (
              <tr key={exp.id} className="hover:bg-sand-100/60">
                <td className="px-4 py-3 font-medium text-charcoal-900">{exp.title}</td>
                <td className="px-4 py-3 text-charcoal-700">{exp.location ?? '—'}</td>
                <td className="px-4 py-3 font-figures text-charcoal-700">
                  {exp.price !== null ? formatKES(exp.price) : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() =>
                      togglePublished.mutate({ id: exp.id, isPublished: !exp.is_published })
                    }
                    className={`flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium ${
                      exp.is_published
                        ? 'bg-teal-900/10 text-teal-800'
                        : 'bg-charcoal-500/10 text-charcoal-500'
                    }`}
                  >
                    {exp.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {exp.is_published ? 'Published' : 'Draft'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/admin/experiences/${exp.id}/edit`}
                      aria-label="Edit"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-sand-200 hover:text-teal-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(exp.id, exp.title)}
                      aria-label="Delete"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
