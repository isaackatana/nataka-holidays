-- =========================================================
-- seed.sql
-- Sample data for local development only. Safe to run repeatedly in a
-- throwaway local/dev database (uses fixed UUIDs + ON CONFLICT DO NOTHING).
-- Does NOT create any auth.users / profiles rows — see "Creating your
-- first admin" in supabase/README.md for how to promote a real signed-up
-- user to admin instead.
-- =========================================================

-- ---------------------------------------------------------
-- Amenities
-- ---------------------------------------------------------
insert into amenities (id, name, icon) values
  ('a0000000-0000-0000-0000-000000000001', 'WiFi', 'wifi'),
  ('a0000000-0000-0000-0000-000000000002', 'Swimming Pool', 'waves'),
  ('a0000000-0000-0000-0000-000000000003', 'Air Conditioning', 'snowflake'),
  ('a0000000-0000-0000-0000-000000000004', 'Beach Access', 'palmtree'),
  ('a0000000-0000-0000-0000-000000000005', 'Free Parking', 'car'),
  ('a0000000-0000-0000-0000-000000000006', 'Kitchen', 'utensils'),
  ('a0000000-0000-0000-0000-000000000007', 'Backup Generator', 'zap'),
  ('a0000000-0000-0000-0000-000000000008', 'Housekeeping', 'sparkles'),
  ('a0000000-0000-0000-0000-000000000009', 'Security / Askari', 'shield'),
  ('a0000000-0000-0000-0000-000000000010', 'Garden', 'flower-2')
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Properties (created_by left null — no seeded admin user)
-- ---------------------------------------------------------
insert into properties (
  id, title, slug, description, location, latitude, longitude,
  property_type, price_per_night, cleaning_fee, max_guests, bedrooms,
  bathrooms, house_rules, is_featured, is_published
) values
  (
    'b0000000-0000-0000-0000-000000000001',
    'Azure Reef Villa',
    'azure-reef-villa-diani',
    'A five-bedroom beachfront villa with private access to Diani''s white sand, an infinity pool facing the Indian Ocean, and a full-time housekeeping team.',
    'Diani Beach, Kwale',
    -4.3167, 39.5764,
    'villa', 45000, 5000, 10, 5, 5,
    'No parties. Check-in after 2pm. No smoking indoors.',
    true, true
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'Baobab Garden Cottage',
    'baobab-garden-cottage-diani',
    'A quiet two-bedroom cottage set in a tropical garden five minutes'' walk from the beach, ideal for couples or small families.',
    'Diani Beach, Kwale',
    -4.3241, 39.5701,
    'cottage', 12000, 2000, 4, 2, 2,
    'Check-out by 10am. Pets not allowed.',
    false, true
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'Coral Sands Apartment',
    'coral-sands-apartment-diani',
    'A modern one-bedroom apartment in a beachfront complex with a shared pool, gym access, and 24-hour security.',
    'Diani Beach, Kwale',
    -4.3105, 39.5820,
    'apartment', 8500, 1500, 2, 1, 1,
    'No smoking. Quiet hours after 10pm.',
    true, true
  )
on conflict (id) do nothing;

insert into property_amenities (property_id, amenity_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000010'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005')
on conflict do nothing;

-- Image rows reference storage paths that don't exist yet — upload matching
-- files to the property-images bucket locally, or swap these for real
-- paths/URLs once you're wiring up the gallery component.
insert into property_images (property_id, storage_path, sort_order, is_primary) values
  ('b0000000-0000-0000-0000-000000000001', 'azure-reef-villa/01-exterior.jpg', 0, true),
  ('b0000000-0000-0000-0000-000000000001', 'azure-reef-villa/02-pool.jpg', 1, false),
  ('b0000000-0000-0000-0000-000000000002', 'baobab-garden-cottage/01-exterior.jpg', 0, true),
  ('b0000000-0000-0000-0000-000000000003', 'coral-sands-apartment/01-living-room.jpg', 0, true)
on conflict do nothing;

