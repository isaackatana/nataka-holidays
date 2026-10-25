const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined

/**
 * Builds a wa.me link that opens WhatsApp with a pre-filled message.
 * Falls back gracefully (still returns a valid wa.me URL, just without a
 * number) if VITE_WHATSAPP_NUMBER hasn't been configured yet, so the UI
 * never throws over a missing env var — it just won't be a useful link
 * until the business number is set.
 */
export function buildWhatsAppLink(message: string): string {
  const number = WHATSAPP_NUMBER ?? ''
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${number}?text=${encoded}`
}

export function buildPropertyEnquiryMessage(propertyTitle: string, propertyUrl: string): string {
  return `Hello Nataka Holidays, I am interested in ${propertyTitle}. ${propertyUrl}`
}

export function buildExperienceEnquiryMessage(experienceTitle: string, experienceUrl: string): string {
  return `Hello Nataka Holidays, I am interested in the ${experienceTitle} experience. ${experienceUrl}`
}

export function buildProductEnquiryMessage(productName: string, productUrl: string): string {
  return `Hello Nataka Holidays, I have a question about ${productName} from the shop. ${productUrl}`
}

/** A wa.me link with no number: opens WhatsApp's own "choose a contact" screen to send the text on. */
export function buildWhatsAppShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
