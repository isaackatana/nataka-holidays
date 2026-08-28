import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface TripCartProperty {
  id: string
  title: string
  slug: string
  price_per_night: number
}

export interface TripCartExperience {
  id: string
  title: string
  slug: string
  price: number | null
}

interface TripCartState {
  properties: TripCartProperty[]
  experiences: TripCartExperience[]
}

const STORAGE_KEY = 'nataka-trip-cart'
const EMPTY_STATE: TripCartState = { properties: [], experiences: [] }

function loadFromStorage(): TripCartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    // Defensive shape-check — this is reading from a browser API a user
    // could hand-edit (devtools) or that could hold a shape from an
    // older version of this app after a future schema change, and a
    // malformed cart shouldn't crash the whole site on load.
    if (!Array.isArray(parsed.properties) || !Array.isArray(parsed.experiences)) return EMPTY_STATE
    return parsed
  } catch {
    return EMPTY_STATE
  }
}

interface TripCartContextValue extends TripCartState {
  addProperty: (property: TripCartProperty) => void
  removeProperty: (id: string) => void
  addExperience: (experience: TripCartExperience) => void
  removeExperience: (id: string) => void
  isPropertyInCart: (id: string) => boolean
  isExperienceInCart: (id: string) => boolean
  clear: () => void
  totalCount: number
}

const TripCartContext = createContext<TripCartContextValue | undefined>(undefined)

export function TripCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TripCartState>(loadFromStorage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  function addProperty(property: TripCartProperty) {
    setState((prev) =>
      prev.properties.some((p) => p.id === property.id)
        ? prev
        : { ...prev, properties: [...prev.properties, property] },
    )
  }

  function removeProperty(id: string) {
    setState((prev) => ({ ...prev, properties: prev.properties.filter((p) => p.id !== id) }))
  }

  function addExperience(experience: TripCartExperience) {
    setState((prev) =>
      prev.experiences.some((e) => e.id === experience.id)
        ? prev
        : { ...prev, experiences: [...prev.experiences, experience] },
    )
  }

  function removeExperience(id: string) {
    setState((prev) => ({ ...prev, experiences: prev.experiences.filter((e) => e.id !== id) }))
  }

  function clear() {
    setState(EMPTY_STATE)
  }

  const value: TripCartContextValue = {
    ...state,
    addProperty,
    removeProperty,
    addExperience,
    removeExperience,
    isPropertyInCart: (id) => state.properties.some((p) => p.id === id),
    isExperienceInCart: (id) => state.experiences.some((e) => e.id === id),
    clear,
    totalCount: state.properties.length + state.experiences.length,
  }

  return <TripCartContext.Provider value={value}>{children}</TripCartContext.Provider>
}

export function useTripCart(): TripCartContextValue {
  const ctx = useContext(TripCartContext)
  if (!ctx) throw new Error('useTripCart must be used within a TripCartProvider')
  return ctx
}
