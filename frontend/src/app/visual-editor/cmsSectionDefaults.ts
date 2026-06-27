/** Default CMS content + merge helpers for all homepage sections */

export const DEFAULT_HERO_GALLERY = [
  "https://images.unsplash.com/photo-1660118248632-103511f9b337?w=340&h=440&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1728727242233-0924178c1fb1?w=310&h=390&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1622207691293-5cd80466dab3?w=330&h=420&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1748543668687-624e058c367c?w=300&h=370&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1695972235594-8478ab831602?w=260&h=320&fit=crop&auto=format",
];

export const DEFAULT_FLOATING_LABELS = [
  "5% Ethylated Vitamin C",
  "2% Exosome Technology",
  "Fast Absorbing",
  "Non Greasy",
  "Daily Use",
  "Suitable For Indian Skin",
];

export const DEFAULT_TIMELINE_IMAGES = [
  "https://images.unsplash.com/photo-1643379855542-82c0c7483f3a?w=192&h=192&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1728727242233-0924178c1fb1?w=192&h=192&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1622207691293-5cd80466dab3?w=192&h=192&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1660118248632-103511f9b337?w=192&h=192&fit=crop&auto=format",
];

export const CMS_SECTION_DEFAULTS: Record<string, Record<string, any>> = {
  header: {
    logoText: "ARGLOVE",
    logoSubText: "SKIN",
    logoImageUrl: "",
    cssGlobal: true,
  },
  marquee: {
    items: [
      "FREE Bio-Collagen Deep Mask With Every Order",
      "Free Shipping Across India",
      "Cash On Delivery Available",
    ],
    bgColor: "#FFCC00",
    textColor: "#1A1A1A",
    cssGlobal: true,
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} ARGLOVE. All rights reserved. Results may vary.`,
    cssGlobal: true,
  },
  hero: {
    badge: "New Generation Anti-Aging Technology",
    headline1: "AGE LESS.",
    headline2: "REPAIR",
    headline3: "MORE.",
    description:
      "Powered by Exosome Technology, Ethylated Vitamin C, Peptides, and Bio-Cellular Repair Science to visibly improve skin radiance, texture, hydration, firmness, and overall skin appearance.",
    ctaText: "SHOP NOW",
    imageUrl: "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=480&h=960&fit=crop&auto=format",
    galleryImages: DEFAULT_HERO_GALLERY,
    floatingLabels: DEFAULT_FLOATING_LABELS,
    freeGiftText: "FREE Bio-Collagen Deep Mask Included",
    trustItems: [
      "4.9/5 Customer Rating",
      "Thousands Of Happy Customers",
      "Made For Indian Skin",
      "Dermatologically Tested",
    ],
    benefitItems: [
      "Improves Fine Lines",
      "Supports Skin Firmness",
      "Brightens Uneven Tone",
      "Supports Skin Barrier",
      "Deep Hydration",
      "Fast Absorbing Formula",
    ],
  },
  why: {
    badge: "The Science",
    title: "Why It Works",
    description:
      "Every ingredient in ARGLOVE Serum is chosen for a reason — backed by science, tested for Indian skin, and formulated for real, visible results.",
    imageUrl: "https://images.unsplash.com/photo-1679394270597-e90694d70350?w=700&h=1160&fit=crop&auto=format",
    statNumber: "6-in-1",
    statLabel: "Active Ingredient Complexes Working Together",
  },
  timeline: {
    badge: "Results Timeline",
    title: "Your Skin's Journey",
    timelineImages: DEFAULT_TIMELINE_IMAGES,
  },
  reviews: {
    badge: "Customer Results",
    title: "Real Results. Real People.",
    rating: "4.9",
    customers: "12,000+",
    videoImageUrl: "https://images.unsplash.com/photo-1747264464985-2bc2e20c739e?w=500&h=680&fit=crop&auto=format",
    videoLabel: "Watch Customer Story",
    statLabels: ["Skin Radiance", "Texture", "Hydration", "Firmness"],
    statValues: ["98", "96", "99", "94"],
  },
  about: {
    badge: "Our Story",
    title: "Built For the Skin That Isn't Represented Enough",
    imageUrl: "https://images.unsplash.com/photo-1619002117199-47c7f0427d21?w=700&h=1040&fit=crop&auto=format",
    cardLabel: "Founded With Purpose",
    cardTitle: "For Indian Skin",
  },
  finalcta: {
    headline: "READY TO TRANSFORM",
    subheadline: "YOUR SKIN?",
    features: ["FREE Bio-Collagen Deep Mask", "Free Shipping Across India", "Cash On Delivery Available"],
    ctaText: "BUY NOW",
    bottomStats: ["4.9/5 Rating", "12,000+ Customers", "Dermatologically Tested", "Made For Indian Skin"],
  },
  bestseller: {
    badge: "Bestseller",
    title: "Choose Your Transformation",
    planImage1: "",
    planImage2: "",
    planImage3: "",
  },
};

export function mergeCmsSection(key: string, data?: Record<string, any>): Record<string, any> {
  const defaults = CMS_SECTION_DEFAULTS[key] || {};
  return { ...defaults, ...(data || {}) };
}

export function cmsImageList(cms: Record<string, any> | undefined, key: string, fallback: string[]): string[] {
  const raw = cms?.[key];
  if (!Array.isArray(raw) || raw.length === 0) return fallback;
  return fallback.map((def, i) => String(raw[i] || def).trim() || def);
}

export function cmsString(cms: Record<string, any> | undefined, key: string, fallback: string): string {
  const val = cms?.[key];
  return val !== undefined && val !== null && String(val).trim() !== "" ? String(val) : fallback;
}

export function cmsStringList(cms: Record<string, any> | undefined, key: string, fallback: string[]): string[] {
  const val = cms?.[key];
  if (Array.isArray(val) && val.length > 0) return val.map(String);
  return fallback;
}
