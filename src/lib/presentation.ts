import type { Place } from "./domain";
export type Scene = "chapel" | "libraries" | "engineering" | "student-life";
export type Landmark = {
  slug: string;
  name: string;
  shortName?: string;
  scene: Scene;
  kind: string;
  description: string;
  focus: string;
  hotspot: [number, number];
  map: [number, number];
};
// Presentation metadata only. No event aliases or reviewed backend mappings are changed here.
export const landmarks: Landmark[] = [
  {
    slug: "duke-chapel",
    name: "Duke Chapel",
    scene: "chapel",
    kind: "Landmark · music & reflection",
    focus: "290",
    hotspot: [50, 59],
    map: [36, 48],
    description:
      "A Gothic landmark at the heart of West Campus. Look for the soaring bell tower, slate roof and pointed stone arches.",
  },
  {
    slug: "bryan-center",
    name: "Bryan Center",
    scene: "student-life",
    kind: "Student life",
    focus: "96",
    hotspot: [26, 38],
    map: [19, 66],
    description:
      "A gathering place for student life, theater and campus connections, recognizable by its broad stone wings and glass entrance.",
  },
  {
    slug: "penn-pavilion",
    name: "Penn Pavilion",
    scene: "student-life",
    kind: "Campus gathering",
    focus: "331",
    hotspot: [29, 81],
    map: [28, 85],
    description:
      "A low, light-filled pavilion with a long glass facade beside the student-life precinct.",
  },
  {
    slug: "fitzpatrick-center",
    name: "Fitzpatrick Center",
    scene: "engineering",
    kind: "Engineering & research",
    focus: "98",
    hotspot: [28, 34],
    map: [40, 20],
    description:
      "Two stone-clad engineering wings frame an open courtyard, connected above a walk-through route by a glass bridge.",
  },
  {
    slug: "wilkinson-building",
    name: "Wilkinson Engineering",
    shortName: "Wilkinson",
    scene: "engineering",
    kind: "Engineering & research",
    focus: "366",
    hotspot: [82, 45],
    map: [74, 19],
    description:
      "A modern engineering building with large blue-glass bays and strong vertical sunshade fins.",
  },
  {
    slug: "perkins-library",
    name: "Perkins Library",
    scene: "libraries",
    kind: "Library",
    focus: "392",
    hotspot: [42, 54],
    map: [65, 43],
    description:
      "The central part of a continuous library complex. Its stone facade and three arched doors connect visually with Rubenstein and the raised passage to Bostock.",
  },
  {
    slug: "bostock-library",
    name: "Bostock Library",
    scene: "libraries",
    kind: "Library",
    focus: "399",
    hotspot: [75, 31],
    map: [68, 30],
    description:
      "A modern library with tall glass bays, linked to Perkins by an elevated stone passage with an outdoor route below.",
  },
  {
    slug: "rubenstein-library",
    name: "Rubenstein Library",
    scene: "libraries",
    kind: "Rare books & manuscripts",
    focus: "1872",
    hotspot: [25, 79],
    map: [66, 54],
    description:
      "A distinctive square Gothic tower marks the historic rare-book library, physically connected to Perkins.",
  },
  {
    slug: "innovation-co-lab",
    name: "Innovation Co-Lab / TEC",
    shortName: "Co-Lab / TEC",
    scene: "engineering",
    kind: "Making & creativity",
    focus: "206",
    hotspot: [38, 59],
    map: [61, 20],
    description:
      "The Co-Lab studio is inside the Telecommunications Building at 2 Telcom Drive. The low building and ribbed entrance facade distinguish it from its taller neighbors.",
  },
  {
    slug: "brodhead-center",
    name: "Brodhead Center",
    scene: "student-life",
    kind: "Food & campus gathering",
    focus: "35",
    hotspot: [76, 49],
    map: [48, 73],
    description:
      "Historic Duke stone meets a modern glass hall and warm vertical fins around a lively outdoor student gathering area.",
  },
];
export const sceneNames: Record<Scene, string> = {
  chapel: "Chapel grounds",
  libraries: "Library courtyard",
  engineering: "Engineering quad",
  "student-life": "Student-life plaza",
};
export function isVisualOnly(id: string | null) {
  return Boolean(id?.startsWith("visual:"));
}
export function mergeLandmarks(apiPlaces: Place[]): Place[] {
  const known = new Map(apiPlaces.map((p) => [p.slug, p]));
  const display = landmarks.map(
    (l) =>
      known.get(l.slug) ?? {
        id: `visual:${l.slug}`,
        slug: l.slug,
        name: l.name,
        kind: l.kind,
        reviewStatus: "presentation-only",
        officialMapUrl: `https://maps.duke.edu/?focus=${l.focus}`,
        x: null,
        y: null,
      },
  );
  return [
    ...display,
    ...apiPlaces.filter((p) => !landmarks.some((l) => l.slug === p.slug)),
  ];
}
