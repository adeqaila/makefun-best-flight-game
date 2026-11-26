// Missions: one job, turn flying into goals, scores and decisions.
// A sortie is rings to fly through in order, then a landing — or, for the
// mail run, a landing at every strip. Fuel and damage turn each sortie
// into decisions: push on, or land, refuel and repair.

import { MISSIONS } from './config.js';

export function createMission(world, def) {
  let ringsDone = 0;
  let stripsDone = new Set();
  let score = 0;
  let elapsed = 0;
  let finished = false;
  let message = '';
  let messageUntil = 0;
  let nextRing = def.rings > 0 ? world.rings[0] : null;
  let targetStrip = def.id === 'mail' ? world.strips[1] : world.strips[0];

  function say(text, seconds) {
    message = text;
    messageUntil = elapsed + seconds;
  }

  function start() {
    ringsDone = 0;
    stripsDone = new Set();
    score = 0;
    elapsed = 0;
    finished = false;
    nextRing = def.rings > 0 ? world.rings[0] : null;
    targetStrip = def.id === 'mail' ? world.strips[1] : world.strips[0];
    say(def.id === 'mail' ? 'MAIL RUN — land at NORTH ISLE first' : `RING 1 OF ${def.rings} — follow the orange rings`, 6);
  }

  /** Where the pilot should aim next: a ring, a strip, or null when done. */
  function target() {
    if (finished) return null;
    if (nextRing) return { kind: 'ring', x: nextRing.x, y: nextRing.y, z: nextRing.z, radius: nextRing.radius };
    if (targetStrip) return { kind: 'strip', x: targetStrip.x, y: targetStrip.alt + 2, z: targetStrip.z, name: targetStrip.name };
    return null;
  }

  /**
   * Advance the mission one step. `plane` is the plane state, `event` the
   * plane step's result ('landed' | 'ditched' | 'crashed' | ''). Returns
   * { ring: bool, landed: bool, over: bool } for sounds and screens.
   */
  function step(dt, plane, event) {
    if (finished) return { ring: false, landed: false, over: false };
    elapsed += dt;
    const out = { ring: false, landed: false, over: false };

    // Ring pass: close to the ring's centre while crossing its plane.
    if (nextRing) {
      const dx = plane.x - nextRing.x;
      const dy = plane.y - nextRing.y;
      const dz = plane.z - nextRing.z;
      if (dx * dx + dy * dy + dz * dz < nextRing.radius * nextRing.radius) {
        ringsDone += 1;
        score += def.ringScore;
        out.ring = true;
        if (ringsDone < def.rings) {
          nextRing = world.rings[ringsDone];
          say(`RING ${ringsDone + 1} OF ${def.rings} — +${def.ringScore}`, 3);
        } else {
          nextRing = null;
          targetStrip = world.strips[0];
          say(`ALL RINGS — land at ${targetStrip.name} for +${def.landScore}`, 6);
        }
      }
    }

    if (event === 'landed') {
      const strip = world.onAirfield(plane.x, plane.z);
      if (strip) {
        out.landed = true;
        if (def.id === 'mail') {
          // Mail counts only when it reaches the strip it was sent to, in
          // order north, east, then home — starting at home is not a delivery.
          if (strip.id === targetStrip.id) {
            stripsDone.add(strip.id);
            score += def.landScore;
            say(`${strip.name} DELIVERED — +${def.landScore}`, 4);
            const order = ['north', 'east', 'home'];
            const nextId = order.find((id) => !stripsDone.has(id));
            if (!nextId) {
              finished = true;
              out.over = true;
              const bonus = Math.max(0, Math.round((def.timeLimit - elapsed) / 10)) * 10;
              score += bonus;
              say(`MAIL COMPLETE — time bonus +${bonus}`, 8);
            } else {
              targetStrip = world.strips.find((s) => s.id === nextId);
              say(`NEXT — land at ${targetStrip.name}`, 5);
            }
          } else {
            say(`${strip.name} — refuelled. Next: ${targetStrip.name}`, 4);
          }
        } else if (ringsDone >= def.rings) {
          finished = true;
          out.over = true;
          score += def.landScore;
          const bonus = Math.max(0, Math.round((def.timeLimit - elapsed) / 10)) * 10;
          score += bonus;
          say(`SORTIE COMPLETE — landing +${def.landScore}, time bonus +${bonus}`, 8);
        } else {
          say(`${strip.name} — refuelled. ${def.rings - ringsDone} rings to go`, 4);
        }
      }
    }

    if (event === 'crashed') {
      finished = true;
      out.over = true;
    }
    if (elapsed > def.timeLimit && !finished) {
      finished = true;
      out.over = true;
      say('OUT OF TIME', 6);
    }
    return out;
  }

  function progress() {
    if (def.id === 'mail') return `${stripsDone.size}/3 STRIPS`;
    if (def.rings > 0) return `RING ${Math.min(ringsDone + 1, def.rings)}/${def.rings}`;
    return '';
  }

  function timeLeft() {
    return Math.max(0, def.timeLimit - elapsed);
  }

  return {
    def,
    start,
    step,
    target,
    progress,
    timeLeft,
    say,
    get score() { return score; },
    get elapsed() { return elapsed; },
    get finished() { return finished; },
    get ringsDone() { return ringsDone; },
    get message() { return elapsed < messageUntil ? message : ''; },
    get nextRingIndex() { return ringsDone; },
  };
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
