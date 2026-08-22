import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { AMENITY_ICON_MAP } from '@/components/property/AmenitiesList'
import { useAdminAmenities, useCreateAmenity, useUpdateAmenity, useDeleteAmenity } from '@/features/admin/amenities/queries'
import type { Amenity } from '@/types/domain'

const ICON_NAMES = Object.keys(AMENITY_ICON_MAP)

interface AmenityFormState {
  name: string
  icon: string
}

const EMPTY_FORM: AmenityFormState = { name: '', icon: ICON_NAMES[0] }

export default function AdminAmenities() {
  const { data: amenities, isLoading } = useAdminAmenities()
  const createAmenity = useCreateAmenity()
  const updateAmenity = useUpdateAmenity()
  const deleteAmenity = useDeleteAmenity()

  const [isAdding, setIsAdding] = useState(false)
  const [addForm, setAddForm] = useState<AmenityFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AmenityFormState>(EMPTY_FORM)

  function startEdit(amenity: Amenity) {
    setEditingId(amenity.id)
    setEditForm({ name: amenity.name, icon: amenity.icon ?? ICON_NAMES[0] })
  }

  async function handleCreate() {
    if (!addForm.name.trim()) return
    await createAmenity.mutateAsync({ name: addForm.name.trim(), icon: addForm.icon })
    setAddForm(EMPTY_FORM)
    setIsAdding(false)
  }

  async function handleUpdate(id: string) {
    if (!editForm.name.trim()) return
    await updateAmenity.mutateAsync({ id, input: { name: editForm.name.trim(), icon: editForm.icon } })
    setEditingId(null)
  }

  function handleDelete(amenity: Amenity) {
    if (
      !window.confirm(
        `Delete "${amenity.name}"? This removes it from every property it's currently assigned to as well — that can't be undone.`,
      )
    )
      return
    deleteAmenity.mutate(amenity.id)
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-teal-900">Amenities</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            The shared list every property picks from — shown on listings, filters, and property
            pages.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-medium text-sand-50 hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            New amenity
          </button>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-card border border-sand-200 bg-sand-50">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-sand-200 bg-sand-100 text-xs uppercase tracking-wide text-charcoal-500">
            <tr>
              <th className="px-4 py-3 font-medium">Icon</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {isAdding && (
              <tr className="bg-teal-700/5">
                <td className="px-4 py-3">
                  <select
                    value={addForm.icon}
                    onChange={(e) => setAddForm({ ...addForm, icon: e.target.value })}
                    className="rounded-lg border border-sand-300 bg-sand-50 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                  >
                    {ICON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Air Conditioning"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-1.5 text-sm outline-none placeholder:text-charcoal-300 focus:border-teal-700"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCreate}
                      aria-label="Save"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-teal-800 hover:bg-teal-700/10"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setAddForm(EMPTY_FORM)
                      }}
                      aria-label="Cancel"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-sand-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={3} className="px-4 py-4">
                    <div className="h-8 animate-pulse rounded bg-sand-200" />
                  </td>
                </tr>
              ))}

            {!isLoading && amenities?.length === 0 && !isAdding && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-charcoal-500">
                  No amenities yet. Add your first one.
                </td>
              </tr>
            )}

            {amenities?.map((amenity) => {
              const isEditing = editingId === amenity.id
              const IconComponent = amenity.icon ? AMENITY_ICON_MAP[amenity.icon] : undefined

              if (isEditing) {
                return (
                  <tr key={amenity.id} className="bg-teal-700/5">
                    <td className="px-4 py-3">
                      <select
                        value={editForm.icon}
                        onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                        className="rounded-lg border border-sand-300 bg-sand-50 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                      >
                        {ICON_NAMES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        autoFocus
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(amenity.id)}
                        className="w-full rounded-lg border border-sand-300 bg-sand-50 px-3 py-1.5 text-sm outline-none focus:border-teal-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(amenity.id)}
                          aria-label="Save"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-teal-800 hover:bg-teal-700/10"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-sand-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={amenity.id} className="hover:bg-sand-100/60">
                  <td className="px-4 py-3">
                    {IconComponent ? (
                      <IconComponent className="h-4 w-4 text-teal-700" />
                    ) : (
                      <span className="text-xs text-charcoal-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal-900">{amenity.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(amenity)}
                        aria-label="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-sand-200 hover:text-teal-800"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(amenity)}
                        aria-label="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-500 hover:bg-coral-500/10 hover:text-coral-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
