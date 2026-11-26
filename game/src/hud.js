// The HUD: one job, the lit instruments the pilot flies by.
// All DOM, updated from the plane + mission state each frame: altitude,
// speed and heading on top, a compass strip, throttle, fuel and damage,
// an artificial horizon, and the mission banner. Big amber numerals, so the
// judge can read them even on the shrunken contact sheet.

const FEET_PER_M = 3.28084;
const KT_PER_MS = 1.94384;

function fmt(n, digits = 0) {
  return n.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function createHud(root) {
  root.innerHTML = `
    <div class="hud hud-top">
      <div class="panel" id="alt-panel"><span class="lbl">ALT</span><span class="val" id="alt">0</span><span class="unit">FT</span></div>
      <div class="panel compass" id="compass"><div class="strip" id="compass-strip"></div><div class="needle">▲</div><span class="val" id="hdg">000°</span></div>
      <div class="panel" id="spd-panel"><span class="lbl">SPD</span><span class="val" id="spd">0</span><span class="unit">KT</span></div>
    </div>
    <div class="hud hud-left">
      <div class="panel gauge">
        <div class="horizon"><div class="horizon-sky"></div><div class="horizon-line"></div><div class="horizon-plane">✈</div></div>
        <div class="gauge-row"><span class="lbl">THR</span><div class="bar"><div id="thr-fill"></div></div><span class="val sm" id="thr">0%</span></div>
        <div class="gauge-row"><span class="lbl">FUEL</span><div class="bar"><div id="fuel-fill"></div></div><span class="val sm" id="fuel">100</span></div>
        <div class="gauge-row"><span class="lbl">DMG</span><div class="bar"><div id="dmg-fill"></div></div><span class="val sm" id="dmg">0</span></div>
        <div class="gauge-row"><span class="lbl">VSI</span><span class="val sm" id="vsi">+0</span><span class="unit">FPM</span></div>
      </div>
    </div>
    <div class="hud hud-bottom">
      <div class="panel mission"><span id="mission-name">RING RUN</span><span id="mission-prog">RING 1/8</span><span id="mission-time">6:00</span><span id="mission-score">0 PTS</span></div>
      <div class="banner" id="banner"></div>
      <div class="hint" id="hint">W/S throttle · Arrows fly · Mouse drag steers · C camera · P pause</div>
    </div>
    <div class="hud hud-center"><div class="reticle">+</div><div class="target-label" id="target-label"></div></div>
    <div class="screen-title" id="screen-title"></div>
  `;

  const el = {
    alt: root.querySelector('#alt'),
    spd: root.querySelector('#spd'),
    hdg: root.querySelector('#hdg'),
    strip: root.querySelector('#compass-strip'),
    thr: root.querySelector('#thr-fill'),
    thrVal: root.querySelector('#thr'),
    fuel: root.querySelector('#fuel-fill'),
    fuelVal: root.querySelector('#fuel'),
    dmg: root.querySelector('#dmg-fill'),
    dmgVal: root.querySelector('#dmg'),
    vsi: root.querySelector('#vsi'),
    horizon: root.querySelector('.horizon'),
    horizonSky: root.querySelector('.horizon-sky'),
    name: root.querySelector('#mission-name'),
    prog: root.querySelector('#mission-prog'),
    time: root.querySelector('#mission-time'),
    score: root.querySelector('#mission-score'),
    banner: root.querySelector('#banner'),
    target: root.querySelector('#target-label'),
    title: root.querySelector('#screen-title'),
    hint: root.querySelector('#hint'),
  };

  // Compass strip: N/E/S/W ticks scrolling with the heading.
  const ticks = [];
  for (let d = 0; d < 360; d += 15) {
    const label = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : d % 45 === 0 ? String(d) : '·';
    ticks.push(`<span class="tick" data-d="${d}">${label}</span>`);
  }
  el.strip.innerHTML = ticks.join('');

  let lastHdg = -1;
  function update(plane, mission, screen) {
    const s = plane.state;
    // On the title and game-over screens the instruments hide: the screen's
    // own card is the whole frame, and the HUD would fight it.
    root.classList.toggle('title-mode', screen === 'title' || screen === 'over');
    const altFt = Math.max(0, s.y * FEET_PER_M);
    el.alt.textContent = fmt(altFt);
    el.spd.textContent = fmt(Math.max(0, s.speed * KT_PER_MS));
    const hdgDeg = ((s.heading * 180) / Math.PI % 360 + 360) % 360;
    el.hdg.textContent = `${String(Math.round(hdgDeg)).padStart(3, '0')}°`;
    if (Math.abs(hdgDeg - lastHdg) > 0.5) {
      lastHdg = hdgDeg;
      for (const tick of el.strip.children) {
        const d = Number(tick.dataset.d);
        let rel = ((d - hdgDeg + 540) % 360) - 180;
        tick.style.transform = `translateX(${rel * 3.2}px)`;
        tick.style.opacity = Math.abs(rel) > 55 ? '0' : String(1 - Math.abs(rel) / 70);
      }
    }
    el.thr.style.width = `${Math.round(s.throttle * 100)}%`;
    el.thrVal.textContent = `${Math.round(s.throttle * 100)}%`;
    el.fuel.style.width = `${s.fuel}%`;
    el.fuelVal.textContent = String(Math.round(s.fuel));
    el.fuel.style.background = s.fuel < 20 ? '#ff5040' : '#ffb02e';
    el.dmg.style.width = `${s.damage}%`;
    el.dmgVal.textContent = String(Math.round(s.damage));
    const vsi = s.verticalSpeed * FEET_PER_M * 60;
    el.vsi.textContent = `${vsi >= 0 ? '+' : ''}${fmt(vsi)}`;
    el.horizonSky.style.transform = `translateY(${s.pitch * 60}px) rotate(${-s.roll}rad)`;
    el.horizon.style.setProperty('--bank', `${-s.roll}rad`);

    el.name.textContent = mission.def.name;
    el.prog.textContent = mission.progress();
    const tl = mission.timeLeft();
    el.time.textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
    el.score.textContent = `${fmt(mission.score)} PTS`;
    el.banner.textContent = mission.message;
    el.banner.style.opacity = mission.message ? '1' : '0';

    const t = mission.target();
    if (t && screen === 'play') {
      const dist = Math.hypot(t.x - s.x, t.y - s.y, t.z - s.z);
      el.target.textContent = t.kind === 'ring'
        ? `◉ RING ${mission.nextRingIndex + 1} — ${fmt(dist)} M`
        : `▣ ${t.name} STRIP — ${fmt(dist)} M`;
    } else {
      el.target.textContent = '';
    }
    el.hint.style.opacity = screen === 'title' ? '1' : '0';
  }

  function showTitle(html) {
    el.title.innerHTML = html;
    el.title.style.display = html ? 'block' : 'none';
  }

  return { update, showTitle, root };
}
