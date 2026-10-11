// Title + description for each fixed public page, used by api/prerender.js
// so WhatsApp / Facebook / X previews show the right text for every page,
// not just stays and experiences. Keep these identical to the <SEO> tag in
// the matching src/pages/public file (api/_pages.test.js fails if they drift).
export const PAGES = {
  home: {
    path: '/',
    file: 'Home.tsx',
    title: 'Villas & Beach Houses on the Kenyan Coast',
    description:
      'Premium villas, apartments and beach houses along the Kenyan Coast — from Diani and the South Coast to Watamu, Malindi and Lamu. Browse holiday homes, check availability and book your getaway.',
  },
  'holiday-homes': {
    path: '/holiday-homes',
    file: 'HolidayHomes.tsx',
    title: 'Holiday Homes on the Kenyan Coast',
    description:
      'Browse villas, apartments, cottages and beach houses along the Kenyan Coast — Diani, Mombasa, Kilifi, Watamu, Malindi and Lamu. Filter by price, bedrooms, guests and amenities.',
  },
  experiences: {
    path: '/experiences',
    file: 'Experiences.tsx',
    title: 'Experiences on the Kenyan Coast',
    description:
      'Dolphin tours, snorkeling, dhow sailing, safaris and airport transfers along the Kenyan Coast — from Diani and Wasini to Watamu, Malindi and Lamu.',
  },
  about: {
    path: '/about',
    file: 'About.tsx',
    title: 'About Us',
    description:
      'Nataka Holidays is a locally-run holiday rental business on the Kenyan Coast, with homes and experiences from Diani to Lamu.',
  },
  contact: {
    path: '/contact',
    file: 'Contact.tsx',
    title: 'Contact Us',
    description:
      'Get in touch with Nataka Holidays about a stay, a booking enquiry, or planning a trip anywhere on the Kenyan Coast.',
  },
  transport: {
    path: '/transport',
    file: 'Transport.tsx',
    title: 'Transport',
    description:
      'Airport transfers, car hire and getting around the Kenyan Coast — Mombasa, Malindi and Lamu — with Nataka Holidays.',
  },
  packages: {
    path: '/packages',
    file: 'Packages.tsx',
    title: 'Packages',
    description: 'Custom stay and experience packages with Nataka Holidays, Diani Beach.',
  },
}
