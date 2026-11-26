// The aircraft: its flight model and its built-from-primitives model.
// One job: turn stick + throttle into a flying aeroplane, and draw it.
// Angles: heading (yaw, 0 = +z... we fly with -z forward in three.js terms
// is avoided; heading 0 points +x, growing toward +z), pitch up positive,
// roll right-wing-down positive. The nose points along forward().

import { FLIGHT, PLANE } from './config.js';

export function createPlane(world, start) {
  const state = {
    x: start.x,
    y: start.y,
    z: start.z,
    heading: start.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelMax,
    damage: 0,
    airborne: false,
    landed: true,
    crashed: false,
    groundSpeed: 0,
    verticalSpeed: 0,
    propAngle: 0,
    gearDown: true,
  };

  function forward() {
    const cp = Math.cos(state.pitch);
    return {
      x: Math.cos(state.heading) * cp,
      y: Math.sin(state.pitch),
      z: Math.sin(state.heading) * cp,
    };
  }

  function groundBelow() {
    return world.heightAt(state.x, state.z);
  }

  /**
   * One fixed step. `ctl` is { pitch: -1..1 (pull up positive), roll: -1..1
   * (right positive), throttle: -1..1 delta, brake } and `mission` is only
   * used to keep the plane inside the world. Returns an event string or ''.
   */
  function step(dt, ctl) {
    if (state.crashed) return 'crashed';
    const wasAirborne = state.airborne;

    state.throttle = Math.max(0, Math.min(1, state.throttle + ctl.throttle * dt * 0.9));
    const ground = groundBelow();
    const agl = state.y - ground;
    const onGround = agl <= 1.0;

    // Fuel: the engine drinks with the throttle; empty tanks mean a glider.
    const burn = (PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * state.throttle) * dt;
    state.fuel = Math.max(0, state.fuel - burn);
    const engineOut = state.fuel <= 0;

    // Airspeed chases the throttle's target, slower when the engine is out.
    // It slows faster than it speeds up: idle + flaps bite harder than the
    // propeller pulls, so a pilot who chops the throttle can make the strip.
    const target = engineOut ? 0 : state.throttle * FLIGHT.maxSpeed;
    const accel = FLIGHT.accel * (engineOut ? 0.25 : 1);
    const decel = 6;
    state.speed += Math.max(-decel * dt, Math.min(accel * dt, target - state.speed));
    if (state.speed < 0) state.speed = 0;

    // Control authority grows with airspeed. Pitch works on the ground too —
    // the pilot rotates for take-off — but the wings cannot bank until airborne.
    const authority = Math.min(1, state.speed / FLIGHT.cruiseSpeed);
    const air = onGround ? 0 : authority;
    state.pitch += ctl.pitch * FLIGHT.pitchRate * authority * dt;
    state.pitch = Math.max(-0.6, Math.min(0.7, state.pitch));
    state.roll += ctl.roll * FLIGHT.rollRate * air * dt;
    state.roll = Math.max(-1.1, Math.min(1.1, state.roll));
    // A banked wing turns the nose; the rudder (yaw key) adds a little more.
    // A right bank (positive roll) turns the nose right, which is heading up
    // in this frame: forward is (cos h, sin h) in x,z, so turning toward the
    // pilot's right hand increases h.
    state.heading += (state.roll * FLIGHT.yawFromBank * Math.min(1, state.speed / 40) + (ctl.yaw || 0) * 0.35 * air) * dt;
    // Wings level themselves gently when the stick is centred.
    if (Math.abs(ctl.roll) < 0.05) state.roll *= Math.max(0, 1 - 0.9 * dt);
    if (Math.abs(ctl.pitch) < 0.05) state.pitch *= Math.max(0, 1 - 0.5 * dt);

    const fwd = forward();
    // Lift: below stall speed the wing quits and the nose drops.
    const stall = Math.max(0, (FLIGHT.stallSpeed - state.speed) / FLIGHT.stallSpeed);
    let vy = fwd.y * state.speed - stall * FLIGHT.sinkRate;
    // Near the ground the wing cushions the descent a touch.
    if (agl < FLIGHT.groundEffect && vy < 0) vy *= 0.35;

    state.x += fwd.x * state.speed * dt;
    state.z += fwd.z * state.speed * dt;
    state.y += vy * dt;
    state.verticalSpeed = vy;
    state.groundSpeed = Math.hypot(fwd.x, fwd.z) * state.speed;
    state.propAngle += (engineOut ? 2 : 6 + state.throttle * 26) * dt;

    // Keep the sortie inside the charted sea.
    const dist = Math.hypot(state.x, state.z);
    if (dist > 1500) {
      const s = 1500 / dist;
      state.x *= s;
      state.z *= s;
      state.heading += Math.PI;
    }

    const groundNow = groundBelow();
    // Touch down when the wheels are within a metre of the ground: a
    // shallower threshold lets a flaring aeroplane float past the strip
    // forever instead of settling onto it.
    if (state.y <= groundNow + 1.0) {
      state.y = groundNow + 0.6;
      if (!wasAirborne) {
        // Taxiing or parked: the gear holds the plane. No impact, no damage,
        // and the throttle can still spool up for another take-off.
        state.landed = true;
        return '';
      }
      const strip = world.onAirfield(state.x, state.z);
      const soft = Math.abs(vy) < 5.5 && state.groundSpeed < PLANE.gearSpeed + 21;
      if (strip && soft && state.speed < PLANE.gearSpeed + 21) {
        // A landing: wheels on the strip, rollout, refuel and repair. A firm
        // one — fast or hard — is survivable but leaves a mark.
        state.landed = true;
        state.airborne = false;
        state.pitch *= 0.8;
        state.roll *= 0.8;
        if (state.speed > 40 || Math.abs(vy) > 4) state.damage = Math.min(PLANE.damageMax, state.damage + 8);
        if (state.damage >= PLANE.damageMax) state.crashed = true;
        state.speed = Math.max(0, state.speed - 26 * dt);
        if (state.speed < 2) state.speed = 0;
        return 'landed';
      }
      if (state.speed > 45 || Math.abs(vy) > 8) {
        state.crashed = true;
        return 'crashed';
      }
      // A gentle touchdown off the strip — a beach, a field, the grass
      // beside the runway: a hard stop and a dented airframe, not a crash.
      // The pilot can take off again from here. At 100 damage the
      // airframe is a wreck and the sortie is over.
      state.landed = true;
      state.airborne = false;
      state.speed = 0;
      state.damage = Math.min(PLANE.damageMax, state.damage + 12);
      if (state.damage >= PLANE.damageMax) state.crashed = true;
      return 'ditched';
    }

    state.landed = false;
    if (agl > 3) state.airborne = true;
    return '';
  }

  function refuel() {
    state.fuel = PLANE.fuelMax;
    state.damage = Math.max(0, state.damage - 50);
  }

  function reset(startPos) {
    state.x = startPos.x;
    state.y = startPos.y;
    state.z = startPos.z;
    state.heading = startPos.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = PLANE.fuelMax;
    state.damage = 0;
    state.airborne = false;
    state.landed = true;
    state.crashed = false;
  }

  return { state, step, forward, refuel, reset, groundBelow };
}
