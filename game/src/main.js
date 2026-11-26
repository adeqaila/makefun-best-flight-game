// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// four screens: title, play, paused and over.
//
// ?seed=N fixes the world. ?theme=golden|noon|sunset|dawn|dusk picks the light.
// ?shot=cover|rings|landing|cockpit (with &seed=N &theme=…) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, DEFAULT_THEME, MISSIONS, STEP, THEMES } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlane } from './plane.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_GEAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createMission, missionById } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const themeName = THEMES[params.get('theme')] ? params.get('theme') : DEFAULT_THEME;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
const status = document.getElementById('status');
const world = createWorld(seed);
const plane = createPlane(world, world.start);
const renderer = createRenderer(canvas, world, themeName);
const hud = createHud(hudRoot);
const audio = createAudio();

let mission = createMission(world, MISSIONS[0]);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function homeStart() {
  const home = world.strips[0];
  return {
    x: home.x - Math.cos(home.heading) * (home.length / 2 - 20),
    y: home.alt + 0.6,
    z: home.z - Math.sin(home.heading) * (home.length / 2 - 20),
    heading: home.heading,
  };
}

function titleHtml(best) {
  const cards = MISSIONS.map((m) => `
    <div class="sortie" data-id="${m.id}">
      <div class="sortie-key">${m.key}</div>
      <div class="sortie-name">${m.name}</div>
      <div class="sortie-tag">${m.tag}</div>
    </div>`).join('');
  return `
    <div class="title-inner">
      <div class="title-kicker">A VOLCANO-ISLAND AIRLIFT</div>
      <h1>CALDERA RUN</h1>
      <div class="title-sub">Fly the mail across the Lantern Bay chain — rings, strips, fuel and nerve.</div>
      <div class="sorties">${cards}</div>
      <div class="title-foot">Click a sortie or press 1 / 2 / 3 &nbsp;·&nbsp; Best ${best} pts &nbsp;·&nbsp; W/S throttle · Arrows fly · Mouse drag steers · C camera</div>
    </div>`;
}

function runShot(name) {
  const scene = stageShot(name, world, plane, mission, renderer);
  // The plane has flown a long way while the scene was staged: put the
  // camera back behind it before the first paint, or it stays at the strip.
  renderer.snapCamera(plane);
  renderer.resize(window.innerWidth, window.innerHeight);
  let painted = 0;
  function paint() {
    renderer.draw(plane, mission, scene.screen, 12.4, STEP);
    hud.update(plane, mission, scene.screen);
    hud.showTitle('');
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let overReason = '';
  let selectedMission = MISSIONS[0];

  function announce(message) {
    status.textContent = message;
  }

  function startGame(def) {
    mission = createMission(world, def);
    mission.start();
    plane.reset(homeStart());
    renderer.setCamera('chase');
    renderer.snapCamera(plane);
    accumulator = 0;
    screen = 'play';
    hud.showTitle('');
    audio.start();
    audio.click();
    announce(`Playing ${def.name}.`);
  }

  function endGame(reason) {
    screen = 'over';
    overReason = reason;
    if (mission.score > best) {
      best = mission.score;
      saveBest(best);
    }
    audio.crash();
    announce(`Sortie over. ${reason} Score ${mission.score}. Best ${best}.`);
  }

  function showTitleScreen() {
    screen = 'title';
    hud.showTitle(titleHtml(best));
    announce('Caldera Run. Pick a sortie: 1 Ring Run, 2 Island Mail, 3 Caldera Circuit.');
  }

  // Clicking a sortie card on the title screen starts it.
  hudRoot.addEventListener('click', (e) => {
    const card = e.target.closest('.sortie');
    if (card && screen === 'title') {
      startGame(missionById(card.dataset.id));
    }
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === 'title') {
      const picked = input.missionKey();
      if (picked) startGame(missionById(picked));
      else if (actions & ACTION_CONFIRM) startGame(selectedMission);
      return;
    }
    if (screen === 'over') {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) showTitleScreen();
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = screen === 'play' ? 'paused' : 'play';
      announce(screen === 'paused' ? 'Paused.' : 'Playing.');
    }
    if (actions & ACTION_CAMERA && screen === 'play') {
      renderer.setCamera(renderer.cameraMode === 'chase' ? 'cockpit' : 'chase');
      renderer.snapCamera(plane);
    }
    if (actions & ACTION_RESTART && screen === 'play') {
      startGame(mission.def);
    }
  }

  function step() {
    if (screen === 'title') {
      // The plane idles on the strip while the title shows; the world lives.
      return;
    }
    const ctl = input.control(STEP);
    const event = plane.step(STEP, ctl);
    const result = mission.step(STEP, plane.state, event);
    if (result.ring) audio.ring();
    if (result.landed) {
      audio.land();
      plane.refuel();
    }
    if (event === 'crashed') endGame('Crashed.');
    else if (result.over && mission.finished) {
      screen = 'over';
      overReason = plane.state.crashed ? 'Crashed.' : 'Sortie complete.';
      if (mission.score > best) {
        best = mission.score;
        saveBest(best);
      }
      announce(`Sortie complete. Score ${mission.score}. Best ${best}.`);
    }
    audio.update(plane.state.throttle, plane.state.speed, plane.state.airborne);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'title' || screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(plane, mission, screen, time, dt);
    hud.update(plane, mission, screen);
    if (screen === 'over') {
      hud.showTitle(`
        <div class="title-inner">
          <div class="title-kicker">SORTIE OVER</div>
          <h1>${overReason}</h1>
          <div class="title-sub">Score ${mission.score} pts &nbsp;·&nbsp; Best ${best} pts</div>
          <div class="title-foot">Press Space or R for the title screen</div>
        </div>`);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  window.addEventListener('resize', () => renderer.resize(window.innerWidth, window.innerHeight));
  renderer.resize(window.innerWidth, window.innerHeight);
  plane.reset(homeStart());
  renderer.snapCamera(plane);
  showTitleScreen();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
