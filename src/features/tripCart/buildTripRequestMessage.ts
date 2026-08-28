import type { TripCartProperty, TripCartExperience } from './TripCartContext'
import { formatKES } from '@/utils/currency'

interface BuildTripMessageInput {
  properties: TripCartProperty[]
  experiences: TripCartExperience[]
  checkIn?: string
  checkOut?: string
  guests?: number
  notes?: string
}

/** Plain-text summary used both as the WhatsApp message body and the
 * `contact_messages.message` field, so a staff member sees the exact
 * same request whether they check WhatsApp or the admin Messages inbox. */
export function buildTripRequestMessage({
  properties,
  experiences,
  checkIn,
  checkOut,
  guests,
  notes,
}: BuildTripMessageInput): string {
  const lines: string[] = ['Hello Nataka Holidays, I would like to put together a trip:']

  if (properties.length > 0) {
    lines.push('', 'Stays:')
    for (const p of properties) {
      lines.push(`- ${p.title} (${formatKES(p.price_per_night)}/night)`)
    }
  }

  if (experiences.length > 0) {
    lines.push('', 'Experiences:')
    for (const e of experiences) {
      lines.push(`- ${e.title}${e.price !== null ? ` (${formatKES(e.price)})` : ''}`)
    }
  }

  if (checkIn && checkOut) {
    lines.push('', `Dates: ${checkIn} to ${checkOut}`)
  }
  if (guests) {
    lines.push(`Guests: ${guests}`)
  }
  if (notes) {
    lines.push('', `Notes: ${notes}`)
  }

  lines.push('', 'Please confirm availability and let me know the total price.')

  return lines.join('\n')
}
