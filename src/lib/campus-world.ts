import { landmarks } from "./presentation";
import type { Point, Size } from "./map-camera";

export type BuildingPlacement = {
  slug: string; campusId: string; position: Point; sprite: string;
  display: Size; anchor: Point; labelAnchor: Point; z: number;
};
const sprites = ["01_chapel", "02_bryan", "03_penn", "04_fitzpatrick", "05_wilkinson", "06_perkins", "07_bostock", "08_rubenstein", "09_tec", "10_brodhead"];
const dimensions = [[1402,1122],[1639,959],[1774,887],[1774,887],[1536,1024],[1536,1024],[1401,1123],[1402,1122],[1774,887],[1536,1024]];
const widths = [390,380,350,450,340,340,310,330,290,380];
// Retain the reviewed illustrative relative coordinates. These are not navigation geometry.
export const westCampus = {
  id: "west-campus",
  name: "West Campus",
  world: { w: 2000, h: 1800 },
  ground: "#899b58",
  placements: landmarks.map((landmark, i): BuildingPlacement => ({
    slug: landmark.slug, campusId: "west-campus",
    position: { x: landmark.map[0] * 20, y: landmark.map[1] * 18 },
    sprite: `/buildings/${sprites[i]}.png`,
    display: { w: widths[i], h: widths[i] * dimensions[i][1] / dimensions[i][0] },
    anchor: { x: 0.5, y: 0.8 },
    labelAnchor: { x: landmark.slug === "wilkinson-building" ? 0.8 : 0.5, y: 1 },
    z: Math.round(landmark.map[1] * 18),
  })),
};
// Shared drawing coordinates also feed the minimap.
export const campusPaths = [
  "M 170 1520 Q 220 1290 380 1188 L 560 1530 Q 800 1580 960 1314 L 1300 972 L 1360 540 L 1480 342",
  "M 380 1188 Q 500 1020 720 864 Q 1000 790 1300 774",
  "M 720 864 Q 600 610 800 360 L 1220 360 L 1480 342",
  "M 960 1314 Q 1110 1130 1300 972",
];
