// Seeded random numbers: one job, the same world from the same seed, every run.
// Mulberry32 — small, fast, deterministic across browsers.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.next();
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}

/** Smooth 2D value noise with fBm, deterministic from a seed. */
export function createNoise(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand.next() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function fade(t) {
    return t * t * (3 - 2 * t);
  }
  function grad(hash, x, y) {
    switch (hash & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }
  function noise2(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = grad(perm[perm[xi] + yi], xf, yf);
    const ab = grad(perm[perm[xi] + yi + 1], xf, yf - 1);
    const ba = grad(perm[perm[xi + 1] + yi], xf - 1, yf);
    const bb = grad(perm[perm[xi + 1] + yi + 1], xf - 1, yf - 1);
    return (aa + (ba - aa) * u + (ab - aa) * v + (aa - ab - ba + bb) * u * v) * 0.7071;
  }
  return {
    fbm(x, y, octaves) {
      let value = 0;
      let amp = 0.5;
      let freq = 1;
      for (let o = 0; o < octaves; o += 1) {
        value += amp * noise2(x * freq, y * freq);
        amp *= 0.5;
        freq *= 2.03;
      }
      return value;
    },
  };
}
