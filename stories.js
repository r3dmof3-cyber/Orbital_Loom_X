/* Orbital Loom X — deep-sky stories
 * © 2026 Yousif Anwar Alkmali (يوسف أنور الكمالي) — MIT License
 *
 * Six extra scenes drawn in their own space centred on the origin:
 * pulsar, TRAPPIST-1, kilonova, three black holes, TON 618, cosmic symphony, parade of sizes.
 * The engine (script.js) owns the camera, sky, bloom and HUD; this file only
 * draws the scene and reports a few live facts.
 */
(() => {
  'use strict';
  const E = window.__olx;
  if (!E) return;
  const { gl, program, use, P, v3, cam, sim, S, T, project, mulPoint, mulDir, basisMat, drawBody, clamp, lerp } = E;
  const SH = window.SH, TAU = Math.PI * 2;
  const HDR = '#version 300 es\nprecision highp float;\n';

  /* ── screen-space ribbon for orbits and trails (positions projected on the CPU) ── */
  const pPath = program(HDR + `layout(location=0) in vec3 aP; layout(location=1) in vec2 aS; out vec2 vS;
    void main(){ vS = aS; gl_Position = vec4(aP, 1.0); }`,
  HDR + `in vec2 vS; out vec4 o; uniform vec3 uColor; uniform float uGain;
    void main(){ float e = 1.0 - vS.x * vS.x; o = vec4(uColor * e * e * vS.y * uGain, 0.0); }`);
  const pathVAO = gl.createVertexArray(), pathBuf = gl.createBuffer();
  gl.bindVertexArray(pathVAO); gl.bindBuffer(gl.ARRAY_BUFFER, pathBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.bindVertexArray(null);
  let pathArr = new Float32Array(4096);
  /* opts: fade (alpha rises tail→head), dash (segments per dash) */
  function drawPath(pts, color, widthPx, gain, opts) {
    const n = pts.length; if (n < 2) return;
    const [W, H] = E.size(), vp = cam.vp, o = opts || {};
    if (pathArr.length < n * 10) pathArr = new Float32Array(n * 10);
    const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n), ok = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12], y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
      const z = vp[2] * p[0] + vp[6] * p[1] + vp[10] * p[2] + vp[14], w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
      ok[i] = w > 0.02 ? 1 : 0; const iw = 1 / Math.max(w, 0.02);
      sx[i] = x * iw; sy[i] = y * iw; sz[i] = z * iw;
    }
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(i - 1, 0), b = Math.min(i + 1, n - 1);
      let dx = (sx[b] - sx[a]) * W, dy = (sy[b] - sy[a]) * H; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const nx = -dy * widthPx / W, ny = dx * widthPx / H;
      let al = ok[i] && ok[a] && ok[b] ? 1 : 0;
      if (o.fade) al *= Math.pow(i / (n - 1), o.fade);
      if (o.dash && (Math.floor(i / o.dash) & 1)) al = 0;
      pathArr[k++] = sx[i] + nx; pathArr[k++] = sy[i] + ny; pathArr[k++] = sz[i]; pathArr[k++] = 1; pathArr[k++] = al;
      pathArr[k++] = sx[i] - nx; pathArr[k++] = sy[i] - ny; pathArr[k++] = sz[i]; pathArr[k++] = -1; pathArr[k++] = al;
    }
    gl.bindVertexArray(pathVAO); gl.bindBuffer(gl.ARRAY_BUFFER, pathBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pathArr.subarray(0, k), gl.DYNAMIC_DRAW);
    use(pPath, { uColor: color, uGain: gain });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
  }
  function circle(c, a1, a2, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n * TAU, cs = Math.cos(t) * r, sn = Math.sin(t) * r; out.push([c[0] + a1[0] * cs + a2[0] * sn, c[1] + a1[1] * cs + a2[1] * sn, c[2] + a1[2] * cs + a2[2] * sn]); }
    return out;
  }

  /* ── sprites: 0 soft glow · 1 black hole with photon ring · 2 expanding shell ── */
  const pSprite = program(SH.VS_BILL, HDR + `in vec2 vQ; out vec4 o; uniform vec3 uTint; uniform float uGain, uParam; uniform int uMode;
    void main(){
      float r = length(vQ); if (r > 1.0) discard;
      float edge = 1.0 - smoothstep(0.86, 1.0, r);
      if (uMode == 0) { float f = exp(-r * 9.0) * 3.0 + exp(-r * 3.2) * 0.5; o = vec4(uTint * f * uGain * edge, 0.0); }
      else if (uMode == 1) {
        float hole = 1.0 - smoothstep(0.30, 0.33, r);
        float ring = exp(-pow((r - 0.36) / 0.035, 2.0)) * 5.0 + exp(-max(r - 0.36, 0.0) * 7.0) * 0.8 * step(0.33, r);
        o = vec4(uTint * ring * uGain * edge * (1.0 - hole), hole);
      } else {
        float sh = exp(-pow((r - uParam) / 0.05, 2.0)) + exp(-pow((r - uParam * 0.8) / 0.12, 2.0)) * 0.35;
        o = vec4(uTint * sh * uGain * edge, 0.0);
      }
    }`);
  function sprite(pos, size, mode, tint, gain, param) {
    use(pSprite, { uView: cam.view, uProj: cam.proj, uCenter: pos, uQuad: size, uMode: mode, uTint: tint, uGain: gain, uParam: param || 0 });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function corona(pos, size, tint, gain) {
    use(P.corona, { uView: cam.view, uProj: cam.proj, uCenter: pos, uQuad: size, uTime: sim.realTime, uGain: gain, uAudio: 0, uTint: tint });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ── pulsar: ray-traced lighthouse beams ── */
  const pPulsar = program(SH.VS_FULL, HDR + `in vec2 vUv; out vec4 o;
    uniform vec3 uCam, uFwd, uRight, uUp, uAxis; uniform vec2 uTan; uniform float uFlash;
    float beam(vec3 ro, vec3 rd, vec3 ax){
      float b = dot(rd, ax), d0 = dot(ro, rd), d1 = dot(ro, ax), den = max(1.0 - b * b, 1e-3);
      float t = (b * d1 - d0) / den, s = (d1 - b * d0) / den;
      if (t < 0.0) return 0.0;
      float dist = length(ro + rd * t - ax * s), as = abs(s), rad = 0.22 + as * 0.075;
      return exp(-dist * dist / (rad * rad)) * exp(-as / 36.0) * smoothstep(0.6, 2.4, as) * min(1.0 / sqrt(den), 5.0);
    }
    void main(){
      vec2 n = vUv * 2.0 - 1.0;
      vec3 rd = normalize(uFwd + n.x * uTan.x * uRight + n.y * uTan.y * uUp);
      float tc = max(-dot(uCam, rd), 0.0), dm = length(uCam + rd * tc);
      float star = exp(-dm * dm / 0.5) * 9.0 + exp(-dm / 2.2) * 0.55 + exp(-dm / 9.0) * 0.10;
      vec3 col = vec3(0.72, 0.86, 1.0) * star * (1.0 + uFlash * 5.0);
      col += vec3(0.45, 0.68, 1.0) * beam(uCam, rd, uAxis) * 1.6;
      col += vec3(0.9, 0.95, 1.0) * uFlash * exp(-dm / 14.0) * 1.5;
      o = vec4(col, 0.0);
    }`);

  /* ── labels (own pool, same styling as the engine's) ── */
  const pool = []; let used = 0;
  function label(pos, name, sub, color, center) {
    let el = pool[used];
    if (!el) { el = document.createElement('div'); el.innerHTML = '<span class="tick"></span><div class="n"></div><div class="d"></div>'; E.labelLayer.appendChild(el); pool.push(el); }
    used++;
    const cls = 'lbl ' + (center ? 'bh' : 'planet'); if (el.className !== cls) el.className = cls;
    const nEl = el.children[1], dEl = el.children[2];
    if (nEl.textContent !== name) nEl.textContent = name;
    if (dEl.textContent !== (sub || '')) dEl.textContent = sub || '';
    el.style.setProperty('--c', color || '#fff');
    const p = project(cam.vp, pos), a = (S.showLabels && S.hudLayout !== 2) ? E.fade() : 0;
    el._n = p ? { x: p.x / window.innerWidth, y: p.y / window.innerHeight, a } : null;
    if (!p || a < 0.02) { el.style.opacity = 0; return; }
    el.style.transform = center ? `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)` : `translate(${p.x + 10}px, ${p.y}px) translate(0, -50%)`;
    el.style.opacity = a.toFixed(2);
  }
  function endLabels() { for (let i = used; i < pool.length; i++) { pool[i].style.opacity = 0; pool[i]._n = null; } }
  const tx = (ar, en) => (S.language === 1 ? en : S.language === 2 ? `${ar} · ${en}` : ar);

  /* ── fabric helper ── */
  const FAB_L = 62, NO_ORB = new Array(8).fill(1e5);
  let fabM = new Array(36).fill(0);
  function setMasses(list) { fabM = new Array(36).fill(0); list.forEach((m, i) => { fabM[i * 4] = m[0]; fabM[i * 4 + 1] = m[1]; fabM[i * 4 + 2] = m[2]; fabM[i * 4 + 3] = m[3]; }); for (let i = list.length; i < 9; i++) fabM[i * 4 + 3] = 1; }
  function well(x, z) { let d = 0; for (let i = 0; i < 9; i++) { const dx = x - fabM[i * 4], dz = z - fabM[i * 4 + 1]; d += fabM[i * 4 + 2] / Math.sqrt(dx * dx + dz * dz + fabM[i * 4 + 3] ** 2); } return d; }
  let fabL = FAB_L;
  const depth = (x, z) => Math.max(well(x, z) - well(fabL, 0), 0);
  function drawFabric(color, wave, gain, o) {
    o = o || {};
    gl.bindVertexArray(E.fabricMesh.vao);
    use(P.fabric, { uVP: cam.vp, uSun: o.origin || [0, 0, 0], uE1: [1, 0, 0], uE2: [0, 0, 1], uN: [0, 1, 0], uL: o.L || FAB_L, uMass: fabM, uSpacing: o.spacing || 2.4, uGain: gain || 1, uDK: 1,
      uTime: sim.realTime, uScroll: [0, 0], uColor: color, uOrb: NO_ORB, uWave: wave || [0, 0, 0, 0], uWaveC: o.waveC || [0, 0] });
    gl.drawElements(gl.TRIANGLES, E.fabricMesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(E.emptyVAO);
  }
  function stateBodies() { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.bindVertexArray(E.emptyVAO); }
  function stateGlow() { gl.depthMask(false); gl.bindVertexArray(E.emptyVAO); }
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const upBasis = () => basisMat({ a1: X, a2: Z, axis: Y });

  const audio = { tick: 0, chirp: 0, boom: 0 };
  let facts = [];
  const st = { id: '', t: 0 };
  let ST0 = +(new URLSearchParams(location.search).get('st') || 0);   // ?st=seconds starts a story part-way in

  /* ═════════ pulsar ═════════ */
  const PULSARS = [
    { n: 'PSR B0329+54', hz: 1.4, vis: 0.35, ar: 'نابض عادي', en: 'ordinary pulsar' },
    { n: 'PSR B0833−45 (Vela)', hz: 11.2, vis: 0.8, ar: 'نابض الشراع', en: 'Vela pulsar' },
    { n: 'PSR B0531+21 (Crab)', hz: 29.9, vis: 1.5, ar: 'نابض السرطان', en: 'Crab pulsar' },
    { n: 'PSR J1748−2446ad', hz: 716, vis: 3.0, ar: 'أسرع نابض معروف', en: 'fastest known pulsar' },
  ];
  let pulPhase = 0;
  function pulsar(c) {
    const idx = Math.floor(st.t / 10) % PULSARS.length, pz = PULSARS[idx];
    pulPhase = (pulPhase + c.dt * pz.vis * TAU) % TAU;
    const tilt = 0.62, ax = [Math.sin(tilt) * Math.cos(pulPhase), Math.cos(tilt), Math.sin(tilt) * Math.sin(pulPhase)];
    const toCam = v3.norm(cam.eye), flash = Math.pow(Math.abs(v3.dot(ax, toCam)), 46) * (1 + sim.audio * 1.5) + sim.audio * 0.15;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(E.emptyVAO);
    use(pPulsar, { uCam: cam.eye, uFwd: c.fwd, uRight: c.right, uUp: c.up, uTan: [cam.tanX, cam.tanY], uAxis: ax, uFlash: flash });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // dipole magnetic field lines, locked to the magnetic axis
    const e1 = v3.norm(v3.cross(ax, [0.3, 0.1, 0.9])), e2 = v3.cross(ax, e1);
    for (let j = 0; j < 8; j++) {
      const az = j / 8 * TAU, d = v3.add(v3.mul(e1, Math.cos(az)), v3.mul(e2, Math.sin(az))), L = j % 2 ? 13 : 8, pts = [];
      for (let i = 2; i <= 46; i++) { const th = i / 48 * Math.PI, r = L * Math.sin(th) ** 2; pts.push(v3.add(v3.mul(ax, r * Math.cos(th)), v3.mul(d, r * Math.sin(th)))); }
      drawPath(pts, [0.35, 0.75, 1.0], 1.4 * c.pxScale, 0.22);
    }
    drawPath([v3.mul(Y, -9), v3.mul(Y, 9)], [1, 1, 1], 1.1 * c.pxScale, 0.12, { dash: 1 });
    label([0, 3.2, 0], pz.n, tx(pz.ar, pz.en), '#bfe0ff', true);
    label(v3.mul(ax, 20), tx('حزمة راديوية', 'radio beam'), '', '#8fc4ff');
    label(v3.mul(Y, 9.5), tx('محور الدوران', 'spin axis'), '', '#ffffff');
    audio.tick = pz.hz;
    facts = [['النجم', 'Pulsar', pz.n], ['الدوران', 'Spin', `${pz.hz} <small>${tx('مرة/ث', 'times/s')}</small>`], ['القطر', 'Diameter', '≈ 20 <small>km</small>'],
      ['الكتلة', 'Mass', '≈ 1.4 <small>M☉</small>'], ['العرض', 'Shown', tx('حركة مبطّأة', 'slowed down')], ['ملعقة منه تزن', 'One teaspoon', '≈ 10⁹ <small>t</small>']];
  }

  /* ═════════ TRAPPIST-1 ═════════ */
  const TR = [['b', 4.6, 1.51, 1.12, 0], ['c', 6.3, 2.42, 1.10, 1], ['d', 8.9, 4.05, 0.79, 3], ['e', 11.7, 6.10, 0.92, 2], ['f', 15.4, 9.21, 1.05, 2], ['g', 18.8, 12.35, 1.13, 7], ['h', 24.8, 18.77, 0.76, 0]];
  const TRC = ['#c9b8a6', '#e8c98a', '#d98a66', '#7fc4ff', '#8fd6c0', '#9fb4ff', '#b9c2cc'];
  function trappist(c) {
    const sunV = mulPoint(cam.view, [0, 0, 0]);
    stateBodies();
    drawBody([0, 0, 0], 1.5, 8, { uBasis: upBasis(), uSpin: sim.realTime * 0.05, uEmis: 4.5, uColor: [1.0, 0.36, 0.14], uSunV: sunV, uRingN: [0, 1, 0] });
    const pos = TR.map((p, i) => { const a = st.t * TAU / p[2] * 0.55 + i * 2.1; return [p[1] * Math.cos(a), 0, p[1] * Math.sin(a)]; });
    TR.forEach((p, i) => drawBody(pos[i], p[3] * 0.5, p[4], { uBasis: upBasis(), uSpin: st.t * 0.3, uEmis: 1, uColor: [0.8, 0.7, 0.6], uSunV: sunV, uRingN: mulDir(cam.view, Y) }));
    stateGlow();
    TR.forEach((p, i) => { const hz = i >= 3 && i <= 5; drawPath(circle([0, 0, 0], X, Z, p[1], 160), hz ? [0.35, 1.0, 0.6] : [0.8, 0.85, 1.0], 1.3 * c.pxScale, hz ? 0.5 : 0.3); });
    [10.3, 21.0].forEach((r) => drawPath(circle([0, 0, 0], X, Z, r, 220), [0.3, 1.0, 0.55], 2.2 * c.pxScale, 0.4, { dash: 3 }));
    drawPath(circle([0, 0, 0], X, Z, 155, 300), [1.0, 0.8, 0.5], 1.4 * c.pxScale, 0.35, { dash: 4 });
    corona([0, 0, 0], 16, [1.0, 0.3, 0.12], 0.9);
    TR.forEach((p, i) => label(pos[i], 'TRAPPIST-1' + p[0], `${p[2]} ${tx('يوم', 'd')} · ${p[3]} R⊕`, TRC[i]));
    label([0, 2.4, 0], 'TRAPPIST-1', tx('قزم أحمر', 'red dwarf'), '#ff8a66', true);
    label([0, 0, -21], tx('المنطقة الصالحة للحياة', 'Habitable zone'), '', '#6dffa8', true);
    label([0, 0, -155], tx('مدار عطارد للمقارنة', 'Mercury’s orbit, for scale'), '', '#ffd9a0', true);
    audio.tick = 0;
    facts = [['البعد', 'Distance', '40 <small>ly</small>'], ['الكواكب', 'Planets', '7'], ['في المنطقة الصالحة', 'In habitable zone', '3'], ['كتلة النجم', 'Star mass', '0.09 <small>M☉</small>'],
      ['أقصر سنة', 'Shortest year', '1.5 <small>' + tx('يوم', 'days') + '</small>'], ['أطول سنة', 'Longest year', '18.8 <small>' + tx('يوم', 'days') + '</small>']];
  }

  /* ═════════ kilonova ═════════ */
  let kPhase = 0;
  function kilonova(c) {
    const T1 = 22, T2 = 8, t = st.t % (T1 + T2), merged = t >= T1, tau = Math.min(t / T1, 1);
    const a = merged ? 0 : Math.max(22 * Math.pow(1 - tau, 0.25), 1.6), om = Math.min(0.9 * Math.pow(22 / Math.max(a, 1.6), 1.5), 16);
    if (t < 0.1) kPhase = 0;
    kPhase += om * c.dt;
    const m1 = 1.6, m2 = 1.2, M = m1 + m2, r1 = a * m2 / M, r2 = a * m1 / M;
    const p1 = [Math.cos(kPhase) * r1, 0, Math.sin(kPhase) * r1], p2 = [-Math.cos(kPhase) * r2, 0, -Math.sin(kPhase) * r2];
    const tm = t - T1;
    fabL = FAB_L;
    if (merged) setMasses([[0, 0, 92, 3.2]]); else setMasses([[p1[0], p1[2], 52, 2.6], [p2[0], p2[2], 40, 2.6]]);
    p1[1] = -depth(p1[0], p1[2]) + 1.2; p2[1] = -depth(p2[0], p2[2]) + 1.2;
    const amp = (merged ? 2.2 * Math.exp(-tm * 0.7) : 0.2 + 1.9 * tau * tau) + sim.audio * 0.9;
    const wave = [amp, clamp(om * 0.22, 0.22, 1.5), 2 * kPhase + (merged ? tm * 14 : 0), merged ? 3 : a * 0.6 + 3];
    stateBodies(); stateGlow();
    drawFabric([0.45, 0.4, 1.0], wave, 1);
    if (!merged) {
      drawPath(circle([0, p1[1], 0], X, Z, r1, 90), [0.5, 0.9, 1.0], 1.2 * c.pxScale, 0.3);
      drawPath(circle([0, p2[1], 0], X, Z, r2, 90), [1.0, 0.55, 0.9], 1.2 * c.pxScale, 0.3);
      corona(p1, 7, [0.45, 0.85, 1.0], 1.2); corona(p2, 6, [1.0, 0.5, 0.85], 1.2);
      label(p1, tx('النجم أ', 'Star A'), '1.6 M☉', '#8fe3ff'); label(p2, tx('النجم ب', 'Star B'), '1.2 M☉', '#ff9fe0');
    } else {
      const c0 = [0, -depth(0, 0) * 0.35 + 2, 0], f = Math.exp(-tm * 1.6);
      sprite(c0, 60, 0, [1.0, 0.95, 0.85], 26 * f + 0.6);
      sprite(c0, 12 + tm * 11, 2, [0.5, 0.7, 1.0], 2.4 * Math.exp(-tm * 0.35), 0.82);
      sprite(c0, 9 + tm * 6.5, 2, [1.0, 0.45, 0.2], 3.0 * Math.exp(-tm * 0.25), 0.7);
      label([0, c0[1] + 6, 0], tx('كيلونوفا', 'Kilonova'), tx('ذهب · بلاتين · يورانيوم', 'gold · platinum · uranium'), '#ffd27a', true);
      if (tm < 0.1) audio.boom = performance.now();
    }
    audio.tick = 0; audio.chirp = merged ? 0 : 0.02 + tau;
    const fHz = merged ? 0 : 24 * Math.pow(22 / a, 1.5), sepKm = merged ? 0 : a * 14, vc = merged ? 0 : Math.min(0.04 + 0.34 * tau * tau, 0.38);
    facts = [['المسافة بينهما', 'Separation', merged ? '—' : `${sepKm.toFixed(0)} <small>km</small>`], ['دورات في الثانية', 'Orbits per second', merged ? '—' : fHz.toFixed(0)],
      ['السرعة', 'Speed', merged ? '—' : `${(vc * 100).toFixed(0)}% <small>c</small>`], ['أمواج الجاذبية', 'Gravitational waves', `${(amp / 2.2 * 100).toFixed(0)}%`],
      ['الحالة', 'Status', merged ? tx('اندماج!', 'Merged!') : tx('اقتراب حلزوني', 'Inspiral')], ['حدث مرصود', 'Observed event', 'GW170817']];
  }

  /* ═════════ three black holes ═════════ */
  let tb = null;
  function tbInit() {
    const r = () => Math.random() - 0.5;
    tb = { m: [3.2, 2.6, 2.0], p: [[-11, 4 + r() * 3], [10, 6 + r() * 3], [1 + r() * 4, -11]], v: [[0.6 + r(), -1.6], [-1.2, 0.9 + r()], [1.4, 0.8]], tr: [[], [], []], t: 0, out: 0, vmax: 0 };
    const M = tb.m[0] + tb.m[1] + tb.m[2]; let cx = 0, cz = 0, vx = 0, vz = 0;
    tb.m.forEach((m, i) => { cx += m * tb.p[i][0]; cz += m * tb.p[i][1]; vx += m * tb.v[i][0]; vz += m * tb.v[i][1]; });
    tb.p.forEach((p, i) => { p[0] -= cx / M; p[1] -= cz / M; tb.v[i][0] -= vx / M; tb.v[i][1] -= vz / M; });
  }
  function tbStep(h) {
    const G = 55, acc = [[0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) {
      const dx = tb.p[j][0] - tb.p[i][0], dz = tb.p[j][1] - tb.p[i][1], d2 = dx * dx + dz * dz + 1.4, f = G * tb.m[j] / (d2 * Math.sqrt(d2));
      acc[i][0] += f * dx; acc[i][1] += f * dz;
    }
    for (let i = 0; i < 3; i++) { tb.v[i][0] += acc[i][0] * h; tb.v[i][1] += acc[i][1] * h; tb.p[i][0] += tb.v[i][0] * h; tb.p[i][1] += tb.v[i][1] * h; }
  }
  const TBC = [[1.0, 0.75, 0.4], [0.5, 0.85, 1.0], [0.95, 0.55, 1.0]], TBH = ['#ffc070', '#8fdcff', '#f09aff'];
  function threebody(c) {
    if (!tb || st.t < 0.05) tbInit();
    const n = 8; for (let i = 0; i < n; i++) tbStep(c.dt / n);
    tb.t += c.dt;
    let far = 0, minD = 1e9; tb.vmax = 0;
    tb.p.forEach((p, i) => { far = Math.max(far, Math.hypot(p[0], p[1])); tb.vmax = Math.max(tb.vmax, Math.hypot(tb.v[i][0], tb.v[i][1])); for (let j = i + 1; j < 3; j++) minD = Math.min(minD, Math.hypot(p[0] - tb.p[j][0], p[1] - tb.p[j][1])); });
    if (far > 52) tb.out += c.dt;
    if (tb.out > 2.5 || tb.t > 60) tbInit();
    fabL = FAB_L;
    setMasses(tb.p.map((p, i) => [p[0], p[1], tb.m[i] * 14, 2.6]));
    const pos = tb.p.map((p) => [p[0], -depth(p[0], p[1]) + 1.6, p[1]]);
    pos.forEach((p, i) => { if (c.dt > 0) { tb.tr[i].push(p); if (tb.tr[i].length > 260) tb.tr[i].shift(); } });
    stateBodies(); stateGlow();
    drawFabric([0.5, 0.36, 1.0], null, 1);
    pos.forEach((p, i) => drawPath(tb.tr[i], TBC[i], 2.2 * c.pxScale, 0.9, { fade: 1.6 }));
    gl.depthMask(false);
    pos.map((p, i) => [v3.len(v3.sub(p, cam.eye)), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => sprite(pos[i], 3.2 + tb.m[i] * 1.5, 1, TBC[i], 1.0));
    pos.forEach((p, i) => label(v3.add(p, [0, 2.5, 0]), `${(tb.m[i] * 10).toFixed(0)} M☉`, '', TBH[i], true));
    audio.tick = 0; audio.chirp = 0;
    facts = [['الزمن', 'Time', `${tb.t.toFixed(1)} <small>s</small>`], ['أقرب مسافة', 'Closest pair', `${(minD * 40).toFixed(0)} <small>km</small>`],
      ['أسرع ثقب', 'Fastest', `${(tb.vmax * 520).toFixed(0)} <small>km/s</small>`], ['الحالة', 'Status', far > 52 ? tx('قُذف أحدها بعيداً!', 'One was flung out!') : tx('رقصة فوضوية', 'Chaotic dance')],
      ['الكتل', 'Masses', '32 · 26 · 20 <small>M☉</small>'], ['قابلية التنبؤ', 'Predictability', tx('معدومة', 'none')]];
  }

  /* ═════════ TON 618 ═════════ */
  const AU = [0.39, 0.72, 1, 1.52, 5.2, 9.58, 19.2, 30.1];
  function ton618(c) {
    const RS = 60, k = RS / 1300, centre = [0, 0, -RS * 1.04];
    const ph = (st.t % 36) / 36, e = ph < 0.5 ? ph * 2 : 2 - ph * 2, ease = e * e * (3 - 2 * e);
    cam.storyDist = Math.exp(lerp(Math.log(7 / 560), 0, clamp(ease * 1.25 - 0.05, 0, 1)));
    stateBodies(); gl.bindVertexArray(E.emptyVAO);
    const cv = mulPoint(cam.view, centre), z = Math.min(cv[2] + RS * 13, -cam.near * 1.05), pr = cam.proj;
    const cz = pr[10] * z + pr[14], cw = pr[11] * z + pr[15], dep = cw > 0 ? clamp((cz / cw) * 0.5 + 0.5, 0, 1) : 1;
    use(P.bh, { uCam: v3.sub(cam.eye, centre), uFwd: c.fwd, uRight: c.right, uUp: c.up, uTan: [cam.tanX, cam.tanY], uRs: RS, uTime: sim.realTime % 4000,
      uDiskIn: 3.0, uDiskOut: 11.5, uDepth: dep, uBoost: 1, uBound: 13.0 });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE);
    const a2 = v3.norm([0, 0.34, 0.94]);
    AU.forEach((au, i) => drawPath(circle([0, 0, 0], X, a2, au * k, 96), i === 7 ? [0.6, 0.75, 1.0] : [0.85, 0.85, 0.9], (i === 7 ? 1.8 : 1.1) * c.pxScale, i === 7 ? 0.9 : 0.5));
    corona([0, 0, 0], Math.max(0.5 * k * 6, cam.dist * 0.012), [1.0, 0.8, 0.45], 1.4);
    label([0, 30.1 * k, 0], tx('المجموعة الشمسية', 'Solar System'), tx('مدار نبتون: 60 وحدة فلكية', 'Neptune’s orbit: 60 AU across'), '#ffd9a0', true);
    if (cam.dist > 150) label([0, RS * 1.02, centre[2]], 'TON 618', tx('أفق الحدث: 2600 وحدة فلكية', 'event horizon: 2,600 AU across'), '#ffcf8a', true);
    audio.tick = 0; audio.chirp = 0;
    facts = [['الكتلة', 'Mass', '66 <small>' + tx('مليار شمس', 'billion M☉') + '</small>'], ['قطر الأفق', 'Horizon width', '2,600 <small>AU</small>'], ['مقارنة بنبتون', 'vs Neptune’s orbit', '× 43'],
      ['البعد', 'Distance', '10.4 <small>' + tx('مليار س.ض', 'billion ly') + '</small>'], ['مقارنة بالرامي A*', 'vs Sagittarius A*', '× 15,000'], ['الضوء يعبره في', 'Light crosses in', '15 <small>' + tx('يوماً', 'days') + '</small>']];
  }

  /* ═════════ parade of sizes ═════════ */
  const SZ = [[0, 0.383], [3, 0.532], [1, 0.949], [2, 1], [7, 3.88], [6, 4.01], [5, 9.45], [4, 11.21], [8, 109]];
  /* every body keeps its real axial tilt, so Saturn's rings are inclined and Uranus's stand almost upright.
     ext = half-width the body really occupies along the line-up, rings included, so nothing overlaps its neighbour */
  const SZB = SZ.map(([type, R]) => {
    const pl = E.PLANETS[type], o = (pl ? pl.obl : 7) * Math.PI / 180;
    const axis = v3.norm([Math.sin(o) * 0.45, Math.cos(o), Math.sin(o) * 0.89]);
    const a1 = v3.norm(v3.cross(axis, Math.abs(axis[2]) > 0.95 ? X : Z)), a2 = v3.cross(axis, a1);
    const ring = pl && pl.ring ? pl.ring : 1;
    return { axis, a1, a2, ext: Math.max(R, R * ring * Math.sqrt(1 - axis[0] * axis[0])) };
  });
  const SZX = (() => { const xs = [0]; for (let i = 1; i < SZ.length; i++) xs.push(xs[i - 1] + (SZB[i - 1].ext + SZB[i].ext) * 1.2 + (SZ[i - 1][1] + SZ[i][1]) * 0.2); return xs; })();
  const SZ_STEP = 3.6, SZ_PLAN = 8 * SZ_STEP, SZ_MOVE = 5.5, SZ_HOLD = 10, SZ_LOOP = SZ_PLAN + SZ_MOVE + SZ_HOLD;
  let szT = 0, szDip = false;
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
  function sizes(c) {
    szT = st.t;
    if (szT > SZ_LOOP - 0.55 && !szDip) {      // fade through black and start again from Mercury
      szDip = E.dip(() => { st.t = 0; szT = 0; szDip = false; st.snap = 2; });
    }
    const [W, H] = E.size(), aspect = W / H;
    const portrait = aspect < 1 ? Math.min(2.4, Math.pow(1 / aspect, 0.8)) : 1;
    // close-up framing for the planet in focus
    const f = clamp(szT / SZ_STEP, 0, 7), i0 = Math.floor(f), i1 = Math.min(i0 + 1, 7);
    let u = f - i0; u = clamp((u - 0.45) / 0.55, 0, 1); u = u * u * (3 - 2 * u);
    let fx = lerp(SZX[i0], SZX[i1], u), fr = Math.exp(lerp(Math.log(SZ[i0][1]), Math.log(SZ[i1][1]), u));
    const fe = Math.exp(lerp(Math.log(SZB[i0].ext), Math.log(SZB[i1].ext), u));
    let dist = Math.max(fr * 4.6, fe * 2.9);
    // final framing: the whole line-up with the Sun filling the right side
    const sunX = SZX[8], left = SZX[0] - 3, right = sunX + 109 * 1.08;
    const tanX = Math.tan(25 * Math.PI / 180) * aspect;
    const fxF = (left + right) / 2, distF = Math.max((right - left) / 2 / tanX, 109 * 1.6 / Math.tan(25 * Math.PI / 180)) / portrait;
    const k = smooth((szT - SZ_PLAN) / SZ_MOVE);          // 0 → 1 during the reveal
    const hold = clamp((szT - SZ_PLAN - SZ_MOVE) / SZ_HOLD, 0, 1);
    if (k > 0) {
      fx = lerp(fx, fxF, k);
      dist = Math.exp(lerp(Math.log(dist), Math.log(distF * (1 - 0.06 * hold)), k));
    }
    cam.storyDist = dist;
    // during the reveal the story drives the distance itself (smooth by construction), so a lagging spring can never carry the camera into the Sun
    if (k > 0) cam.logDist.snap(Math.log(dist * Math.exp(cam.zoom)));
    // one light for everything: the Sun itself, nudged toward the camera so the planets read as 3/4 lit
    const light = [sunX - fx, 60, 260];
    const sunV = mulPoint(cam.view, light);
    stateBodies();
    const jobs = [];
    SZ.forEach(([type, R], i) => {
      const pos = [SZX[i] - fx, 0, 0];
      if (Math.abs(pos[0]) - R > cam.dist * 3.2) return;
      const pl = E.PLANETS[type], B = SZB[i];
      drawBody(pos, R, type, { uBasis: basisMat(B), uSpin: sim.realTime * (type === 8 ? 0.02 : 0.12), uEmis: type === 8 ? 0.85 : 1, uColor: type === 8 ? [1, 0.8, 0.4] : pl.col, uSunV: sunV, uRingN: mulDir(cam.view, B.axis) });
      if (pl && pl.ring) jobs.push([pos, R, pl, type, B]);
      const near = type !== 8 && k < 0.35 && Math.abs(i - f) < 1.6;
      if (near) label([pos[0], R * 1.12, 0], tx(pl.ar, pl.en), `${R >= 10 ? R.toFixed(0) : R.toFixed(2)} × ${tx('الأرض', 'Earth')}`, `rgb(${pl.col.map((x) => Math.round(x * 255)).join(',')})`, true);
    });
    gl.depthMask(false);
    jobs.forEach(([pos, R, pl, type, B]) => {
      use(P.ring, { uVP: cam.vp, uCenter: pos, uA1: B.a1, uA2: B.a2, uR: R, uOut: pl.ring, uSun: light, uCam: cam.eye, uN: B.axis, uType: type, uStyle: S.planetStyle, uTint: pl.col });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
    const sunPos = [sunX - fx, 0, 0];
    if (k > 0.02) {
      corona(sunPos, 109 * 2.4, [1.0, 0.72, 0.38], 0.55 * k);
      label([sunPos[0], 109 * 1.08, 0], tx('الشمس', 'Sun'), `109 × ${tx('الأرض', 'Earth')} · ${tx('تتسع لـ 1.3 مليون أرض', 'holds 1.3 million Earths')}`, '#ffd38a', true);
      label([(SZX[0] + SZX[7]) / 2 - fx, 26, 0], tx('الكواكب الثمانية', 'The eight planets'), tx('بالمقياس الحقيقي', 'true to scale'), '#cfe0ff', true);
    }
    audio.tick = 0; audio.chirp = 0;
    const cur = k > 0.5 ? SZ[8] : SZ[Math.round(f)], cpl = E.PLANETS[cur[0]];
    facts = [['الجرم', 'Body', cur[0] === 8 ? tx('الشمس', 'Sun') : tx(cpl.ar, cpl.en)], ['القطر', 'Diameter', `${(cur[1] * 12742).toLocaleString('en-US', { maximumFractionDigits: 0 })} <small>km</small>`],
      ['مقارنة بالأرض', 'vs Earth', `× ${cur[1]}`], ['يتسع لـ', 'Could hold', `${Math.pow(cur[1], 3) >= 10 ? Math.round(Math.pow(cur[1], 3)).toLocaleString('en-US') : Math.pow(cur[1], 3).toFixed(2)} <small>${tx('أرض', 'Earths')}</small>`],
      ['المقياس', 'Scale', tx('حقيقي', 'true to size')], ['الترتيب', 'Order', `${k > 0.5 ? 9 : Math.round(f) + 1} / ${SZ.length}`]];
  }

  /* ═════════ cosmic symphony: black hole, pulsar, kilonova, worlds and spacetime in one scene ═════════ */
  const SY = { loop: 48, merge: 34, rs: 3.2, fabY: -26, L: 150 };
  const SYW = [[2, 1.6, 104, 31, 0.3], [3, 1.1, 118, 41, 2.4], [7, 2.2, 133, 55, 4.1], [4, 3.2, 148, 70, 1.2]];
  let syDip = false, syPhase = 0, syPulse = 0, syOrbit = 0, syTrails = [[], [], [], []];
  function symphony(c) {
    const T = st.t;
    if (T > SY.loop - 0.55 && !syDip) syDip = E.dip(() => { st.t = 0; syDip = false; syPhase = 0; syTrails = [[], [], [], []]; });
    const tt = T % SY.loop, au = sim.audio;
    cam.storyDist = 1 + 0.08 * Math.sin(T * 0.11);
    // pulsar on a 46-unit orbit, binary neutron stars on the far side, worlds further out
    const pa = T * TAU / 26 + 0.6, pul = [Math.cos(pa) * 46, 3 * Math.sin(pa * 2), Math.sin(pa) * 46];
    syPulse = (syPulse + c.dt * 1.25 * TAU) % TAU;
    const pax = [Math.sin(0.55) * Math.cos(syPulse), Math.cos(0.55), Math.sin(0.55) * Math.sin(syPulse)];
    const ba = T * TAU / 60 + 3.4, bc = [Math.cos(ba) * 78, 0, Math.sin(ba) * 78];
    const merged = tt >= SY.merge, tau = Math.min(tt / SY.merge, 1);
    const sep = merged ? 0 : Math.max(10 * Math.pow(1 - tau, 0.28), 1.0), om = Math.min(1.1 * Math.pow(10 / Math.max(sep, 1), 1.5), 18);
    syPhase += om * c.dt;
    const nA = [bc[0] + Math.cos(syPhase) * sep * 0.43, 0, bc[2] + Math.sin(syPhase) * sep * 0.43];
    const nB = [bc[0] - Math.cos(syPhase) * sep * 0.57, 0, bc[2] - Math.sin(syPhase) * sep * 0.57];
    const worlds = SYW.map(([type, R, r, per, p0]) => { const a = T * TAU / per + p0; return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
    // spacetime sheet below, with a well under every mass
    fabL = SY.L;
    const masses = [[0, 0, 360, 9], [pul[0], pul[2], 46, 3.2]];
    if (merged) masses.push([bc[0], bc[2], 70, 3.4]); else masses.push([nA[0], nA[2], 38, 2.8], [nB[0], nB[2], 32, 2.8]);
    SYW.forEach((w, i) => masses.push([worlds[i][0], worlds[i][2], 4 + w[1] * 3, 2 + w[1]]));
    setMasses(masses.slice(0, 9));
    const tm = tt - SY.merge;
    const wAmp = (merged ? 3.4 * Math.exp(-tm * 0.32) : 0.25 + 1.6 * tau * tau) + au * 1.4;
    const wave = [wAmp, clamp(om * 0.12, 0.16, 0.9), 2 * syPhase + (merged ? tm * 9 : 0), merged ? 2 : sep + 3];
    stateBodies(); stateGlow();
    drawFabric([0.42, 0.34, 1.0], wave, 0.85, { origin: [0, SY.fabY, 0], L: SY.L, spacing: 5.2, waveC: [bc[0], bc[2]] });
    // orbits and world trails
    drawPath(circle([0, 0, 0], X, Z, 46, 180), [0.55, 0.75, 1.0], 1.1 * c.pxScale, 0.22, { dash: 3 });
    SYW.forEach((w, i) => {
      drawPath(circle([0, 0, 0], X, Z, w[2], 220), [0.75, 0.8, 1.0], 1.0 * c.pxScale, 0.14);
      if (c.dt > 0) { syTrails[i].push(worlds[i]); if (syTrails[i].length > 90) syTrails[i].shift(); }
      drawPath(syTrails[i], [0.95, 0.85, 0.65], 2.0 * c.pxScale, 0.55, { fade: 1.4 });
    });
    // worlds (opaque, depth-tested) — lit by the accretion disc's glow at the centre
    stateBodies();
    const sunV = mulPoint(cam.view, [0, 40, 0]);
    SYW.forEach(([type, R], i) => drawBody(worlds[i], R, type, { uBasis: upBasis(), uSpin: T * 0.3 + i, uEmis: 1, uColor: E.PLANETS[type].col, uSunV: sunV, uRingN: mulDir(cam.view, Y) }));
    // the black hole: ray-marched, bends the light of everything behind it
    const cv = mulPoint(cam.view, [0, 0, 0]), z = Math.min(cv[2] + SY.rs * 13, -cam.near * 1.05), pr = cam.proj;
    const cz = pr[10] * z + pr[14], cw = pr[11] * z + pr[15], dep = cw > 0 ? clamp((cz / cw) * 0.5 + 0.5, 0, 1) : 1;
    use(P.bh, { uCam: cam.eye, uFwd: c.fwd, uRight: c.right, uUp: c.up, uTan: [cam.tanX, cam.tanY], uRs: SY.rs, uTime: (sim.realTime % 4000) + T * 0.3,
      uDiskIn: 3.0, uDiskOut: 11.5, uDepth: dep, uBoost: 1 + au * 0.8, uBound: 13.0 });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // glows: pulsar beams, neutron stars / kilonova
    gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    const toCam = v3.norm(v3.sub(cam.eye, pul)), flash = Math.pow(Math.abs(v3.dot(pax, toCam)), 46) * (1 + au * 1.5);
    use(pPulsar, { uCam: v3.sub(cam.eye, pul), uFwd: c.fwd, uRight: c.right, uUp: c.up, uTan: [cam.tanX, cam.tanY], uAxis: pax, uFlash: flash });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    if (!merged) {
      corona(nA, 9, [0.45, 0.85, 1.0], 1.3); corona(nB, 8, [1.0, 0.5, 0.85], 1.3);
      if (sep > 2.5) { drawPath(circle(bc, X, Z, sep * 0.43, 60), [0.5, 0.9, 1.0], 1.0 * c.pxScale, 0.3); drawPath(circle(bc, X, Z, sep * 0.57, 60), [1.0, 0.55, 0.9], 1.0 * c.pxScale, 0.3); }
    } else {
      const fl = Math.exp(-tm * 1.4);
      sprite(bc, 46, 0, [1.0, 0.95, 0.85], 9 * fl + 0.35);
      sprite(bc, 12 + tm * 5.5, 2, [0.5, 0.7, 1.0], 1.6 * Math.exp(-tm * 0.3), 0.82);
      sprite(bc, 9 + tm * 3.4, 2, [1.0, 0.45, 0.2], 2.0 * Math.exp(-tm * 0.25), 0.7);
      if (tm < 0.1) audio.boom = performance.now();
    }
    // labels
    label([0, SY.rs * 7, 0], tx('ثقب أسود', 'Black hole'), tx('يلوي الضوء والزمن', 'bends light and time'), '#ffcf8a', true);
    label(v3.add(pul, [0, 4, 0]), tx('النجم الطارق', 'Pulsar'), tx('منارة كونية', 'a cosmic lighthouse'), '#bfe0ff', true);
    if (merged) label(v3.add(bc, [0, 10, 0]), tx('كيلونوفا', 'Kilonova'), tx('ولادة الذهب', 'gold is born'), '#ffd27a', true);
    else label(v3.add(bc, [0, 6, 0]), tx('نجمان نيوترونيان', 'Neutron stars'), tx('يقتربان حلزونياً', 'spiralling in'), '#9fe8ff', true);
    SYW.forEach(([type], i) => label(worlds[i], tx(E.PLANETS[type].ar, E.PLANETS[type].en), '', `rgb(${E.PLANETS[type].col.map((x) => Math.round(x * 255)).join(',')})`));
    audio.tick = 1.25; audio.chirp = merged ? 0 : 0.03 + tau * 0.9;
    facts = [['المشهد', 'Scene', tx('خمس ظواهر معاً', 'five phenomena at once')], ['النابض', 'Pulsar', `1.25 <small>${tx('دورة/ث', 'rev/s')}</small>`],
      ['النجمان', 'Neutron stars', merged ? tx('اندمجا!', 'merged!') : `${(sep * 14).toFixed(0)} <small>km</small>`], ['أمواج الجاذبية', 'Grav. waves', `${Math.min(100, wAmp / 3.4 * 100).toFixed(0)}%`],
      ['العوالم', 'Worlds', '4'], ['تفاعل مع الصوت', 'Audio reactive', au > 0.02 ? `${(au * 100).toFixed(0)}%` : tx('ينتظر الصوت', 'waiting')]];
  }

  const SCENES = { pulsar, trappist, kilonova, threebody, ton618, symphony, sizes };
  let factsKey = '';
  window.OLX_STORIES = {
    audio,
    draw(id, c) {
      if (st.id !== id) { st.id = id; st.t = ST0; st.snap = ST0 > 0 ? 3 : 0; ST0 = 0; audio.tick = 0; audio.chirp = 0; }
      used = 0;
      SCENES[id](c);
      if (st.snap) { st.snap--; cam.logDist.snap(Math.log(E.SHOTS[E.shot()].dist * (cam.storyDist || 1))); }
      st.t += c.dt;
      endLabels();
      gl.depthMask(true); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    },
    seek(t) { st.t = t; st.snap = 2; },   // jump to a moment of the current story (testing, export)
    idle() { if (st.id) { st.id = ''; used = 0; endLabels(); audio.tick = 0; audio.chirp = 0; factsKey = ''; } },
    hud(id, grid, lang) {
      const html = facts.map((f) => `<div class="tv"><div class="l">${lang === 1 ? f[1] : lang === 2 ? f[0] + ' · ' + f[1] : f[0]}</div><div class="v">${f[2]}</div></div>`).join('');
      if (html !== factsKey) { factsKey = html; grid.innerHTML = html; }
    },
  };
})();
