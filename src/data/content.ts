import { ShieldCheck, MessageCircle, MapPin, Sparkles, type LucideIcon } from 'lucide-react'

export interface WhyChooseUsItem {
  title: string
  description: string
  icon: 'shield-check' | 'message-circle' | 'map-pin' | 'sparkles'
}

// Shared between Home.tsx and About.tsx — both render WHY_CHOOSE_US with
// the same icon-per-item mapping, so this lives once here rather than as
// two independently-maintained copies of the same lookup object.
export const WHY_CHOOSE_US_ICONS: Record<WhyChooseUsItem['icon'], LucideIcon> = {
  'shield-check': ShieldCheck,
  'message-circle': MessageCircle,
  'map-pin': MapPin,
  sparkles: Sparkles,
}

export const WHY_CHOOSE_US: WhyChooseUsItem[] = [
  {
    title: 'Verified properties',
    description: 'Every home is inspected and listed by our team — no third-party listings, no surprises on arrival.',
    icon: 'shield-check',
  },
  {
    title: 'Local, on the ground',
    description: 'Based in Diani, not a call centre abroad. We know these homes and this coast personally.',
    icon: 'map-pin',
  },
  {
    title: 'Real people, on WhatsApp',
    description: 'Message us directly about any property — a real person replies, not a chatbot.',
    icon: 'message-circle',
  },
  {
    title: 'Guest services included',
    description: 'Housekeeping, airport transfers, and local experiences arranged for you, not left to figure out alone.',
    icon: 'sparkles',
  },
]
