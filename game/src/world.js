// The world: a seeded volcanic archipelago, its runways, rings, trees and clouds.
// One job: answer "how high is the ground here" and place everything on it.
// Everything is derived from the seed, so the same seed is the same islands.

import { createNoise, createRandom } from './random.js';
import { WORLD_RADIUS } from './config.js';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** One island: a radial mask over fBm hills, falling away to the sea floor. */
function islandHeight(noise, x, z, cx, cz, radius, peak, seed) {
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.sqrt(dx * dx + dz * dz) / radius;
  if (d >= 1) return -24;
  const mask = smooth(1 - d);
  const hills = 0.55 + 0.45 * noise.fbm(x * 0.004 + seed, z * 0.004 - seed, 4);
  return -24 + (peak * hills + 24) * Math.pow(mask, 1.4);
}

export function createWorld(seed) {
  const noise = createNoise(seed * 7919 + 13);
  const rand = createRandom(seed * 31 + 7);

  // The islands: a big volcanic one, two inhabited ones with strips, one wild one.
  const islands = [
    { cx: 0, cz: 0, radius: 980, peak: 150 },
    { cx: 150, cz: -820, radius: 280, peak: 55 },
    { cx: 860, cz: 380, radius: 320, peak: 70 },
    { cx: -820, cz: 820, radius: 240, peak: 90 },
    { cx: -620, cz: -700, radius: 150, peak: 34 },
    { cx: 620, cz: -420, radius: 120, peak: 26 },
  ];

  // The volcano cone on the main island.
  function volcano(x, z) {
    const d = Math.hypot(x, z);
    if (d > 340) return 0;
    return (1 - d / 340) * 240 * (0.85 + 0.15 * noise.fbm(x * 0.02, z * 0.02, 2));
  }

  // Strips are placed first; the ground under each is flattened to its altitude.
  const strips = [
    { id: 'home', name: 'LANTERN BAY', x: -430, z: 210, heading: 1.15, length: 260, width: 26, alt: 0 },
    { id: 'north', name: 'NORTH ISLE', x: 150, z: -820, heading: -0.4, length: 200, width: 22, alt: 0 },
    { id: 'east', name: 'EAST REEF', x: 860, z: 380, heading: 2.2, length: 210, width: 22, alt: 0 },
  ];

  function rawHeight(x, z) {
    let h = -24;
    for (const isl of islands) {
      h = Math.max(h, islandHeight(noise, x, z, isl.cx, isl.cz, isl.radius, isl.peak, isl.cx * 0.001));
    }
    return Math.max(h, volcano(x, z) + (h > 0 ? h * 0.15 : 0));
  }

  // Fix each strip's altitude from the raw ground at its centre, then flatten around it.
  for (const s of strips) s.alt = Math.max(6, rawHeight(s.x, s.z));

  function stripBlend(x, z) {
    for (const s of strips) {
      const cos = Math.cos(-s.heading);
      const sin = Math.sin(-s.heading);
      const lx = (x - s.x) * cos - (z - s.z) * sin;
      const lz = (x - s.x) * sin + (z - s.z) * cos;
      const ax = Math.abs(lx);
      const az = Math.abs(lz);
      const halfL = s.length / 2;
      const halfW = s.width / 2;
      // A proper airfield plateau: flat well past the strip's ends and sides,
      // so a landing a little off the centreline still finds level ground.
      const marginL = 150;
      const marginW = 110;
      if (ax < halfL + marginL && az < halfW + marginW) {
        const edge = smooth(1 - Math.max((ax - halfL) / marginL, (az - halfW) / marginW));
        return { alt: s.alt, blend: edge };
      }
    }
    return null;
  }

  function heightAt(x, z) {
    const raw = rawHeight(x, z);
    const flat = stripBlend(x, z);
    if (!flat) return raw;
    return raw + (flat.alt - raw) * flat.blend;
  }

  function onStrip(x, z) {
    for (const s of strips) {
      const cos = Math.cos(-s.heading);
      const sin = Math.sin(-s.heading);
      const lx = (x - s.x) * cos - (z - s.z) * sin;
      const lz = (x - s.x) * sin + (z - s.z) * cos;
      if (Math.abs(lx) < s.length / 2 && Math.abs(lz) < s.width / 2) return s;
    }
    return null;
  }

  /** The landing zone: the strip plus the flat grass beside it. A bush pilot
   * lands on the airfield, not only on the painted centreline. */
  function onAirfield(x, z) {
    for (const s of strips) {
      const cos = Math.cos(-s.heading);
      const sin = Math.sin(-s.heading);
      const lx = (x - s.x) * cos - (z - s.z) * sin;
      const lz = (x - s.x) * sin + (z - s.z) * cos;
      if (Math.abs(lx) < s.length / 2 + 20 && Math.abs(lz) < s.width / 2 + 25) return s;
    }
    return null;
  }

  // Rings for the ring missions: a tour round the caldera, over ridges and bays.
  const ringAngles = [0.4, 1.1, 1.9, 2.6, 3.4, 4.1, 4.8, 5.6];
  const rings = ringAngles.map((a, i) => {
    const r = 380 + (i % 3) * 130;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const ground = heightAt(x, z);
    return {
      index: i,
      x,
      z,
      y: Math.max(ground + 55, 120 + (i % 4) * 22),
      radius: 15,
    };
  });

  // Palm clusters where the ground is low, green and not on a strip.
  const trees = [];
  let guard = 0;
  while (trees.length < 340 && guard < 6000) {
    guard += 1;
    const a = rand.next() * Math.PI * 2;
    const r = Math.sqrt(rand.next()) * 1050;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < 4 || h > 85) continue;
    if (onStrip(x, z)) continue;
    if (Math.abs(heightAt(x + 8, z) - h) > 3) continue;
    trees.push({ x, z, y: h, s: rand.range(0.8, 1.5), lean: rand.range(-0.08, 0.08) });
  }

  // A little harbour town beside the home strip.
  const houses = [];
  for (let i = 0; i < 14; i += 1) {
    const x = -430 + rand.range(-160, 160);
    const z = 210 + rand.range(60, 190);
    const h = heightAt(x, z);
    if (h < 3 || onStrip(x, z)) continue;
    houses.push({ x, z, y: h, w: rand.range(8, 14), d: rand.range(8, 12), hgt: rand.range(5, 9), rot: rand.range(0, Math.PI), hue: rand.pick([0xe85d3d, 0xf2a541, 0x4a90b8, 0xe8e0d0, 0x7ab86a]) });
  }

  // Cloud puffs drifting high over the chain.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    const a = rand.next() * Math.PI * 2;
    const r = Math.sqrt(rand.next()) * 1250;
    clouds.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y: rand.range(250, 430),
      s: rand.range(60, 150),
      speed: rand.range(1.5, 4),
    });
  }

  return {
    seed,
    heightAt,
    onStrip,
    onAirfield,
    strips,
    rings,
    trees,
    houses,
    clouds,
    radius: WORLD_RADIUS,
    start: { x: -430, y: 0, z: 210, heading: 1.15 },
  };
}
