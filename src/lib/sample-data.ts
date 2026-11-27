export interface Memory {
  id: string;
  title: string;
  caption: string;
  story: string;
  date: string;
  capturedAt: string;
  location: string;
  imageUrl: string;
  aspectRatio?: string;
  mediaType?: "image" | "video" | "audio";
  tag: string;
  isFavorite: boolean;
  author: string;
  rotation?: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  description: string;
  location: string;
  imageUrl: string;
  isCore: boolean;
}

export interface Album {
  id: string;
  title: string;
  memoryCount: number;
  coverImage: string;
  previewImages: string[];
  theme: string;
}

export const SAMPLE_MEMORIES: Memory[] = [
  {
    id: "mem-1",
    title: "Golden Hour by the Coast",
    caption: "The wind was freezing, but neither of us wanted to leave.",
    story: "We sat on the hood of the car wrapped in that giant wool blanket, watching the sun dip into the ocean while eating lukewarm fries. One of those days where nothing went to plan, and yet it was completely perfect.",
    date: "October 18, 2024",
    capturedAt: "2024-10-18T17:45:00Z",
    location: "Coastline Highway",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    tag: "Adventures",
    isFavorite: true,
    author: "Alex",
    rotation: "-rotate-1",
  },
  {
    id: "mem-2",
    title: "Old Town Coffee & The Rainy Day",
    caption: "Four hours of rain, two iced lattes, and endless conversation.",
    story: "We ducked under the striped awning just as the heavens opened up. The café smelled like roasted hazelnut and cinnamon. We ended up writing terrible haikus on napkins.",
    date: "November 24, 2025",
    capturedAt: "2025-11-24T14:30:00Z",
    location: "Old Town Corner Café",
    imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80",
    tag: "Quiet Moments",
    isFavorite: true,
    author: "Maya",
    rotation: "rotate-2",
  },
  {
    id: "mem-3",
    title: "The Midnight Pizza Run",
    caption: "When the car stalled at 2 AM and we turned it into a comedy show.",
    story: "Stranded on 4th Street waiting for the tow truck. We sat on the curb sharing a hot garlic pizza, laughing until our stomachs hurt because we couldn't stop quoting our favorite movie.",
    date: "August 3, 2024",
    capturedAt: "2024-08-03T02:15:00Z",
    location: "Corner Slice Pizzeria",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80",
    tag: "Inside Jokes",
    isFavorite: false,
    author: "Alex",
    rotation: "-rotate-2",
  },
  {
    id: "mem-4",
    title: "The Accidental 10-Mile Trail",
    caption: "Took the wrong turn at mile two and discovered this vista.",
    story: "Our water ran out at mile seven, but coming through the pines and seeing the valley bathed in morning mist made every single blister worth it.",
    date: "July 19, 2024",
    capturedAt: "2024-07-19T09:20:00Z",
    location: "Whispering Pines Ridge",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    tag: "Adventures",
    isFavorite: true,
    author: "Maya",
    rotation: "rotate-1",
  },
  {
    id: "mem-5",
    title: "Record Store Sunday",
    caption: "Finding that vintage Fleetwood Mac vinyl after months of searching.",
    story: "Flipping through dust-covered crates in the basement of that underground record shop. The look on your face when you pulled out Rumours was unforgettable.",
    date: "May 14, 2024",
    capturedAt: "2024-05-14T15:00:00Z",
    location: "Vintage Grooves",
    imageUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80",
    tag: "Milestones",
    isFavorite: false,
    author: "Alex",
    rotation: "-rotate-1",
  },
];

export const SAMPLE_MILESTONES: Milestone[] = [
  {
    id: "ms-1",
    title: "First Road Trip Together",
    date: "October 2024",
    description: "Packed the trunk with snacks, rolled down all four windows, and drove with no destination in mind.",
    location: "Coastline Highway",
    imageUrl: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
    isCore: true,
  },
  {
    id: "ms-2",
    title: "The First Coffee That Started It All",
    date: "April 2024",
    description: "That awkward five minutes that turned into a four-hour conversation about everything and nothing.",
    location: "Old Town Corner Café",
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
    isCore: true,
  },
  {
    id: "ms-3",
    title: "The Midnight Pizza Incident",
    date: "August 2024",
    description: "Car battery died, pizza arrived, and we laughed under the streetlights for hours.",
    location: "Corner Slice Pizzeria",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    isCore: false,
  },
];

export const SAMPLE_ALBUMS: Album[] = [
  {
    id: "alb-1",
    title: "Road Trips & Detours",
    memoryCount: 24,
    coverImage: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
    previewImages: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80",
    ],
    theme: "Adventures",
  },
  {
    id: "alb-2",
    title: "Coffee Shops & Rainy Days",
    memoryCount: 18,
    coverImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
    previewImages: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=400&q=80",
    ],
    theme: "Quiet Moments",
  },
  {
    id: "alb-3",
    title: "Silly Moments & Inside Jokes",
    memoryCount: 31,
    coverImage: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    previewImages: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80",
    ],
    theme: "Laughs",
  },
];
