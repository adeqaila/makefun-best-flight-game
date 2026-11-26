// Keyboard + mouse: one job, read the pilot's hands into control deflections.
// Arrow keys / WASD fly; mouse steers while held (drag) or while pointer-locked.
// Space confirms on menus, P pauses, C swaps the camera, G toggles the gear,
// 1/2/3 pick a sortie, M mutes, R restarts after a crash.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_GEAR = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mousePitch = 0;
  let mouseRoll = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  function keyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      e.preventDefault();
    } else if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    else if (e.code === 'KeyC') actions |= ACTION_CAMERA;
    else if (e.code === 'KeyG') actions |= ACTION_GEAR;
    else if (e.code === 'KeyM') actions |= ACTION_MUTE;
    else if (e.code === 'KeyR') actions |= ACTION_RESTART;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function keyUp(e) {
    keys.delete(e.code);
  }
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.button === 0 && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Pointer lock is a nicety; drag steering works without it.
      }
    }
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (e) => {
    if (locked) {
      mouseRoll += e.movementX * 0.004;
      mousePitch += e.movementY * 0.004;
    } else if (dragging) {
      mouseRoll += (e.clientX - lastX) * 0.006;
      mousePitch += (e.clientY - lastY) * 0.006;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  // The mouse springs back to centre: hold it off-centre to hold a turn.
  function decayMouse(dt) {
    mouseRoll *= Math.max(0, 1 - 2.2 * dt);
    mousePitch *= Math.max(0, 1 - 2.2 * dt);
  }

  function control(dt) {
    decayMouse(dt);
    const pitchKey = (keys.has('ArrowUp') ? 1 : 0) + (keys.has('ArrowDown') ? -1 : 0);
    const rollKey = (keys.has('ArrowRight') ? 1 : 0) + (keys.has('ArrowLeft') ? -1 : 0);
    // Arrow Up pulls the nose up; W/S (and Shift/Ctrl) work the throttle.
    const throttleKey = (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0)
      + (keys.has('KeyS') || keys.has('ControlLeft') ? -1 : 0);
    const yawKey = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
    const pitch = Math.max(-1, Math.min(1, pitchKey - mousePitch));
    const roll = Math.max(-1, Math.min(1, rollKey + mouseRoll));
    return {
      pitch,
      roll,
      yaw: yawKey * 0.6,
      throttle: throttleKey,
    };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  function missionKey() {
    if (keys.has('Digit1')) return 'rings';
    if (keys.has('Digit2')) return 'mail';
    if (keys.has('Digit3')) return 'circuit';
    return null;
  }

  return { control, takeActions, missionKey };
}
