/* Orbital Loom X — in-page settings panel
 * © 2026 Yousif Anwar Alkmali (يوسف أنور الكمالي) — MIT License
 *
 * A gear button opens a settings drawer built from the same property list
 * Lively uses (props.js, generated from LivelyProperties.json), so every
 * option in Lively's "Customize" panel is also available when the wallpaper
 * runs in a normal browser. Changes go through window.livelyPropertyListener
 * exactly like Lively's own, and are remembered in this browser.
 */
(() => {
  'use strict';
  const PROPS = window.LIVELY_PROPS;
  const hostListener = window.livelyPropertyListener;
  if (!PROPS || typeof hostListener !== 'function') return;

  const STORE_KEY = 'olx-settings-v1';
  const $ = (id) => document.getElementById(id);

  // current raw value of every property (same units Lively sends)
  const PV = {};
  Object.keys(PROPS).forEach((k) => { PV[k] = PROPS[k].value; });

  const GROUPS = [
    { ar: 'المشهد والحركة', en: 'Scene & motion', keys: ['language', 'viewMode', 'directorStories', 'directorInterval', 'timeSpeed', 'sunVelocity', 'orbitModel', 'waveAmplitude', 'waveCount'] },
    { ar: 'المسارات والكواكب', en: 'Trails & planets', keys: ['trailLength', 'trailStyle', 'trailColor', 'planetStyle', 'planetScale'] },
    { ar: 'المظهر', en: 'Look', keys: ['accent', 'background', 'bloom', 'exposure', 'cinematicFx', 'heliosphere', 'showLabels', 'showDropLines', 'showExtinctions', 'showGalaxyGrid'] },
    { ar: 'الواجهة والتفاعل', en: 'Interface', keys: ['hudLayout', 'hudOpacity', 'showClock', 'showTools', 'sound', 'volume', 'audioReactive', 'mouseParallax'] },
    { ar: 'الأداء', en: 'Performance', keys: ['autoPerf', 'quality', 'renderScale', 'fpsLimit'] },
  ];
  const grouped = new Set(GROUPS.flatMap((g) => g.keys));
  const rest = Object.keys(PROPS).filter((k) => !grouped.has(k));
  if (rest.length) GROUPS.push({ ar: 'أخرى', en: 'Other', keys: rest });

  /* ── storage (wrapped: private mode / blocked storage must not break the page) ── */
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save() {
    const diff = {};
    Object.keys(PV).forEach((k) => { if (PROPS[k] && PV[k] !== PROPS[k].value) diff[k] = PV[k]; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) { /* ignore */ }
  }

  /* ── one entry point for every change: Lively, keyboard, mode buttons, this panel ── */
  function applyLocal(name, val) {
    PV[name] = val;
    if (name === 'showGear') gear.classList.toggle('off', !(val === true || val === 'true' || val === 1));
    if (name === 'language') setPanelDir();
  }
  window.livelyPropertyListener = function (name, val) {
    applyLocal(name, val);
    hostListener(name, val);
    if (panelOpen) syncControl(name);
  };
  window.addEventListener('olx:prop', (e) => {
    PV[e.detail.name] = e.detail.value;
    if (panelOpen) syncControl(e.detail.name);
  });
  function setFromPanel(name, val) {
    window.livelyPropertyListener(name, val);
    save();
  }

  /* ── DOM ── */
  const gear = document.createElement('button');
  gear.id = 'gear';
  gear.type = 'button';
  gear.title = 'الإعدادات · Settings';
  gear.setAttribute('aria-label', 'Settings');
  gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  document.body.appendChild(gear);

  const scrim = document.createElement('div');
  scrim.id = 'setScrim';
  document.body.appendChild(scrim);

  const panel = document.createElement('aside');
  panel.id = 'settings';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Settings');
  panel.innerHTML = `
    <header class="set-head">
      <div>
        <div class="set-title">الإعدادات <span>· Settings</span></div>
        <div class="set-sub">تُحفظ تلقائياً في هذا المتصفح · Saved in this browser</div>
      </div>
      <button type="button" class="set-x" aria-label="Close">✕</button>
    </header>
    <div class="set-body" id="setBody"></div>
    <footer class="set-foot">
      <button type="button" class="set-reset" id="setReset">↺ الافتراضي · Reset</button>
      <div class="set-credit">برمجة وتصميم: <b>يوسف أنور الكمالي</b> · Yousif Anwar Alkmali</div>
    </footer>`;
  document.body.appendChild(panel);

  const body = $('setBody');
  const controls = {};

  function label(text) {
    const i = text.indexOf(' / ');
    if (i < 0) return `<span class="lab-ar">${text}</span>`;
    return `<span class="lab-ar">${text.slice(0, i)}</span><span class="lab-en">${text.slice(i + 3)}</span>`;
  }
  function isOn(v) { return v === true || v === 'true' || v === 'True' || v === 1 || v === '1'; }
  function hex6(v) {
    const s = String(v || '').trim();
    return /^#[0-9a-f]{6}/i.test(s) ? s.slice(0, 7).toLowerCase() : '#f5b94a';
  }

  function buildControl(key) {
    const p = PROPS[key];
    const row = document.createElement('div');
    row.className = 'set-row t-' + p.type;
    let input;
    if (p.type === 'dropdown') {
      input = document.createElement('select');
      p.items.forEach((it, i) => { const o = document.createElement('option'); o.value = i; o.textContent = it; input.appendChild(o); });
      input.addEventListener('change', () => setFromPanel(key, +input.value));
      row.innerHTML = `<label class="set-lab">${label(p.text)}</label>`;
      row.appendChild(input);
    } else if (p.type === 'slider') {
      input = document.createElement('input');
      input.type = 'range'; input.min = p.min; input.max = p.max; input.step = p.step || 1;
      const out = document.createElement('output');
      row.innerHTML = `<label class="set-lab">${label(p.text)}</label>`;
      const line = document.createElement('div'); line.className = 'set-line';
      line.appendChild(input); line.appendChild(out); row.appendChild(line);
      input.addEventListener('input', () => { out.textContent = input.value; setFromPanel(key, +input.value); });
      input._out = out;
    } else if (p.type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      const sw = document.createElement('label'); sw.className = 'set-switch';
      sw.innerHTML = `<span class="set-lab">${label(p.text)}</span>`;
      const knob = document.createElement('span'); knob.className = 'knob';
      sw.prepend(input); sw.appendChild(knob); row.appendChild(sw);
      input.addEventListener('change', () => setFromPanel(key, input.checked));
    } else if (p.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      row.innerHTML = `<label class="set-lab">${label(p.text)}</label>`;
      const sw = document.createElement('div'); sw.className = 'set-colors';
      ['#f5b94a', '#7fdcff', '#b48cff', '#ff7a8a', '#7dffb5', '#ffffff'].forEach((c) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.style.background = c; b.title = c;
        b.addEventListener('click', () => { input.value = c; setFromPanel(key, c); });
        sw.appendChild(b);
      });
      sw.appendChild(input); row.appendChild(sw);
      input.addEventListener('input', () => setFromPanel(key, input.value));
    } else {
      return null;
    }
    input.id = 'set_' + key;
    controls[key] = input;
    return row;
  }

  function syncControl(key) {
    const c = controls[key], p = PROPS[key];
    if (!c || !p) return;
    const v = PV[key];
    if (p.type === 'checkbox') c.checked = isOn(v);
    else if (p.type === 'color') c.value = hex6(v);
    else { c.value = v; if (c._out) c._out.textContent = v; }
  }

  GROUPS.forEach((g) => {
    const sec = document.createElement('section');
    sec.className = 'set-sec';
    sec.innerHTML = `<h3>${g.ar} <span>· ${g.en}</span></h3>`;
    g.keys.forEach((k) => { if (PROPS[k]) { const r = buildControl(k); if (r) sec.appendChild(r); } });
    body.appendChild(sec);
  });

  /* ── open / close ── */
  let panelOpen = false;
  function setPanelDir() { panel.dir = Number(PV.language) === 1 ? 'ltr' : 'rtl'; }
  function open() {
    Object.keys(controls).forEach(syncControl);
    setPanelDir();
    panelOpen = true;
    document.body.classList.add('set-open');
  }
  function close() { panelOpen = false; document.body.classList.remove('set-open'); }
  gear.addEventListener('click', (e) => { e.stopPropagation(); panelOpen ? close() : open(); });
  scrim.addEventListener('click', close);
  panel.querySelector('.set-x').addEventListener('click', close);
  $('setReset').addEventListener('click', () => {
    Object.keys(PROPS).forEach((k) => { if (PV[k] !== PROPS[k].value) window.livelyPropertyListener(k, PROPS[k].value); });
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    Object.keys(controls).forEach(syncControl);
  });
  // keep the wallpaper's own shortcuts (0-7, arrows, space…) from firing while using the panel
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) close();
    else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) panelOpen ? close() : open();
  });

  /* ── restore this browser's saved choices (Lively, if present, sends its own values after) ── */
  const saved = loadSaved();
  const url = new URLSearchParams(location.search);
  const urlOwned = { viewMode: 'shot', language: 'lang', hudLayout: 'hud' }; // explicit URL params win
  Object.keys(saved).forEach((k) => {
    if (!PROPS[k] || (urlOwned[k] && url.has(urlOwned[k]))) return;
    window.livelyPropertyListener(k, saved[k]);
  });
  if (url.has('shot')) PV.viewMode = +url.get('shot');
  if (url.has('lang')) PV.language = +url.get('lang');
  if (url.has('hud')) PV.hudLayout = +url.get('hud');
  if (url.has('settings')) open(); // ?settings=1 opens the panel on load (handy for links & screenshots)
})();
