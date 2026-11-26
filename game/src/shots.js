// Screenshot scenes: one job, stage a real moment of the game for the camera.
// ?shot=cover|rings|landing|cockpit (with &seed=N &theme=name) plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot that aims at the next ring or the runway, so the frame is
// what a short game really looks like and the same seed always gives it.

import { STEP } from './config.js';

const SAMPLE = STEP;

/** Steer toward a point: returns { pitch, roll, throttle, yaw } control. */
function steerTo(plane, tx, ty, tz, throttle) {
  const s = plane.state;
  const dx = tx - s.x;
  const dy = ty - s.y;
  const dz = tz - s.z;
  const dist = Math.hypot(dx, dy, dz);
  const wantHeading = Math.atan2(dz, dx);
  let dh = wantHeading - s.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const wantPitch = Math.max(-0.35, Math.min(0.4, Math.atan2(dy, Math.hypot(dx, dz))));
  const roll = Math.max(-1, Math.min(1, dh * 1.6 - s.roll * 0.8));
  const pitch = Math.max(-1, Math.min(1, (wantPitch - s.pitch) * 2.2));
  return { pitch, roll, yaw: 0, throttle: throttle - s.throttle > 0 ? 1 : -1 };
}

/**
 * Fly the plane through `steps` fixed steps toward the mission's target,
 * then return the screen to draw and the mission state to show.
 */
export function stageShot(name, world, plane, mission, renderer) {
  const home = world.strips[0];
  const startX = home.x - Math.cos(home.heading) * (home.length / 2 - 20);
  const startZ = home.z - Math.sin(home.heading) * (home.length / 2 - 20);
  plane.reset({ x: startX, y: home.alt + 0.6, z: startZ, heading: home.heading });
  mission.start();
  renderer.snapCamera(plane);

  if (name === 'cockpit') {
    renderer.setCamera('cockpit');
    flyTo(plane, mission, world, 60);
    // Level off toward the first ring so the shot looks out over the island,
    // not up at the sky.
    const ring1 = world.rings[0];
    flyToPoint(plane, world, ring1.x, ring1.y, ring1.z, 30, 0.7, 100);
    return { screen: 'play', best: 0 };
  }

  if (name === 'landing') {
    // Take off, climb, turn downwind, then fly the final approach.
    flyTo(plane, mission, world, 60);
    const approachX = home.x - Math.cos(home.heading) * 420;
    const approachZ = home.z - Math.sin(home.heading) * 420;
    flyToPoint(plane, world, approachX, home.alt + 130, approachZ, 34, 0.55);
    flyToPoint(plane, world, home.x, home.alt + 2, home.z, 40, 0.35, 40, true);
    renderer.setCamera('chase');
    return { screen: 'play', best: 0 };
  }

  if (name === 'rings') {
    flyTo(plane, mission, world, 60);
    // Chase the first three rings so the shot catches a ring dead ahead.
    for (let r = 0; r < 3; r += 1) {
      const ring = world.rings[r];
      const last = r === 2;
      flyToPoint(plane, world, ring.x, ring.y, ring.z, last ? 90 : 40, 0.8, last ? 60 : 12, last);
      mission.step(0, plane.state, '');
    }
    renderer.setCamera('chase');
    return { screen: 'play', best: 0 };
  }

  // Cover: a photo pass — climb out over the eastern sea, then a long, flat
  // run back toward the volcano: freeze level, 110 m short of ring 1, with
  // the ring ahead and the volcano rising behind it.
  flyTo(plane, mission, world, 60);
  flyToPoint(plane, world, 650, 260, 350, 30, 0.8);
  const ring1 = world.rings[0];
  const approachX = Math.cos(Math.atan2(-ring1.z, -ring1.x));
  const approachZ = Math.sin(Math.atan2(-ring1.z, -ring1.x));
  // Staging point 800 m out from the ring, on the ring-to-volcano line.
  const stageX = ring1.x - approachX * 800;
  const stageZ = ring1.z - approachZ * 800;
  flyToPoint(plane, world, stageX, 150, stageZ, 40, 0.8);
  flyToPoint(plane, world, ring1.x, ring1.y, ring1.z, 60, 0.7, 110, true);
  renderer.setCamera('chase');
  return { screen: 'play', best: 0 };
}

/** Take off and climb to cruise, aiming at the mission's first target. */
function flyTo(plane, mission, world, seconds) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const s = plane.state;
    const t = mission.target();
    const ctl = { pitch: 0.55, roll: 0, yaw: 0, throttle: 1 };
    if (t && s.speed > 30) {
      const steered = steerTo(plane, t.x, t.y, t.z, 0.8);
      ctl.pitch = Math.max(0.15, steered.pitch);
      ctl.roll = steered.roll;
    }
    plane.step(SAMPLE, ctl);
    if (s.crashed) break;
    if (s.y > 150 && t) break;
  }
}

/** Fly toward one point until close, or the step budget runs out. With `align`,
 * only stop when the wings are nearly level and the nose is on the target:
 * a photo pass freezes flying straight, not mid-turn. */
function flyToPoint(plane, world, tx, ty, tz, seconds, throttle = 0.8, close = 26, align = false) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const s = plane.state;
    const d = Math.hypot(tx - s.x, ty - s.y, tz - s.z);
    if (d < close) {
      if (!align) break;
      let dh = Math.atan2(tz - s.z, tx - s.x) - s.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (Math.abs(s.roll) < 0.3 && Math.abs(dh) < 0.35) break;
    }
    const ctl = steerTo(plane, tx, ty, tz, throttle);
    plane.step(SAMPLE, ctl);
    if (s.crashed || s.landed) break;
  }
}
