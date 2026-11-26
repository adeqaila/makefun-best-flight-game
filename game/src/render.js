// The renderer: one job, paint the world the pilot flies in.
// three.js (vendored) draws a golden-hour archipelago: a volcanic island
// with a runway, turquoise sea, palm clusters, drifting clouds and a
// saffron bush plane, from a chase camera or the cockpit. All geometry is
// built from the seeded world, so a screenshot is a render of the game.

import { THEMES } from './config.js';

const TERRAIN_SEGMENTS = 150;

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function createRenderer(canvas, world, themeName) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  let theme = THEMES[themeName] || THEMES.golden;

  function applyTheme(name) {
    theme = THEMES[name] || THEMES.golden;
    const top = new THREE.Color(theme.skyTop);
    const bottom = new THREE.Color(theme.skyBottom);
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 256;
    const g = cv.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${top.getHexString()}`);
    grad.addColorStop(0.62, `#${bottom.getHexString()}`);
    grad.addColorStop(1, `#${new THREE.Color(theme.fog).getHexString()}`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    sun.color.setHex(theme.sunColor);
    sun.intensity = theme.sunIntensity;
    sun.position.set(...theme.sunPos);
    hemi.color.setHex(theme.hemiSky);
    hemi.groundColor.setHex(theme.hemiGround);
    hemi.intensity = theme.hemiIntensity;
    sea.material.color.setHex(theme.sea);
    sea.material.opacity = theme.seaOpacity;
    ringMat.color.setHex(theme.ring);
    ringMat.emissive.setHex(theme.ring);
    buildTerrainColors();
  }

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 2600;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x8fb8d8, 0x5a7a52, 0.55);
  scene.add(hemi);

  // --- Sea: one big plane that catches the sun. ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshPhongMaterial({ color: 0x1e7f8e, transparent: true, opacity: 0.86, shininess: 55, specular: 0x557788 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  sea.receiveShadow = true;
  scene.add(sea);

  // --- Terrain: a heightfield, coloured by height and slope. ---
  const terrainGeo = new THREE.PlaneGeometry(2900, 2900, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  terrain.receiveShadow = true;
  scene.add(terrain);

  function buildTerrainColors() {
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(theme.sand);
    const grass = new THREE.Color(theme.grass);
    const rock = new THREE.Color(theme.rock);
    const snow = new THREE.Color(theme.snow);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = world.heightAt(x, z);
      pos.setY(i, h);
      if (h < 2.5) c.copy(sand);
      else if (h < 70) c.copy(grass).lerp(sand, Math.max(0, 1 - (h - 2.5) / 14));
      else if (h < 150) c.copy(grass).lerp(rock, (h - 70) / 80);
      else if (h < 210) c.copy(rock);
      else c.copy(rock).lerp(snow, Math.min(1, (h - 210) / 50));
      // Slope darkens rock faces so ridges read at a distance.
      const slope = Math.abs(world.heightAt(x + 6, z) - h) + Math.abs(world.heightAt(x, z + 6) - h);
      if (slope > 5) c.multiplyScalar(Math.max(0.72, 1 - slope * 0.02));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.attributes.position.needsUpdate = true;
    terrainGeo.computeVertexNormals();
  }

  // --- Runways: dark strips with centre dashes and threshold bars. ---
  const stripGroup = new THREE.Group();
  for (const s of world.strips) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(s.length, s.width),
      new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = -s.heading;
    strip.position.set(s.x, s.alt + 0.4, s.z);
    strip.receiveShadow = true;
    stripGroup.add(strip);
    // Centre dashes.
    const dashGeo = new THREE.PlaneGeometry(14, 1.6);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
    for (let d = -s.length / 2 + 24; d < s.length / 2 - 10; d += 32) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = -s.heading;
      dash.position.set(
        s.x + Math.cos(s.heading) * d,
        s.alt + 0.55,
        s.z + Math.sin(s.heading) * d,
      );
      stripGroup.add(dash);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(3, s.width * 0.8),
        new THREE.MeshBasicMaterial({ color: 0xf5f0dc }),
      );
      bar.rotation.x = -Math.PI / 2;
      bar.rotation.z = -s.heading;
      bar.position.set(
        s.x + Math.cos(s.heading) * end * (s.length / 2 - 8),
        s.alt + 0.55,
        s.z + Math.sin(s.heading) * end * (s.length / 2 - 8),
      );
      stripGroup.add(bar);
    }
    // Windsock beside the strip.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }),
    );
    pole.position.set(s.x - Math.sin(s.heading) * (s.width / 2 + 8), s.alt + 4.5, s.z + Math.cos(s.heading) * (s.width / 2 + 8));
    stripGroup.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x903a00, emissiveIntensity: 0.4 }),
    );
    sock.rotation.z = Math.PI / 2 - 0.35;
    sock.position.set(s.x - Math.sin(s.heading) * (s.width / 2 + 10), s.alt + 8.6, s.z + Math.cos(s.heading) * (s.width / 2 + 8));
    stripGroup.add(sock);
  }
  scene.add(stripGroup);

  // --- Rings: glowing torus gates, numbered by a floating marker. ---
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const ringGroup = new THREE.Group();
  const ringMeshes = world.rings.map((r, i) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r.radius, 1.1, 10, 40), ringMat);
    mesh.position.set(r.x, r.y, r.z);
    // Face the ring between its two approaches, so it reads nearly face-on
    // both from the tour (coming from the previous ring) and from a radial
    // photo pass (coming in toward the volcano): the normal bisects the
    // direction to the previous ring and the direction to the island centre.
    const prev = world.rings[(i + world.rings.length - 1) % world.rings.length];
    const toPrev = { x: prev.x - r.x, z: prev.z - r.z };
    const toCentre = { x: -r.x, z: -r.z };
    const lp = Math.hypot(toPrev.x, toPrev.z) || 1;
    const lc = Math.hypot(toCentre.x, toCentre.z) || 1;
    const nx = toPrev.x / lp + toCentre.x / lc;
    const nz = toPrev.z / lp + toCentre.z / lc;
    mesh.rotation.y = Math.atan2(nx, nz);
    mesh.userData.baseY = r.y;
    ringGroup.add(mesh);
    return mesh;
  });
  scene.add(ringGroup);

  // --- Palms: instanced trunks + fronds, scattered by the world. ---
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const frondGeo = new THREE.ConeGeometry(3.4, 5.5, 6);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3e7a34 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, world.trees.length);
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, world.trees.length);
  const dummy = new THREE.Object3D();
  world.trees.forEach((t, i) => {
    dummy.position.set(t.x, t.y + 3.5 * t.s, t.z);
    dummy.rotation.set(0, t.lean * 4, t.lean);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(t.x, t.y + (7 + 2.4) * t.s, t.z);
    dummy.updateMatrix();
    fronds.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  scene.add(trunks);
  scene.add(fronds);

  // --- Harbour houses: small boxes with warm roofs. ---
  const houseGroup = new THREE.Group();
  for (const h of world.houses) {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(h.w, h.hgt, h.d),
      new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }),
    );
    body.position.set(h.x, h.y + h.hgt / 2, h.z);
    body.rotation.y = h.rot;
    body.castShadow = true;
    houseGroup.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(h.w, h.d) * 0.75, 3.2, 4),
      new THREE.MeshLambertMaterial({ color: h.hue }),
    );
    roof.position.set(h.x, h.y + h.hgt + 1.6, h.z);
    roof.rotation.y = h.rot + Math.PI / 4;
    roof.castShadow = true;
    houseGroup.add(roof);
  }
  scene.add(houseGroup);

  // --- Clouds: soft sprites from a radial-gradient canvas texture. ---
  function cloudTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const cloudTex = cloudTexture();
  const cloudGroup = new THREE.Group();
  const cloudSprites = world.clouds.map((c) => {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false });
    const spr = new THREE.Sprite(mat);
    spr.position.set(c.x, c.y, c.z);
    spr.scale.set(c.s * 2.4, c.s, 1);
    cloudGroup.add(spr);
    return { spr, c };
  });
  scene.add(cloudGroup);

  // --- The aeroplane: a saffron bush plane, built from primitives. ---
  function buildPlane() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0xe8862e, roughness: 0.5, metalness: 0.15 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf5ead0, roughness: 0.55 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x1e6f7a, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.4 });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 6.4, 12), paint);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.castShadow = true;
    g.add(fuselage);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.1, 12), cream);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 3.6;
    g.add(nose);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.5, 12), teal);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.z = 0.6;
    g.add(stripe);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), glass);
    canopy.scale.set(1, 0.75, 1.5);
    canopy.position.set(0, 0.62, 0.9);
    g.add(canopy);
    // High wing with struts.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 2.1), cream);
    wing.position.set(0, 0.85, 0.4);
    wing.castShadow = true;
    g.add(wing);
    const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 2.1), teal);
    wingTipL.position.set(-5.7, 0.85, 0.4);
    g.add(wingTipL);
    const wingTipR = wingTipL.clone();
    wingTipR.position.x = 5.7;
    g.add(wingTipR);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), dark);
      strut.position.set(side * 1.9, -0.1, 0.6);
      strut.rotation.z = side * 0.5;
      g.add(strut);
    }
    // Tail: horizontal stabiliser + fin, teal.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.4), cream);
    tail.position.set(0, 0.25, -3.1);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), teal);
    fin.position.set(0, 0.95, -3.1);
    g.add(fin);
    // Propeller: spinner + two blades, spinning with the engine.
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 10), dark);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 4.5;
    g.add(spinner);
    const prop = new THREE.Group();
    for (const a of [0, Math.PI]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.1), dark);
      blade.rotation.z = a;
      prop.add(blade);
    }
    prop.position.z = 4.3;
    g.add(prop);
    // Fixed gear: two wheels + tail wheel.
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), dark);
      leg.position.set(side * 0.9, -0.9, 1.4);
      leg.rotation.z = side * 0.35;
      g.add(leg);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.1, -1.35, 1.4);
      g.add(wheel);
    }
    // Navigation lights: red port, green starboard, white tail.
    const navL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    navL.position.set(-5.9, 0.85, 0.4);
    g.add(navL);
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0x20ff60 }));
    navR.position.set(5.9, 0.85, 0.4);
    g.add(navR);
    g.userData.prop = prop;
    return g;
  }
  const planeMesh = buildPlane();
  scene.add(planeMesh);

  // --- Cockpit dashboard: a curved panel with six glowing gauges. ---
  function dashboardTexture() {
    const cv = document.createElement('canvas');
    cv.width = 1024;
    cv.height = 300;
    const g = cv.getContext('2d');
    g.fillStyle = '#14161c';
    g.fillRect(0, 0, 1024, 300);
    const gauges = ['ALT', 'SPD', 'HDG', 'FUEL', 'RPM', 'VSI'];
    gauges.forEach((name, i) => {
      const cx = 90 + i * 168;
      const cy = 140;
      g.beginPath();
      g.arc(cx, cy, 62, 0, Math.PI * 2);
      g.fillStyle = '#0a0e14';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#ffb02e';
      g.stroke();
      for (let t = 0; t <= 10; t += 1) {
        const a = Math.PI * 0.75 + (t / 10) * Math.PI * 1.5;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
        g.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58);
        g.lineWidth = 3;
        g.strokeStyle = '#e8e0d0';
        g.stroke();
      }
      const na = Math.PI * 0.75 + (0.35 + i * 0.09) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(na) * 48, cy + Math.sin(na) * 48);
      g.lineWidth = 4;
      g.strokeStyle = '#ff5040';
      g.stroke();
      g.fillStyle = '#ffb02e';
      g.font = 'bold 26px sans-serif';
      g.textAlign = 'center';
      g.fillText(name, cx, cy + 92);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const dash = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.35),
    new THREE.MeshBasicMaterial({ map: dashboardTexture() }),
  );
  // The panel's printed face looks back at the pilot: turn it around so the
  // camera, behind it, reads the gauges the right way round.
  dash.rotation.y = Math.PI;
  dash.position.set(0, 0, 0);
  const cockpit = new THREE.Group();
  cockpit.add(dash);
  cockpit.visible = false;
  scene.add(cockpit);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 6000);
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let cameraMode = 'chase';

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function draw(plane, mission, screen, time, dt) {
    const s = plane.state;
    // Plane mesh follows the flight state.
    planeMesh.position.set(s.x, s.y, s.z);
    planeMesh.rotation.order = 'YXZ';
    planeMesh.rotation.y = -s.heading + Math.PI / 2;
    planeMesh.rotation.x = -s.pitch;
    planeMesh.rotation.z = s.roll;
    planeMesh.userData.prop.rotation.z = s.propAngle;
    planeMesh.visible = cameraMode !== 'cockpit' || screen !== 'play';

    // Rings bob gently; the next one pulses brighter.
    ringMeshes.forEach((m, i) => {
      m.position.y = m.userData.baseY + Math.sin(time * 1.4 + i) * 1.2;
      const next = mission && mission.nextRingIndex === i && mission.def.rings > 0;
      m.material = next ? ringMat : ringMat;
      m.scale.setScalar(next ? 1 + Math.sin(time * 5) * 0.05 : 1);
      m.visible = !mission || mission.def.rings === 0 || i >= mission.nextRingIndex;
    });
    // Clouds drift with the wind.
    for (const { spr, c } of cloudSprites) {
      spr.position.x += c.speed * dt;
      if (spr.position.x > 1500) spr.position.x = -1500;
    }

    // Camera: chase behind the plane, or the cockpit when asked.
    const fwdX = Math.cos(s.heading);
    const fwdZ = Math.sin(s.heading);
    if (cameraMode === 'cockpit') {
      cockpit.visible = true;
      const eyeX = s.x + fwdX * 1.6;
      const eyeY = s.y + 0.9;
      const eyeZ = s.z + fwdZ * 1.6;
      camera.position.set(eyeX, eyeY, eyeZ);
      camera.up.set(0, 1, 0);
      camera.lookAt(
        s.x + fwdX * 60 + Math.sin(s.roll) * 4,
        s.y + Math.sin(s.pitch) * 60 + 0.4,
        s.z + fwdZ * 60,
      );
      // The panel rides 3.2 m ahead of the eye and 1.15 m below it, turning
      // with the aeroplane, so it fills the bottom of the frame.
      cockpit.position.set(eyeX + fwdX * 3.2, eyeY - 1.15, eyeZ + fwdZ * 3.2);
      cockpit.rotation.order = 'YXZ';
      cockpit.rotation.y = -s.heading + Math.PI / 2;
      cockpit.rotation.x = -s.pitch;
      cockpit.rotation.z = s.roll;
    } else {
      cockpit.visible = false;
      const back = 15;
      const up = 5;
      const tx = s.x - fwdX * back;
      const tz = s.z - fwdZ * back;
      const ty = s.y + up + Math.sin(s.pitch) * 2;
      const k = 1 - Math.pow(0.0001, dt);
      camPos.lerp(new THREE.Vector3(tx, Math.max(ty, world.heightAt(tx, tz) + 3), tz), k);
      camLook.lerp(new THREE.Vector3(s.x + fwdX * 22, s.y + 1, s.z + fwdZ * 22), 1 - Math.pow(0.00001, dt));
      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(camLook);
      camera.rotation.z += s.roll * 0.12;
    }
    // Sun follows the plane so shadows stay near.
    sun.position.set(s.x + theme.sunPos[0], theme.sunPos[1], s.z + theme.sunPos[2]);
    sun.target.position.set(s.x, 0, s.z);
    renderer.render(scene, camera);
  }

  function setCamera(mode) {
    cameraMode = mode;
  }

  function snapCamera(plane) {
    const s = plane.state;
    const fwdX = Math.cos(s.heading);
    const fwdZ = Math.sin(s.heading);
    camPos.set(s.x - fwdX * 15, s.y + 5, s.z - fwdZ * 15);
    camLook.set(s.x + fwdX * 22, s.y + 1, s.z + fwdZ * 22);
  }

  applyTheme(themeName);
  buildTerrainColors();

  return {
    draw, resize, applyTheme, setCamera, snapCamera,
    get cameraMode() { return cameraMode; },
    get scene() { return scene; },
  };
}
