/**
 * Mirrors the `profiles` table from supabase/migrations/0001_initial_schema.sql.
 * Once a live Supabase project exists and `src/types/database.types.ts` is
 * regenerated (see supabase/README.md §4), this can be replaced with:
 *   export type Profile = Database['public']['Tables']['profiles']['Row']
 */
export type UserRole = 'customer' | 'admin'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export type PropertyType = 'villa' | 'apartment' | 'cottage' | 'beach_house' | 'other'
export type BookingStatus = 'pending' | 'contacted' | 'confirmed' | 'cancelled' | 'completed'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface PropertyImage {
  id: string
  property_id: string
  storage_path: string
  sort_order: number
  is_primary: boolean
}

export interface Amenity {
  id: string
  name: string
  icon: string | null
}

export interface Property {
  id: string
  title: string
  slug: string
  description: string
  location: string
  latitude: number | null
  longitude: number | null
  property_type: PropertyType
  price_per_night: number
  cleaning_fee: number
  max_guests: number
  bedrooms: number
  bathrooms: number
  house_rules: string | null
  check_in_time: string
  check_out_time: string
  video_url: string | null
  is_featured: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  // Joined data — present when fetched via the properties service, not a
  // raw column on the `properties` table itself.
  property_images?: PropertyImage[]
  amenities?: Amenity[]
}

export interface AdminPropertyDetail extends Property {
  amenityIds: string[]
}

export interface Experience {
  id: string
  title: string
  slug: string
  description: string
  location: string | null
  price: number | null
  duration: string | null
  video_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  /** Optional detail fields (migration 0025). Missing until it has been run. */
  price_type?: 'per_person' | 'per_group' | null
  category?: string | null
  included?: string | null
  meeting_point?: string | null
  min_age?: number | null
  what_to_bring?: string | null
  max_group_size?: number | null
  cancellation_policy?: string | null
  /** Migration 0027: share of the total paid up front online; empty means online payment is off. */
  deposit_percent?: number | null
  experience_images?: { id: string; storage_path: string; sort_order: number }[]
}

export interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  stock: number
  image_path: string | null
  /** What the shop filter groups by, e.g. "Textiles". */
  category: string
  is_active: boolean
  created_at: string
  updated_at: string
  /** Only present on the shop list: how many options it has (to show "Choose colour"). */
  product_variants?: { id: string }[]
}

export interface BackInStockRequest {
  id: string
  customer_id: string
  product_id: string
  variant_id: string | null
  created_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  sort_order: number
}

/** A colour / option of a product, with its own stock. */
export interface ProductVariant {
  id: string
  product_id: string
  name: string
  stock: number
  sort_order: number
}

export interface ProductWithImages extends Product {
  product_images: ProductImage[]
  product_variants: ProductVariant[]
}

export type OrderStatus = 'pending_payment' | 'paid' | 'packed' | 'completed' | 'cancelled' | 'expired'
export type Fulfilment = 'handover' | 'delivery'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  variant_id?: string | null
  variant_name?: string | null
  unit_price: number
  quantity: number
}

export interface OrderPayment {
  id: string
  order_id: string
  amount: number
  status: 'pending' | 'success' | 'failed'
  created_at: string
}

export interface DiscountCode {
  id: string
  code: string
  kind: 'percent' | 'amount'
  value: number
  min_subtotal: number
  max_uses: number | null
  uses: number
  once_per_guest: boolean
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface Order {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  fulfilment: Fulfilment
  handover_note: string | null
  delivery_address: string | null
  subtotal: number
  delivery_fee: number
  discount_code: string | null
  discount_amount: number
  gift_wrap: boolean
  gift_wrap_fee: number
  gift_message: string | null
  total: number
  status: OrderStatus
  expires_at: string
  paid_at: string | null
  admin_note: string | null
  created_at: string
  order_items?: OrderItem[]
  order_payments?: OrderPayment[]
}