-- ---------------------------------------------------------
-- Experiences
-- ---------------------------------------------------------
insert into experiences (id, title, slug, description, location, price, duration, is_published) values
  (
    'c0000000-0000-0000-0000-000000000001',
    'Wasini Island & Dolphin Tour',
    'wasini-island-dolphin-tour',
    'A full-day dhow trip to Wasini Island with dolphin watching, snorkeling at Kisite Marine Park, and a seafood lunch.',
    'Shimoni, Kwale', 7500, 'Full day', true
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Diani Skydive',
    'diani-skydive',
    'Tandem skydive over Diani Beach with coastline views from 10,000 feet.',
    'Diani Beach, Kwale', 45000, '3 hours', true
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'Airport Transfer — Mombasa (MBA) to Diani',
    'airport-transfer-mombasa-diani',
    'Private car transfer between Moi International Airport and your Diani accommodation.',
    'Mombasa & Diani', 3500, '1.5 hours', true
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Coast-wide sample data (added when the business broadened
-- from Diani-only to the full Kenyan coastline, Lamu included).
-- ---------------------------------------------------------
insert into properties (
  id, title, slug, description, location, latitude, longitude,
  property_type, price_per_night, cleaning_fee, max_guests, bedrooms,
  bathrooms, house_rules, is_featured, is_published
) values
  (
    'b0000000-0000-0000-0000-000000000004',
    'Shela Dune House',
    'shela-dune-house',
    'A restored Swahili coral-stone house in Shela village, a few minutes'' walk from twelve kilometres of open dune beach. Rooftop terrace, four-poster beds, and a resident house manager.',
    'Shela, Lamu',
    -2.2897, 40.8714,
    'villa', 38000, 4500, 8, 4, 4,
    'No shoes indoors. Respect local dress customs in the village.',
    true, true
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    'Watamu Reef Cottage',
    'watamu-reef-cottage',
    'A two-bedroom cottage a short walk from Watamu Marine National Park, with a shaded garden and easy access to some of the best snorkelling on the coast.',
    'Watamu, Kilifi',
    -3.3556, 40.0197,
    'cottage', 14000, 2000, 4, 2, 2,
    'Check-out by 10am. No loud music after 10pm.',
    false, true
  ),
  (
    'b0000000-0000-0000-0000-000000000006',
    'Kilifi Creek Apartment',
    'kilifi-creek-apartment',
    'A modern one-bedroom apartment overlooking Kilifi Creek, with a shared pool and a dhow jetty a few minutes away.',
    'Kilifi',
    -3.6305, 39.8499,
    'apartment', 9500, 1500, 3, 1, 1,
    'No smoking indoors.',
    false, true
  )
on conflict (id) do nothing;

insert into experiences (id, title, slug, description, location, price, duration, is_published) values
  (
    'c0000000-0000-0000-0000-000000000004',
    'Lamu Dhow Sunset Sail',
    'lamu-dhow-sunset-sail',
    'A traditional dhow sail through the Lamu channel at golden hour, with the option of a fresh seafood dinner on board.',
    'Lamu Island', 6000, '3 hours', true
  ),
  (
    'c0000000-0000-0000-0000-000000000005',
    'Watamu Marine Park Snorkelling',
    'watamu-marine-park-snorkelling',
    'A guided boat trip out to the coral gardens of Watamu Marine National Park, one of Kenya''s oldest protected reefs.',
    'Watamu, Kilifi', 5500, 'Half day', true
  ),
  (
    'c0000000-0000-0000-0000-000000000006',
    'Mombasa Old Town & Fort Jesus Walk',
    'mombasa-old-town-fort-jesus-walk',
    'A guided walk through the Swahili lanes of Mombasa Old Town, finishing at the 16th-century Fort Jesus.',
    'Mombasa', 3500, '3 hours', true
  ),
  (
    'c0000000-0000-0000-0000-000000000007',
    'Airport Transfer — Manda (LAU) to Lamu or Shela',
    'airport-transfer-manda-lamu',
    'Boat transfer from Manda Airport across the channel to Lamu town or Shela, met on arrival.',
    'Lamu', 2500, '30 minutes', true
  )
on conflict (id) do nothing;
