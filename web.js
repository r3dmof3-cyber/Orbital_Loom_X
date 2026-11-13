/* Orbital Loom X — on-screen tools. The eye and sound also ship in the desktop wallpaper;
 * export, fullscreen and the settings panel are web-only (window.OLX_DESKTOP hides them).
 * © 2026 Yousif Anwar Alkmali (يوسف أنور الكمالي) — MIT License
 *
 * Toolbar · clean-view eye · procedural sound · PNG / video export · fullscreen.
 */
(() => {
  'use strict';
  const E = window.__olx;
  if (!E) return;
  const $ = (id) => document.getElementById(id);
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const toast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1900); };
  const shotId = () => E.SHOTS[E.shot()].id;
  const DESK = !!window.OLX_DESKTOP;

  /* ───────── toolbar ───────── */
  const tools = mk('div'); tools.id = 'tools'; document.body.appendChild(tools);
  const gear = $('gear'); if (gear) tools.appendChild(gear);
  const ICON = {
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.6A16.600 16.600 0 0 0 2 12s3.6 7 10 7a9.600 9.600 0 0 0 4-.9M9.9 9.900a3 3 0 0 0 4.200 4.200"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9.500l5 5M22 9.500l-5 5"/>',
    exp: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  };
  function tbtn(icon, title, fn) {
    const b = mk('button', 'tbtn', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</svg>`);
    b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
    tools.appendChild(b); return b;
  }
  const setIcon = (b, icon) => { b.firstChild.innerHTML = ICON[icon]; };

  /* ───────── eye: full → captions only → scene only ───────── */
  let clean = 0;
  const eyeBtn = tbtn('eye', 'إخفاء الأدوات · Hide the interface (V)', cycleClean);
  function cycleClean() {
    clean = (clean + 1) % 3;
    document.body.classList.toggle('clean1', clean === 1);
    document.body.classList.toggle('clean2', clean === 2);
    setIcon(eyeBtn, clean ? 'eyeOff' : 'eye');
    toast(['الواجهة كاملة · Full interface', 'الشرح فقط · Captions only', 'المشهد فقط · Scene only'][clean]);
  }
  let wakeT = 0;
  const wake = () => { document.body.classList.add('awake'); clearTimeout(wakeT); wakeT = setTimeout(() => document.body.classList.remove('awake'), 2600); };
  window.addEventListener('pointermove', wake, { passive: true }); window.addEventListener('pointerdown', wake, { passive: true });

  /* ───────── sound: everything is synthesised, no audio files ───────── */
  const A = { ctx: null, on: false, vol: 0.7 };
  const SCN = {
    vortex: [0.50, 0.10, 0.00, 55.0], side: [0.45, 0.14, 0.00, 61.7], galaxy: [0.40, 0.30, 0.05, 49.0], bh: [0.22, 0.10, 0.70, 41.2], helio: [0.30, 0.60, 0.00, 55.0],
    fabric: [0.55, 0.05, 0.25, 65.4], free: [0.50, 0.10, 0.00, 55.0], pulsar: [0.22, 0.14, 0.05, 61.7], trappist: [0.55, 0.08, 0.00, 73.4], kilonova: [0.28, 0.10, 0.30, 55.0],
    threebody: [0.20, 0.06, 0.80, 43.6], ton618: [0.14, 0.05, 1.00, 32.7], sizes: [0.55, 0.05, 0.00, 65.4],
  };
  function initAudio() {
    const C = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = C;
    A.master = C.createGain(); A.master.gain.value = 0; A.master.connect(C.destination);
    A.rec = C.createMediaStreamDestination(); A.master.connect(A.rec);
    const g = (v) => { const n = C.createGain(); n.gain.value = v; return n; };
    const osc = (type, f) => { const o = C.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    // drone: three partials through a slowly breathing low-pass
    A.lp = C.createBiquadFilter(); A.lp.type = 'lowpass'; A.lp.frequency.value = 380; A.lp.Q.value = 0.7;
    A.gDrone = g(0); A.lp.connect(A.gDrone); A.gDrone.connect(A.master);
    A.dr = [osc('sawtooth', 55), osc('sine', 82.5), osc('triangle', 110.3)];
    [0.16, 0.5, 0.22].forEach((v, i) => { const n = g(v); A.dr[i].connect(n); n.connect(A.lp); });
    const lfo = osc('sine', 0.06), lg = g(140); lfo.connect(lg); lg.connect(A.lp.frequency);
    // wind: looped noise through a wandering band-pass
    const len = C.sampleRate * 3, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    let b0 = 0; for (let i = 0; i < len; i++) { b0 = 0.985 * b0 + 0.15 * (Math.random() * 2 - 1); d[i] = b0; }
    A.noise = buf;
    const ns = C.createBufferSource(); ns.buffer = buf; ns.loop = true; ns.start();
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.5;
    A.gWind = g(0); ns.connect(bp); bp.connect(A.gWind); A.gWind.connect(A.master);
    const lfo2 = osc('sine', 0.09), lg2 = g(260); lfo2.connect(lg2); lg2.connect(bp.frequency);
    // rumble, chirp (inspiral) and tone (millisecond pulsars)
    A.gRumble = g(0); const r1 = osc('sine', 33), r2 = osc('sine', 49.7), r2g = g(0.4); r1.connect(A.gRumble); r2.connect(r2g); r2g.connect(A.gRumble); A.gRumble.connect(A.master);
    A.chirp = osc('sine', 40); A.gChirp = g(0); A.chirp.connect(A.gChirp); A.gChirp.connect(A.master);
    A.tone = osc('square', 716); const tl = C.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 1800; A.gTone = g(0); A.tone.connect(tl); tl.connect(A.gTone); A.gTone.connect(A.master);
    A.nextTick = 0; A.lastBoom = 0;
    setInterval(audioTick, 60);
  }
  function click(t) {
    const C = A.ctx, o = C.createOscillator(), n = C.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.02);
    n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(0.5, t + 0.002); n.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(n); n.connect(A.master); o.start(t); o.stop(t + 0.04);
  }
  function boom() {
    const C = A.ctx, t = C.currentTime, o = C.createOscillator(), n = C.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(24, t + 2.5);
    n.gain.setValueAtTime(0.9, t); n.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    o.connect(n); n.connect(A.master); o.start(t); o.stop(t + 4.1);
    const s = C.createBufferSource(), f = C.createBiquadFilter(), m = C.createGain(); s.buffer = A.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(120, t + 2.5);
    m.gain.setValueAtTime(1.2, t); m.gain.exponentialRampToValueAtTime(0.0001, t + 3); s.connect(f); f.connect(m); m.connect(A.master); s.start(t); s.stop(t + 3.1);
  }
  function audioTick() {
    if (!A.ctx) return;
    const C = A.ctx, t = C.currentTime, set = (p, v, k) => p.setTargetAtTime(v, t, k || 0.6);
    const p = SCN[shotId()] || SCN.vortex, f = E.fade(), live = A.on && !E.sim.paused ? 1 : 0;
    set(A.master.gain, A.on ? A.vol * 0.55 : 0, 0.25);
    set(A.gDrone.gain, p[0] * f * 0.6); set(A.gWind.gain, p[1] * f); set(A.gRumble.gain, p[2] * f * 0.5);
    [1, 1.5, 2.005].forEach((m, i) => set(A.dr[i].frequency, p[3] * m, 1.2));
    const s = (window.OLX_STORIES && window.OLX_STORIES.audio) || { tick: 0, chirp: 0, boom: 0 };
    const story = !!E.SHOTS[E.shot()].story;
    const hz = story ? s.tick : 0, ch = story ? s.chirp : 0;
    set(A.gTone.gain, hz > 60 ? 0.05 * live * f : 0, 0.08); if (hz > 60) set(A.tone.frequency, hz, 0.05);
    set(A.gChirp.gain, ch > 0 ? (0.05 + 0.3 * ch) * live * f : 0, 0.1); if (ch > 0) set(A.chirp.frequency, 36 + 760 * ch * ch * ch, 0.08);
    if (hz > 0 && hz <= 60 && live && f > 0.5) {
      if (A.nextTick < t) A.nextTick = t + 0.02;
      while (A.nextTick < t + 0.15) { click(A.nextTick); A.nextTick += 1 / hz; }
    }
    if (story && s.boom > A.lastBoom) { A.lastBoom = s.boom; if (live) boom(); }
  }
  const sndBtn = tbtn('mute', 'الصوت · Sound (M)', toggleSound);
  function toggleSound(force) {
    A.on = typeof force === 'boolean' ? force : !A.on;
    if (A.on && !A.ctx) { try { initAudio(); } catch (e) { A.on = false; toast('الصوت غير مدعوم · Audio not supported'); return; } }
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    setIcon(sndBtn, A.on ? 'sound' : 'mute'); sndBtn.classList.toggle('on', A.on);
    if (typeof force !== 'boolean') toast(A.on ? 'الصوت يعمل · Sound on' : 'الصوت متوقف · Sound off');
  }
  // the settings panel's volume slider arrives through the property listener
  const prevListener = window.livelyPropertyListener;
  window.livelyPropertyListener = function (name, val) {
    const on = val === true || val === 'true' || val === 'True' || val === 1 || val === '1';
    if (name === 'volume') { A.vol = Math.max(0, Math.min(1, Number(val) / 100)); return; }
    if (name === 'sound') { if (on !== A.on) toggleSound(on); return; }
    if (name === 'showTools') { tools.style.display = on ? '' : 'none'; return; }
    prevListener(name, val);
  };

  /* ───────── export: PNG snapshot or a narrated-by-captions video ───────── */
  const expBtn = tbtn('exp', 'تصدير صورة أو فيديو · Export image or video (E)', () => openExport(true));
  const fullBtn = tbtn('full', 'ملء الشاشة · Fullscreen (F)', toggleFull);
  if (DESK) { expBtn.remove(); fullBtn.remove(); }
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }

  const dlg = mk('div'); dlg.id = 'xdlg';
  const sceneIds = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13];
  dlg.innerHTML = `<div class="xbox" dir="rtl">
    <header><div class="set-title">تصدير <span>· Export</span></div><button type="button" class="set-x" data-x>✕</button></header>
    <div class="xrow"><label>النوع · Type</label><select id="xKind"><option value="video">فيديو · Video</option><option value="png">صورة PNG · Image</option></select></div>
    <div class="xrow"><label>الدقة · Resolution</label><select id="xRes"><option value="1080">1080p · Full HD</option><option value="1440">1440p · 2K</option><option value="2160">2160p · 4K</option></select></div>
    <div class="xrow"><label>الشكل · Shape</label><select id="xShape"><option value="16:9">أفقي 16:9 · Landscape</option><option value="9:16">عمودي 9:16 · Reel / Shorts</option><option value="1:1">مربع 1:1 · Square</option></select></div>
    <div class="xrow xv"><label>مدة كل مشهد · Seconds per scene</label><select id="xSecs"><option>6</option><option selected>10</option><option>15</option><option>25</option></select></div>
    <div class="xrow xv"><label>المشاهد · Scenes</label><div class="xscenes" id="xScenes"></div></div>
    <div class="xrow xchk"><label><input type="checkbox" id="xCaps" checked> الشرح والأسماء على الفيديو · Burn in captions and labels</label></div>
    <div class="xrow xchk xv"><label><input type="checkbox" id="xSnd" checked> مع الصوت · Include sound</label></div>
    <div class="xnote" id="xNote"></div>
    <footer><button type="button" class="xgo" id="xGo">ابدأ التصدير · Start export</button></footer>
  </div>
  <div class="xprog" id="xProg" hidden><div class="xbar"><i id="xBar"></i></div><div id="xMsg"></div><button type="button" class="set-reset" id="xStop">■ إيقاف وحفظ · Stop and save</button></div>`;
  document.body.appendChild(dlg);
  const scenesEl = $('xScenes');
  sceneIds.forEach((id) => { const l = mk('label', 'xsc', `<input type="checkbox" value="${id}"><span>${E.T.ar.modes[id]}</span>`); scenesEl.appendChild(l); });
  function openExport(open) {
    if (open) { const cur = E.shot(); scenesEl.querySelectorAll('input').forEach((i) => { i.checked = +i.value === cur; }); syncDlg(); }
    dlg.classList.toggle('open', open);
  }
  function syncDlg() {
    const video = $('xKind').value === 'video';
    dlg.querySelectorAll('.xv').forEach((e) => { e.style.display = video ? '' : 'none'; });
    const n = scenesEl.querySelectorAll('input:checked').length, secs = +$('xSecs').value;
    $('xNote').textContent = video ? `المدة التقريبية: ${n * secs} ثانية. يُسجَّل الفيديو بالزمن الحقيقي، فأبقِ هذه الصفحة ظاهرة. · About ${n * secs}s, recorded in real time: keep this tab visible.` : 'تُحفظ اللقطة الحالية بالدقة المختارة. · Saves the current view at the chosen resolution.';
  }
  dlg.addEventListener('change', syncDlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.hasAttribute('data-x')) openExport(false); });
  dlg.addEventListener('keydown', (e) => e.stopPropagation());

  const comp = document.createElement('canvas'), cx = comp.getContext('2d');
  function sizeFor() {
    const r = +$('xRes').value, sh = $('xShape').value, long = Math.round(r * 16 / 9 / 2) * 2;
    return sh === '16:9' ? [long, r] : sh === '9:16' ? [r, long] : [r, r];
  }
  function wrap(text, maxW) {
    const words = text.split(/\s+/), lines = []; let line = '';
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (cx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  const FONT = '"Segoe UI Variable Display","Segoe UI",Tahoma,"Noto Sans Arabic",sans-serif';
  function compose(caps) {
    const w = comp.width, h = comp.height, u = Math.min(w, h * 1.2) / 1080 * (h > w ? 1.4 : 1);
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.shadowBlur = 0;
    cx.drawImage(E.canvas, 0, 0, w, h);
    if (!caps) return;
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.shadowColor = '#000';
    // labels
    document.querySelectorAll('#labels .lbl').forEach((el) => {
      const n = el._n; if (!n || n.a < 0.06) return;
      const nE = el.querySelector('.n'), dE = el.querySelector('.d'), name = nE ? nE.textContent : el.textContent, sub = dE ? dE.textContent : ''; if (!name) return;
      const x = n.x * w, y = n.y * h; if (x < 0 || x > w || y < 0 || y > h) return;
      cx.globalAlpha = Math.min(1, n.a); cx.shadowBlur = 8 * u;
      cx.font = `600 ${15 * u}px ${FONT}`; cx.fillStyle = el.style.getPropertyValue('--c') || '#fff'; cx.textAlign = el.classList.contains('planet') ? 'left' : 'center';
      const ox = el.classList.contains('planet') ? 14 * u : 0, oy = el.classList.contains('planet') ? 4 * u : -14 * u;
      cx.fillText(name, x + ox, y + oy);
      if (sub) { cx.font = `${11.5 * u}px ${FONT}`; cx.fillStyle = 'rgba(225,232,248,.75)'; cx.fillText(sub, x + ox, y + oy + 15 * u); }
    });
    cx.globalAlpha = 1; cx.textAlign = 'center';
    // caption block
    const g = cx.createLinearGradient(0, h * 0.62, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)');
    cx.fillStyle = g; cx.fillRect(0, h * 0.62, w, h * 0.38);
    const desc = $('shotDesc'), en = desc.querySelector('.en'), ar = (desc.firstChild && desc.firstChild.nodeType === 3 ? desc.firstChild.textContent : desc.textContent) || '';
    const maxW = Math.min(w * 0.86, 1150 * u);
    cx.shadowBlur = 14 * u;
    cx.font = `${17 * u}px ${FONT}`; const enLines = en ? wrap(en.textContent, maxW) : [];
    cx.font = `${21 * u}px ${FONT}`; const arLines = wrap(ar, maxW);
    let y = h - 58 * u - enLines.length * 25 * u - arLines.length * 32 * u;
    cx.direction = 'rtl'; cx.font = `300 ${40 * u}px ${FONT}`; cx.fillStyle = '#fff'; cx.fillText($('shotName').textContent, w / 2, y - 22 * u);
    cx.font = `${21 * u}px ${FONT}`; cx.fillStyle = 'rgba(236,240,250,.94)';
    arLines.forEach((l) => { cx.fillText(l, w / 2, y + 18 * u); y += 32 * u; });
    cx.direction = 'ltr'; cx.font = `${17 * u}px ${FONT}`; cx.fillStyle = 'rgba(220,230,248,.7)';
    enLines.forEach((l) => { cx.fillText(l, w / 2, y + 16 * u); y += 25 * u; });
    cx.font = `${13.5 * u}px ${FONT}`; cx.fillStyle = 'rgba(245,185,74,.9)';
    cx.fillText('Orbital Loom X  ·  برمجة وتصميم: يوسف أنور الكمالي  ·  Yousif Anwar Alkmali', w / 2, h - 22 * u);
    cx.shadowBlur = 0;
  }
  function download(blob, ext) {
    const a = document.createElement('a'), d = new Date(), p = (n) => String(n).padStart(2, '0');
    a.href = URL.createObjectURL(blob); a.download = `orbital-loom-x_${shotId()}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let recording = null;
  async function startExport() {
    const [w, h] = sizeFor(), caps = $('xCaps').checked, kind = $('xKind').value;
    comp.width = w; comp.height = h;
    openExport(false);
    document.body.classList.add('exporting');
    E.setFixedSize([w, h]);
    try {
      if (kind === 'png') {
        E.renderNow(); compose(caps);
        const blob = await new Promise((r) => comp.toBlob(r, 'image/png'));
        download(blob, 'png'); toast(`حُفظت الصورة ${w}×${h} · Image saved`);
        return;
      }
      const ids = [...scenesEl.querySelectorAll('input:checked')].map((i) => +i.value); if (!ids.length) ids.push(E.shot());
      const secs = +$('xSecs').value, withSound = $('xSnd').checked;
      if (withSound) toggleSound(true);
      E.hooks.onFrame = () => compose(caps);
      const stream = comp.captureStream(60);
      if (withSound && A.rec) A.rec.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const mime = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
      if (!mime) { toast('تسجيل الفيديو غير مدعوم في هذا المتصفح · Video recording is not supported here'); return; }
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(w * h * 4) });
      const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise((r) => { rec.onstop = r; });
      recording = { stop: false };
      const prev = E.S.viewMode; $('xProg').hidden = false;
      E.selectMode(ids[0]); await wait(1300);
      rec.start(500);
      const total = ids.length * secs; let el = 0;
      for (let i = 0; i < ids.length && !recording.stop; i++) {
        if (i) E.selectMode(ids[i]);
        for (let t = 0; t < secs * 4 && !recording.stop; t++) { await wait(250); el += 0.25; $('xBar').style.width = (el / total * 100).toFixed(1) + '%'; $('xMsg').textContent = `${E.T.ar.modes[ids[i]]} · ${Math.ceil(total - el)}s`; }
      }
      rec.stop(); await done;
      download(new Blob(chunks, { type: mime.split(';')[0] }), mime.includes('mp4') ? 'mp4' : 'webm');
      toast('حُفظ الفيديو · Video saved');
      E.selectMode(prev);
    } catch (err) {
      console.error(err); toast('تعذّر التصدير · Export failed');
    } finally {
      E.hooks.onFrame = null; recording = null; $('xProg').hidden = true; $('xBar').style.width = '0';
      E.setFixedSize(null); document.body.classList.remove('exporting');
    }
  }
  $('xGo').addEventListener('click', startExport);
  $('xStop').addEventListener('click', () => { if (recording) recording.stop = true; });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'v') cycleClean(); else if (k === 'm') toggleSound(); else if (DESK) return; else if (k === 'f') toggleFull(); else if (k === 'e') openExport(!dlg.classList.contains('open'));
    else if (k === 'escape') openExport(false);
  });
  const url = new URLSearchParams(location.search);
  if (url.has('clean')) { clean = Math.max(0, Math.min(2, +url.get('clean'))) - 1; cycleClean(); }
  if (url.has('export') && !DESK) openExport(true);
  // a wallpaper host may start the audio context suspended until the first input: resume it then
  const resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  window.addEventListener('pointerdown', resume, { passive: true }); window.addEventListener('keydown', resume);
  window.OLX_WEB = { audio: A, toggleSound, openExport };
})();
