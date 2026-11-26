// CALDERA RUN — tunables: flight model, missions, scoring, themes.
// One job: every number the rest of the game shares, in one place.

export const STEP = 1 / 60;
export const BEST_KEY = 'caldera-run-best';

/** World size in metres; the playable island chain sits inside it. */
export const WORLD_RADIUS = 1400;

/** Flight model. Speeds in m/s, altitudes in metres, angles in radians. */
export const FLIGHT = {
  maxSpeed: 96, // ~187 kt at full throttle
  cruiseSpeed: 62,
  stallSpeed: 24, // below this the wing stops flying and the nose drops
  accel: 14, // m/s^2 toward the throttle's target speed
  drag: 0.35,
  pitchRate: 0.9, // rad/s at full deflection, scaled by airspeed
  rollRate: 2.2,
  yawFromBank: 0.55, // how much bank turns the nose
  sinkRate: 9, // m/s of sink at a full stall
  climbFactor: 0.55, // how much of forward speed becomes climb at full pull
  groundEffect: 6, // metres above ground where the flare softens
};

export const PLANE = {
  startPos: [-260, 95, 420],
  startHeading: -0.5, // facing the home strip and the volcano beyond it
  fuelMax: 100,
  fuelBurn: 0.55, // units per second at full throttle
  fuelBurnIdle: 0.12,
  damageMax: 100,
  gearSpeed: 34, // landing is safe below this ground speed
};

/** The three sorties on the title screen. */
export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'RING RUN',
    tag: '8 rings round the caldera, then land the mail',
    rings: 8,
    timeLimit: 360,
    ringScore: 100,
    landScore: 250,
  },
  {
    id: 'mail',
    key: '2',
    name: 'ISLAND MAIL',
    tag: 'Land at all three strips — home, north, east',
    rings: 0,
    timeLimit: 600,
    landScore: 250,
  },
  {
    id: 'circuit',
    key: '3',
    name: 'CALDERA CIRCUIT',
    tag: '6 rings against the clock — 240 seconds',
    rings: 6,
    timeLimit: 240,
    ringScore: 150,
    landScore: 150,
  },
];

/** Visual themes. The screenshot tournament picks one as the default look. */
export const THEMES = {
  golden: {
    label: 'Golden hour',
    skyTop: 0x2e5f8a, skyBottom: 0xffb36b, fog: 0xf2a56b, fogNear: 500, fogFar: 2600,
    sunColor: 0xffd9a0, sunIntensity: 1.35, sunPos: [-800, 260, -500],
    hemiSky: 0x8fb8d8, hemiGround: 0x5a7a52, hemiIntensity: 0.75,
    sea: 0x1e7f8e, seaOpacity: 0.86, sand: 0xe8cf9a, grass: 0x6da054,
    rock: 0x8a6f5c, snow: 0xf2ede2, ring: 0xff7a1a,
  },
  noon: {
    label: 'Midday',
    skyTop: 0x2f7fd0, skyBottom: 0xbfe3f2, fog: 0xcfe6ef, fogNear: 700, fogFar: 3200,
    sunColor: 0xffffff, sunIntensity: 1.5, sunPos: [300, 900, 200],
    hemiSky: 0xbfe0f2, hemiGround: 0x6a8a5a, hemiIntensity: 0.7,
    sea: 0x1a7fb0, seaOpacity: 0.88, sand: 0xead9a0, grass: 0x5da24e,
    rock: 0x7d7468, snow: 0xffffff, ring: 0xff5a00,
  },
  sunset: {
    label: 'Sunset',
    skyTop: 0x3a2a5e, skyBottom: 0xff6a3d, fog: 0xe0704a, fogNear: 450, fogFar: 2400,
    sunColor: 0xff8a4d, sunIntensity: 1.25, sunPos: [-900, 140, -300],
    hemiSky: 0x7a5a9a, hemiGround: 0x4a3a34, hemiIntensity: 0.65,
    sea: 0x274a72, seaOpacity: 0.88, sand: 0xd9a878, grass: 0x5a7a44,
    rock: 0x6e5546, snow: 0xe8d8d0, ring: 0xffb300,
  },
  dawn: {
    label: 'Dawn',
    skyTop: 0x6a7fb8, skyBottom: 0xffc9a3, fog: 0xf2b9a0, fogNear: 600, fogFar: 2800,
    sunColor: 0xffd0a8, sunIntensity: 1.1, sunPos: [800, 180, -400],
    hemiSky: 0xa8b8d8, hemiGround: 0x5a6a52, hemiIntensity: 0.55,
    sea: 0x2a7a8e, seaOpacity: 0.86, sand: 0xe8d0a0, grass: 0x68a058,
    rock: 0x8a7a68, snow: 0xf5efe8, ring: 0xff8a2a,
  },
  dusk: {
    label: 'Dusk',
    skyTop: 0x1e2a52, skyBottom: 0xe88a6a, fog: 0x8a6a7a, fogNear: 400, fogFar: 2200,
    sunColor: 0xff9a6a, sunIntensity: 0.9, sunPos: [-700, 90, -600],
    hemiSky: 0x5a5a8a, hemiGround: 0x3a3a34, hemiIntensity: 0.6,
    sea: 0x1e3a5a, seaOpacity: 0.9, sand: 0xb89a78, grass: 0x4a6a44,
    rock: 0x5a4a42, snow: 0xd8d0d0, ring: 0xffc21a,
  },
};

export const THEME_ORDER = ['golden', 'noon', 'sunset', 'dawn', 'dusk'];
export const DEFAULT_THEME = 'golden';
