// Harbor City tuning: world size, road layout, palette, vehicle and
// weapon stats, and the names that make the city its own.

export const CITY_NAME = "Harbor City";
export const GAME_TITLE = "Harbor City: Sun, Salt & Sirens";

export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const ROAD_W = 96;
export const SIDEWALK_W = 26;

// Road centre lines. The grid is regular so traffic can follow it.
export const ROAD_XS = [300, 900, 1500, 2100, 2700, 3300, 3900, 4500];
export const ROAD_YS = [300, 900, 1500, 2100, 2700];

// Waterfront: sand then open water along the south edge.
export const SAND_Y = 3100;
export const WATER_Y = 3300;

// The park fills one block in the west of the city.
export const PARK = { x: 996, y: 996, w: 408, h: 408 };

// Named places the missions and the HUD refer to.
export const PLACES = {
  garage: { x: 2280, y: 480, label: "Rook's Garage" },
  hideout: { x: 660, y: 2280, label: "Hideout" },
  hospital: { x: 3480, y: 1080, label: "Harbor General" },
  station: { x: 4080, y: 2280, label: "Harbor Precinct" },
  pier: { x: 2400, y: 3220, label: "Salt Pier" },
  market: { x: 1080, y: 1680, label: "Fish Market" },
  depot: { x: 3720, y: 480, label: "Bus Depot" },
  lookout: { x: 4200, y: 1680, label: "Lighthouse Point" },
};

export const DISTRICTS = [
  { x: 0, y: 0, w: 2400, h: 1800, name: "Old Town" },
  { x: 2400, y: 0, w: 2400, h: 1800, name: "Downtown" },
  { x: 0, y: 1800, w: 2400, h: 1300, name: "Palm Court" },
  { x: 2400, y: 1800, w: 2400, h: 1300, name: "Marina District" },
  { x: 0, y: 3100, w: 4800, h: 500, name: "The Waterfront" },
];

export const PALETTE = {
  grass: "#7fae5a",
  grassDark: "#74a250",
  lot: "#c9b896",
  sidewalk: "#d8d2c4",
  curb: "#b9b2a2",
  road: "#4a4a52",
  roadEdge: "#3a3a42",
  dash: "#e8d878",
  sand: "#e6d199",
  water: "#3d8fb8",
  waterDeep: "#2f7ba3",
  parkGrass: "#6da34e",
  roofA: "#d97b5f",
  roofB: "#e8a34c",
  roofC: "#7d9bb5",
  roofD: "#b5b0a4",
  roofE: "#c96f7d",
};

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 285,
  radius: 13,
  maxHp: 100,
  punchDamage: 22,
  punchRange: 34,
  punchArc: 1.1,
  punchCooldown: 0.42,
  regenDelay: 5,
  regenRate: 6,
};

// Vehicle types: size in pixels, top speed px/s, acceleration, steering.
export const CAR_TYPES = {
  sedan: {
    name: "Alba Sedan", w: 46, h: 22, accel: 260, maxSpeed: 430, reverse: 150,
    steer: 2.6, grip: 3.2, colors: ["#c94f43", "#3f6d9e", "#d8d3c8", "#5b7a52", "#8a8f98"],
  },
  taxi: {
    name: "Harbor Cab", w: 46, h: 22, accel: 250, maxSpeed: 420, reverse: 150,
    steer: 2.6, grip: 3.2, colors: ["#e8b93c"],
  },
  van: {
    name: "Parcel Van", w: 54, h: 24, accel: 190, maxSpeed: 350, reverse: 120,
    steer: 2.1, grip: 2.8, colors: ["#e8e4da", "#6b7f8c", "#b0563a"],
  },
  sport: {
    name: "Vela GT", w: 48, h: 21, accel: 360, maxSpeed: 560, reverse: 170,
    steer: 3.1, grip: 3.8, colors: ["#d92b2b", "#2b6fd9", "#f2e63d", "#222831"],
  },
  truck: {
    name: "Dock Hauler", w: 62, h: 26, accel: 150, maxSpeed: 300, reverse: 110,
    steer: 1.8, grip: 2.5, colors: ["#7a6a4f", "#4f6a7a", "#8c8c84"],
  },
  police: {
    name: "Patrol Interceptor", w: 48, h: 22, accel: 330, maxSpeed: 520, reverse: 160,
    steer: 2.9, grip: 3.6, colors: ["#20242c"],
  },
};

export const WEAPONS = {
  fists: { name: "Fists", damage: 22, cooldown: 0.42 },
  pistol: {
    name: "P9 Pistol", damage: 34, cooldown: 0.28, mag: 12,
    reload: 1.25, spread: 0.035, range: 520, bulletSpeed: 900,
  },
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 9,
  decayStep: 6,
  // Police cars per star level.
  carsPerStar: [0, 1, 2, 3, 4, 5],
  officersPerStar: [0, 0, 1, 2, 3, 4],
  bustRadius: 46,
  bustTime: 2.2,
};

export const SAVE_KEY = "harbor-city-save-v1";
export const START_CASH = 100;
export const START_POS = { x: 1250, y: 1250 };
