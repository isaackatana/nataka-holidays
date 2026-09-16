export interface Destination {
  name: string
  description: string
  /** Rough region grouping, south to north along the coastline. Used to
   * order and group destinations consistently wherever they're shown. */
  region: 'South Coast' | 'Mombasa' | 'North Coast' | 'Lamu Archipelago'
}

/**
 * Ordered south-to-north along the Kenyan coastline. This is marketing
 * content for browsing/discovery — it is NOT the source of truth for
 * which locations have listings; that comes from the `location` field on
 * actual properties and experiences in the database.
 */
export const DESTINATIONS: Destination[] = [
  // ---- South Coast ----
  {
    name: 'Diani Beach',
    description:
      "Powder-white sand and turquoise water along Kenya's most celebrated stretch of coast, lined with palms and coral reef just offshore.",
    region: 'South Coast',
  },
  {
    name: 'Tiwi Beach',
    description:
      'Quieter and less developed than Diani, ten minutes north — favoured by those who want the coast without the crowds.',
    region: 'South Coast',
  },
  {
    name: 'Galu Beach',
    description:
      'A long, uncrowded stretch south of Diani, popular for kite surfing when the kusi winds pick up from June to September.',
    region: 'South Coast',
  },
  {
    name: 'Wasini & Kisite',
    description:
      'A short boat ride south to a marine park known for dolphin pods, coral gardens, and traditional dhow sailing trips.',
    region: 'South Coast',
  },
  // ---- Mombasa ----
  {
    name: 'Mombasa',
    description:
      "The coast's largest city — Fort Jesus, the spice-scented lanes of Old Town, and the island's Swahili architecture.",
    region: 'Mombasa',
  },
  {
    name: 'Nyali & Bamburi',
    description:
      'Mombasa\'s north-shore beaches, close to the city but with resort-lined sand, reef snorkelling and easy access to restaurants.',
    region: 'Mombasa',
  },
  // ---- North Coast ----
  {
    name: 'Kilifi',
    description:
      'Built around a creek of calm turquoise water — sailing, kitesurfing, and a quieter, more residential pace than the big resort strips.',
    region: 'North Coast',
  },
  {
    name: 'Watamu',
    description:
      'A marine national park with some of the best snorkelling and diving on the coast, plus the Arabuko Sokoke forest and Mida Creek nearby.',
    region: 'North Coast',
  },
  {
    name: 'Malindi',
    description:
      'A long sweep of beach with a strong Italian-Swahili influence, historic Vasco da Gama pillar, and easy reach of Marafa Depression.',
    region: 'North Coast',
  },
  // ---- Lamu Archipelago ----
  {
    name: 'Lamu Island',
    description:
      'A UNESCO World Heritage site and the oldest continually inhabited Swahili settlement — car-free lanes, dhow sailing, and coral-stone houses.',
    region: 'Lamu Archipelago',
  },
  {
    name: 'Shela',
    description:
      "Lamu's quieter village neighbour, with twelve kilometres of open dune-backed beach and a cluster of restored Swahili houses.",
    region: 'Lamu Archipelago',
  },
  {
    name: 'Manda & Kiwayu',
    description:
      'Island escapes across the channel from Lamu — remote sandbanks, mangrove channels, and some of the most secluded stays on the coast.',
    region: 'Lamu Archipelago',
  },
]

/** The regions in south-to-north order, for grouping/filter UIs. */
export const DESTINATION_REGIONS = [
  'South Coast',
  'Mombasa',
  'North Coast',
  'Lamu Archipelago',
] as const
