/* ════════════════════════════════════════════════════════════════════════
   ORBITAL LOOM X — Galactic Voyage
   WebGL2 cinematic wallpaper for Lively Wallpaper (Windows)
   · Analytic helical trails evaluated on the GPU (no history buffers → perfectly smooth, any length)
   · One continuous world: the Sun orbits the galactic centre with a vertical wave,
     planets orbit the Sun in the ecliptic (tilted 60.2° to the galactic plane)
   · HDR pipeline + dual-filter bloom + ACES tone-mapping
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapPI = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const URLP = new URLSearchParams(location.search);

/* ───────────────────────── settings (mirrors LivelyProperties.json) ───────────────────────── */
const S = {
  language: 2, viewMode: 0, directorInterval: 30, timeSpeed: 1, sunVelocity: 10, trailLength: 1,
  trailStyle: 0, trailColor: 0, orbitModel: 0, planetStyle: 0, planetScale: 1, waveAmplitude: 40, waveCount: 4,
  background: 0, quality: 1, renderScale: 1, fpsLimit: 1, bloom: 1, exposure: 1, cinematicFx: true,
  showLabels: true, showDropLines: true, showExtinctions: true, showGalaxyGrid: true, heliosphere: 0,
  hudLayout: 0, hudOpacity: 0.9, showClock: true, accent: '#F5B94A', audioReactive: true, mouseParallax: true,
};

/* ───────────────────────── world constants ───────────────────────── */
const RG = 600;                 // galactocentric radius of the Sun (world units)
const TILT = 60.2 * Math.PI / 180;
const COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT);
const THETA0 = 1.75;            // initial galactic longitude of the Sun
const PATTERN = 0.82;           // spiral-pattern speed relative to the Sun
const RS = 8;                   // Sgr A* Schwarzschild radius (world units, exaggerated)
const GAL_YEAR_MYR = 230;

const PLANETS = [
  { key: 'mercury', ar: 'عطارد',  en: 'Mercury', R: 3.0,  P: 0.2408, size: 0.30, col: [0.80, 0.76, 0.72], hAr: 'حلزون ضيق',      hEn: 'Tight helix',       obl: 0.03, spin: 0.10 },
  { key: 'venus',   ar: 'الزهرة', en: 'Venus',   R: 4.3,  P: 0.6152, size: 0.52, col: [1.00, 0.78, 0.42], hAr: 'حلزون ناعم',     hEn: 'Smooth helix',      obl: 177,  spin: -0.05 },
  { key: 'earth',   ar: 'الأرض',  en: 'Earth',   R: 5.7,  P: 1.0,    size: 0.55, col: [0.30, 0.62, 1.00], hAr: 'حلزون متوسط',    hEn: 'Medium helix',      obl: 23.4, spin: 0.30 },
  { key: 'mars',    ar: 'المريخ', en: 'Mars',    R: 7.3,  P: 1.881,  size: 0.40, col: [1.00, 0.38, 0.22], hAr: 'أعرض قليلاً',    hEn: 'Slightly wider',    obl: 25.2, spin: 0.29 },
  { key: 'jupiter', ar: 'المشتري',en: 'Jupiter', R: 11.2, P: 11.86,  size: 1.25, col: [1.00, 0.68, 0.40], hAr: 'حلزون عريض',     hEn: 'Wide helix',        obl: 3.1,  spin: 0.55 },
  { key: 'saturn',  ar: 'زحل',    en: 'Saturn',  R: 14.8, P: 29.46,  size: 1.05, col: [0.98, 0.86, 0.56], hAr: 'عريض جداً',      hEn: 'Very wide',         obl: 26.7, spin: 0.50, ring: 2.3 },
  { key: 'uranus',  ar: 'أورانوس',en: 'Uranus',  R: 18.4, P: 84.0,   size: 0.78, col: [0.48, 0.95, 0.95], hAr: 'عريض للغاية',    hEn: 'Extremely wide',    obl: 97.8, spin: -0.32, ring: 2.1 },
  { key: 'neptune', ar: 'نبتون',  en: 'Neptune', R: 21.8, P: 164.8,  size: 0.76, col: [0.36, 0.52, 1.00], hAr: 'الأكبر والأبطأ', hEn: 'Largest & slowest', obl: 28.3, spin: 0.36 },
];
const SUN_R = 1.7;

const EVENTS = [
  { myr: 443, ar: 'انقراض الأوردوفيشي', en: 'End-Ordovician extinction' },
  { myr: 372, ar: 'انقراض الديفوني المتأخر', en: 'Late Devonian extinction' },
  { myr: 252, ar: 'الموت العظيم (البرمي)', en: 'Great Dying (End-Permian)' },
  { myr: 201, ar: 'انقراض نهاية الترياسي', en: 'End-Triassic extinction' },
  { myr: 66,  ar: 'انقراض الديناصورات', en: 'K–Pg (dinosaurs)' },
];

/* frame: m = co-moving with the Sun's orbit, w = world, f = spacetime fabric plane */
const SHOTS = [
  null,
  { id: 'vortex',  tc: 0,    frame: 'm', yaw: 1.05, pitch: 0.36, dist: 66,   rate: 0.30, trail: 7,   gain: 1.0,  drift: 0.22, helio: 0, fabric: 0, grid: 0, ext: 0 },
  { id: 'side',    tc: 0,    frame: 'm', yaw: 1.42, pitch: 0.10, dist: 108,  rate: 0.38, trail: 15,  gain: 0.9,  drift: 0.10, helio: 0, fabric: 0, grid: 0, ext: 0 },
  { id: 'galaxy',  tc: 0.36, frame: 'm', yaw: 0.85, pitch: 0.50, dist: 2350, rate: 3.2,  trail: 140, gain: 0.24, drift: 0.12, helio: 0, fabric: 0, grid: 1, ext: 1 },
  { id: 'bh',      tc: 1,    frame: 'w', yaw: 0.30, pitch: 0.15, dist: 300,  rate: 0.9,  trail: 60,  gain: 0.5,  drift: 0.35, helio: 0, fabric: 0, grid: 0.5, ext: 0 },
  { id: 'helio',   tc: 0,    frame: 'm', yaw: 2.05, pitch: 0.30, dist: 330,  rate: 0.32, trail: 14,  gain: 0.45,  drift: 0.18, helio: 1, fabric: 0, grid: 0, ext: 0 },
  { id: 'fabric',  tc: 0,    frame: 'f', yaw: 0.50, pitch: 0.78, dist: 104,  rate: 0.22, trail: 3,   gain: 0.0,  drift: 0.20, helio: 0, fabric: 1, grid: 0, ext: 0 },
  { id: 'free',    tc: 0,    frame: 'm', yaw: 0.90, pitch: 0.35, dist: 90,   rate: 0.35, trail: 10,  gain: 1.0,  drift: 0.0,  helio: 0, fabric: 0, grid: 0, ext: 0 },
];
const DIRECTOR_ORDER = [1, 2, 5, 3, 4, 3, 6];

/* ───────────────────────── i18n ───────────────────────── */
const T = {
  ar: {
    subtitle: 'رحلة المجموعة الشمسية عبر مجرة درب التبانة',
    modes: ['المخرج السينمائي', 'الدوامة الحلزونية', 'المنظور الجانبي', 'الرحلة المجرية', 'الثقب الأسود A*', 'الغلاف الشمسي', 'نسيج الزمكان', 'كاميرا حرة'],
    shots: {
      vortex: ['الدوامة الحلزونية', 'الشمس لا تقف ساكنة؛ إنها تندفع بنحو 230 كم/ث حول مركز المجرة، فترسم الكواكب حولها لوالب ممتدة بدلاً من دوائر مغلقة.'],
      side: ['المنظور الجانبي', 'يميل مستوى مدارات الكواكب نحو 60° عن قرص المجرة، فيرسم كل كوكب لولباً يتسع كلما ابتعد عن الشمس وأبطأ في دورانه.'],
      galaxy: ['الرحلة المجرية', 'دورة كاملة حول درب التبانة تستغرق قرابة 230 مليون سنة، وتتمايل الشمس خلالها صعوداً وهبوطاً عبر قرص المجرة.'],
      bh: ['الرامي A* — قلب المجرة', 'ثقب أسود فائق الكتلة (~4.3 مليون كتلة شمسية) يلوي مسار الضوء، فيظهر قرص التراكم من خلفه ملتفاً فوقه وتحته.'],
      helio: ['فقاعة الغلاف الشمسي', 'تنفخ الرياح الشمسية فقاعة واقية تشقّ الوسط بين النجمي كمقدمة سفينة، تاركةً خلفها ذيلاً طويلاً.'],
      fabric: ['نسيج الزمكان', 'تمثيل تخيلي: كتلة الشمس تحني الزمكان فتصنع بئراً عميقاً، والكواكب في سقوط حر دائم حوله — وهذا هو المدار.'],
      free: ['الكاميرا الحرة', 'اسحب للتدوير • العجلة للتقريب • انقر على كوكب لتتبّعه • نقرتان لإعادة الضبط'],
      follow: ['تتبّع', 'تتبع الكاميرا الآن هذا الكوكب في مساره اللولبي — انقر في الفراغ أو اضغط Esc للعودة.'],
    },
    tele: 'قياسات الرحلة', speed: 'سرعة الشمس المدارية', height: 'الارتفاع عن قرص المجرة', gtime: 'الزمن المجري المنقضي',
    dist: 'المسافة المقطوعة', lon: 'الزاوية المجرية', years: 'سنوات مدارية (عرض)',
    ly: 'سنة ضوئية', kly: 'ألف س.ض', myr: 'مليون سنة', north: 'شمال', south: 'جنوب',
    sun: 'الشمس', sunD: '≈ 230 كم/ث حول المجرة', solar: 'المجموعة الشمسية', bh: 'الرامي A*', bhD: '4.3 مليون كتلة شمسية',
    dir: 'اتجاه حركة الشمس', today: 'الحاضر', ago: 'م.س مضت',
    toastPause: 'إيقاف الزمن', toastPlay: 'استئناف الزمن', toastHud: 'الواجهة', toastFollow: 'تتبع: ',
    days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  },
  en: {
    subtitle: 'The Solar System’s voyage through the Milky Way',
    modes: ['Cinematic Director', 'Helical Vortex', 'Side Profile', 'Galactic Voyage', 'Black Hole A*', 'Heliosphere', 'Spacetime Fabric', 'Free Camera'],
    shots: {
      vortex: ['Helical Vortex', 'The Sun is never still: racing ~230 km/s around the galactic centre, it drags every planet into a stretched helix instead of a closed loop.'],
      side: ['Side Profile', 'The planets’ orbital plane is tilted ~60° to the galactic disc, so each world traces a helix that widens with distance and slower orbits.'],
      galaxy: ['Galactic Voyage', 'One lap around the Milky Way takes ~230 million years, while the Sun bobs up and down through the galactic disc.'],
      bh: ['Sagittarius A*', 'A supermassive black hole (~4.3 million suns) bends light so strongly that the far side of its accretion disc arcs over and under it.'],
      helio: ['The Heliosphere', 'The solar wind inflates a protective bubble that ploughs through the interstellar medium like a bow, trailing a long heliotail.'],
      fabric: ['Spacetime Fabric', 'An illustrative embedding: the Sun’s mass curves spacetime into a deep well — the planets are in endless free fall around it. That is an orbit.'],
      free: ['Free Camera', 'Drag to orbit • Wheel to zoom • Click a planet to follow • Double-click to reset'],
      follow: ['Following', 'The camera now rides this planet along its helix — click empty space or press Esc to return.'],
    },
    tele: 'Voyage telemetry', speed: 'Solar orbital speed', height: 'Height above disc', gtime: 'Galactic time elapsed',
    dist: 'Distance travelled', lon: 'Galactic angle', years: 'Orbital years (display)',
    ly: 'ly', kly: 'k ly', myr: 'Myr', north: 'N', south: 'S',
    sun: 'Sun', sunD: '≈ 230 km/s around the galaxy', solar: 'Solar System', bh: 'Sagittarius A*', bhD: '4.3 million solar masses',
    dir: 'Direction of Sun’s motion', today: 'Present day', ago: 'Myr ago',
    toastPause: 'Time paused', toastPlay: 'Time resumed', toastHud: 'HUD', toastFollow: 'Following: ',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};
const L = () => (S.language === 1 ? T.en : T.ar);
const bi = () => S.language === 2;

/* ───────────────────────── WebGL setup ───────────────────────── */
const canvas = $('gl');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: URLP.has('capture') });
if (!gl) { $('fallback').hidden = false; $('hud').style.display = 'none'; return; }
const HAS_FLOAT = !!gl.getExtension('EXT_color_buffer_float');
const HDR_FMT = HAS_FLOAT ? { internal: gl.RGBA16F, type: gl.HALF_FLOAT } : { internal: gl.RGBA8, type: gl.UNSIGNED_BYTE };

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error(log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    throw new Error('Shader compile failed: ' + log);
  }
  return sh;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  return { p, u };
}
function use(prog, vals) {
  gl.useProgram(prog.p);
  for (const k in vals) {
    const u = prog.u[k]; if (!u) continue;
    const v = vals[k];
    switch (u.type) {
      case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      default: gl.uniform1i(u.loc, v);
    }
  }
}

const SH = window.SH;
const P = {
  nebgen: program(SH.VS_FULL, SH.FS_NEBGEN),
  sky: program(SH.VS_FULL, SH.FS_SKY),
  skyStars: program(SH.VS_SKYSTARS, SH.FS_POINT),
  galaxy: program(SH.VS_GALAXY, SH.FS_GALAXY),
  bh: program(SH.VS_FULL, SH.FS_BH),
  body: program(SH.VS_BILL, SH.FS_BODY),
  corona: program(SH.VS_BILL, SH.FS_CORONA),
  ring: program(SH.VS_RING, SH.FS_RING),
  trail: program(SH.VS_TRAIL, SH.FS_TRAIL),
  drop: program(SH.VS_DROP, SH.FS_DROP),
  plane: program(SH.VS_PLANE, SH.FS_PLANE),
  helio: program(SH.VS_HELIO, SH.FS_HELIO),
  ism: program(SH.VS_ISM, SH.FS_ISM),
  fabric: program(SH.VS_FABRIC, SH.FS_FABRIC),
  pre: program(SH.VS_FULL, SH.FS_PRE),
  down: program(SH.VS_FULL, SH.FS_DOWN),
  up: program(SH.VS_FULL, SH.FS_UP),
  comp: program(SH.VS_FULL, SH.FS_COMP),
};
const emptyVAO = gl.createVertexArray();

/* deterministic RNG */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeGauss(rnd) { return () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); }; }

function makeVAO(attribs) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  attribs.forEach(([loc, data, size]) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  });
  gl.bindVertexArray(null);
  return vao;
}

/* ── background stars ── */
const sky = (() => {
  const N = 7500, rnd = mulberry32(77);
  const dir = new Float32Array(N * 3), col = new Float32Array(N * 3), par = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const z = rnd() * 2 - 1, a = rnd() * TAU, r = Math.sqrt(1 - z * z);
    dir.set([r * Math.cos(a), z, r * Math.sin(a)], i * 3);
    const t = rnd(), mag = Math.pow(rnd(), 5.0);
    const c = t < 0.25 ? [0.65, 0.78, 1.0] : t < 0.7 ? [1.0, 0.97, 0.92] : t < 0.9 ? [1.0, 0.85, 0.62] : [1.0, 0.65, 0.48];
    const br = 0.12 + mag * 1.6;
    col.set([c[0] * br, c[1] * br, c[2] * br], i * 3);
    par.set([1.4 + mag * 3.2, rnd()], i * 2);
  }
  return { vao: makeVAO([[0, dir, 3], [1, col, 3], [2, par, 2]]), count: N };
})();

/* ── the Milky Way ── */
let galaxy = null;
function buildGalaxy() {
  const counts = [70000, 150000, 260000, 400000];
  const N = counts[S.quality] || 150000;
  const rnd = mulberry32(2026), g = makeGauss(rnd);
  const nGlow = Math.floor(N * 0.035), nDust = Math.floor(N * 0.03), nLocal = 3200;
  const total = N + nGlow + nLocal + nDust;
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3), par = new Float32Array(total * 4);
  const B = 1 / Math.tan(12.5 * Math.PI / 180), R0 = 130;
  const armAngle = (r, off) => off - B * Math.log(Math.max(r, R0) / R0);
  const arms = [0, Math.PI, Math.PI / 2, Math.PI * 1.5];
  const pickArm = () => { const x = rnd(); return x < 0.34 ? 0 : x < 0.68 ? 1 : x < 0.84 ? 2 : 3; };
  let k = 0;
  const put = (x, y, z, c, size, alpha, kind) => {
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    par[k * 4] = size; par[k * 4 + 1] = alpha; par[k * 4 + 2] = rnd(); par[k * 4 + 3] = kind; k++;
  };
  const expoR = (scale, min, max) => { let r; do { r = min - Math.log(1 - rnd()) * scale; } while (r > max); return r; };
  const barAng = 0.45;
  for (let i = 0; i < N; i++) {
    const t = rnd();
    if (t < 0.13) {                       // bulge
      const r = Math.abs(g()) * 70 + 4, ph = rnd() * TAU, z = rnd() * 2 - 1, s = Math.sqrt(1 - z * z);
      const w = rnd();
      put(Math.cos(ph) * s * r, z * r * 0.55, Math.sin(ph) * s * r, w < 0.6 ? [1.0, 0.80, 0.52] : [1.0, 0.68, 0.42], 1.5, 0.28 + rnd() * 0.3, 0);
    } else if (t < 0.21) {                // bar
      const x = g() * 150, z = g() * 38, y = g() * 18;
      const c = Math.cos(barAng), s = Math.sin(barAng);
      put(x * c - z * s, y, x * s + z * c, [1.0, 0.82, 0.58], 1.5, 0.5 + rnd() * 0.4, 0);
    } else if (t < 0.80) {                // spiral arms
      const a = pickArm(), major = a < 2;
      const r = expoR(430, R0 * 0.9, 1600);
      const spread = (major ? 0.16 : 0.24) * (0.7 + r / 1400);
      const th = armAngle(r, arms[a]) + g() * spread;
      const jitter = 6 + r * 0.018;
      const x = Math.cos(th) * r + g() * jitter, z = Math.sin(th) * r + g() * jitter;
      const y = g() * (4 + r * 0.011);
      const u = rnd();
      let c, size = 1.5, al = 0.55 + rnd() * 0.6;
      if (u < 0.035) { c = [1.0, 0.35, 0.58]; size = 3.2; al = 0.9; }        // HII regions
      else if (u < 0.55) c = [0.62, 0.76, 1.0];
      else if (u < 0.85) c = [0.95, 0.95, 1.0];
      else c = [1.0, 0.86, 0.66];
      put(x, y, z, c, size, al, 0);
    } else {                              // thin disc field
      const r = expoR(420, 60, 1650), th = rnd() * TAU;
      put(Math.cos(th) * r, g() * (6 + r * 0.012), Math.sin(th) * r, rnd() < 0.5 ? [1.0, 0.88, 0.72] : [0.85, 0.88, 1.0], 1.35, 0.3 + rnd() * 0.35, 0);
    }
  }
  // Solar neighbourhood (Orion spur) — gives parallax in close shots
  const sx = Math.cos(THETA0) * RG, sz = Math.sin(THETA0) * RG;
  for (let i = 0; i < nLocal; i++) {
    const u = rnd();
    put(sx + g() * 95, g() * 30, sz + g() * 95, u < 0.4 ? [0.7, 0.8, 1.0] : u < 0.8 ? [1.0, 0.96, 0.9] : [1.0, 0.75, 0.5], 1.2, 0.5 + rnd() * 0.7, 0);
  }
  // diffuse glow sprites (gas + unresolved starlight)
  for (let i = 0; i < nGlow; i++) {
    const t = rnd();
    if (t < 0.22) {
      const r = Math.abs(g()) * 85, ph = rnd() * TAU;
      put(Math.cos(ph) * r, g() * 22, Math.sin(ph) * r, [1.0, 0.62, 0.30], 70 + rnd() * 70, 0.03, 1);
    } else {
      const a = pickArm(), r = expoR(450, R0, 1500), th = armAngle(r, arms[a]) + g() * 0.14;
      const u = rnd();
      const c = u < 0.55 ? [0.36, 0.45, 1.0] : u < 0.8 ? [0.62, 0.36, 0.95] : [1.0, 0.36, 0.55];
      put(Math.cos(th) * r + g() * 20, g() * 8, Math.sin(th) * r + g() * 20, c, 45 + rnd() * 60, 0.035 + rnd() * 0.02, 1);
    }
  }
  const nAdd = k;
  // dust lanes on the inner (trailing) edge of the arms
  for (let i = 0; i < nDust; i++) {
    const a = rnd() < 0.7 ? (rnd() < 0.5 ? 0 : 1) : (rnd() < 0.5 ? 2 : 3);
    const r = expoR(380, 170, 1300), th = armAngle(r, arms[a]) - 0.13 + g() * 0.05;
    put(Math.cos(th) * r + g() * 9, g() * 3, Math.sin(th) * r + g() * 9, [0, 0, 0], 12 + rnd() * 16, 0.07 + rnd() * 0.07, 2);
  }
  if (galaxy) gl.deleteVertexArray(galaxy.vao);
  galaxy = { vao: makeVAO([[0, pos, 3], [1, col, 3], [2, par, 4]]), nAdd, nDust: k - nAdd };
}
buildGalaxy();

/* ── unit sphere mesh for the heliosphere ── */
const helioMesh = (() => {
  const SEG = 96, RINGS = 64, v = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const th = i / RINGS * Math.PI;
    for (let j = 0; j <= SEG; j++) { const ph = j / SEG * TAU; v.push(Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)); }
  }
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
    const a = i * (SEG + 1) + j, b = a + SEG + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const vao = makeVAO([[0, new Float32Array(v), 3]]);
  gl.bindVertexArray(vao);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();

/* ── grid mesh for the spacetime fabric ── */
const fabricMesh = (() => {
  const N = 200, v = [], idx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) v.push(j / N * 2 - 1, i / N * 2 - 1);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const vao = makeVAO([[0, new Float32Array(v), 2]]);
  gl.bindVertexArray(vao);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
})();

/* ── render targets ── */
function makeTarget(w, h, depth) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, HDR_FMT.internal, w, h, 0, gl.RGBA, HDR_FMT.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  let rb = null;
  if (depth) {
    rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, rb, w, h };
}
function freeTarget(t) { if (!t) return; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); if (t.rb) gl.deleteRenderbuffer(t.rb); }

/* nebula equirect texture, generated once on the GPU */
const nebula = (() => {
  const t = makeTarget(1536, 768, false);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.w, t.h);
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  gl.bindVertexArray(emptyVAO); use(P.nebgen, {}); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return t;
})();

let W = 1, Hh = 1, pxScale = 1, scene = null, bloom = [];
function resize() {
  document.documentElement.style.setProperty('--s', clamp(window.innerHeight / 1080, 0.7, 2.2).toFixed(3));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(window.innerWidth * dpr * S.renderScale));
  const h = Math.max(2, Math.round(window.innerHeight * dpr * S.renderScale));
  if (w === W && h === Hh && scene) return;
  W = w; Hh = h; canvas.width = w; canvas.height = h;
  pxScale = h / 1080;
  freeTarget(scene); bloom.forEach(freeTarget); bloom = [];
  scene = makeTarget(w, h, true);
  let bw = w >> 1, bh = h >> 1;
  for (let i = 0; i < 7 && bw >= 8 && bh >= 8; i++) { bloom.push(makeTarget(bw, bh, false)); bw >>= 1; bh >>= 1; }
}

/* ───────────────────────── math ───────────────────────── */
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf; return o;
}
function lookAt(eye, c, up) {
  const z = v3.norm(v3.sub(eye, c)), x = v3.norm(v3.cross(up, z)), y = v3.cross(z, x);
  const o = new Float32Array(16);
  o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[8] = x[2]; o[9] = y[2]; o[10] = z[2];
  o[12] = -v3.dot(x, eye); o[13] = -v3.dot(y, eye); o[14] = -v3.dot(z, eye); o[15] = 1;
  return { m: o, x, y, z };
}
function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
  }
  return o;
}
function project(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w <= 0.01) return null;
  return { x: (x / w * 0.5 + 0.5) * window.innerWidth, y: (0.5 - y / w * 0.5) * window.innerHeight, w };
}

/* ───────────────────────── simulation state ───────────────────────── */
const sim = {
  T: 0, theta: THETA0, thetaU: THETA0, galRot: 0, phases: PLANETS.map((p, i) => i * 2.399 + 0.6),
  paused: false, audio: 0, audioT: 0, realTime: 0, scrollY: 0,
};
const omega = () => S.sunVelocity / RG;
const periodOf = (p) => (S.orbitModel === 1 ? p.P : Math.pow(p.P, 0.65));
const wOf = (p) => TAU / periodOf(p);

function frameAt(theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const amp = S.waveAmplitude, K = S.waveCount;
  const Sun = [RG * c, amp * Math.sin(K * theta), RG * s];
  const r = [c, 0, s], t = [-s, 0, c];
  const e2 = [-s * COS_T, SIN_T, c * COS_T];
  const n = v3.cross(r, e2);                       // ecliptic normal
  const nF = [-t[0] * SIN_T, COS_T, -t[2] * SIN_T]; // fabric "up"
  const m = v3.norm([-RG * s, amp * K * Math.cos(K * theta), RG * c]);
  return { Sun, r, t, e2, n, nF, m };
}

/* ───────────────────────── camera (critically-damped springs) ───────────────────────── */
class Spring {
  constructor(x) { this.x = x; this.v = 0; }
  step(target, dt, w, wrap) {
    let d = target - this.x; if (wrap) d = wrapPI(d);
    const a = w * w * d - 2 * w * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
  snap(x) { this.x = x; this.v = 0; }
}
const cam = {
  yaw: new Spring(0.62), pitch: new Spring(0.3), logDist: new Spring(Math.log(58)), tc: new Spring(0), follow: new Spring(0),
  wM: 1, wW: 0, wF: 0, followIdx: -1, lastFollow: 2,
  userYaw: 0, userPitch: 0, zoom: 0, idle: 99, hoverX: 0, hoverY: 0, pX: 0, pY: 0,
  rate: 0.3, trail: 7, gain: 1, helio: 0, fabric: 0, grid: 0, ext: 0, labels: 1,
  view: null, proj: null, vp: null, eye: [0, 0, 0], basis: null, focal: 1, tanX: 1, tanY: 1, near: 0.1,
};
let activeShot = 1, directorIdx = 0, shotTimer = 0;

function currentShotId() { return S.viewMode === 0 ? DIRECTOR_ORDER[directorIdx % DIRECTOR_ORDER.length] : S.viewMode; }
function setShot(id, instant) {
  activeShot = id; shotTimer = 0;
  cam.userYaw *= 0.0; cam.userPitch = 0; cam.zoom = 0;
  updateCaption(true);
  updateModeButtons();
  if (instant) {
    const s = SHOTS[id];
    cam.pitch.snap(s.pitch); cam.logDist.snap(Math.log(s.dist)); cam.tc.snap(s.tc);
    cam.wM = s.frame === 'm' ? 1 : 0; cam.wW = s.frame === 'w' ? 1 : 0; cam.wF = s.frame === 'f' ? 1 : 0;
    cam.rate = s.rate; cam.trail = s.trail; cam.gain = s.gain; cam.helio = s.helio; cam.fabric = s.fabric; cam.grid = s.grid; cam.ext = s.ext;
    cam.yaw.snap(s.yaw);
  }
}

function expK(dt, rate) { return 1 - Math.exp(-dt * rate); }

function updateSim(dt) {
  // director
  if (S.viewMode === 0 && cam.followIdx < 0) {
    shotTimer += dt;
    if (shotTimer > S.directorInterval) { directorIdx = (directorIdx + 1) % DIRECTOR_ORDER.length; setShot(DIRECTOR_ORDER[directorIdx]); }
  } else shotTimer += dt;
  const shot = SHOTS[activeShot];

  // smoothed scene parameters
  const k = expK(dt, 0.9);
  const rateTarget = shot.rate * S.timeSpeed * (cam.followIdx >= 0 ? 0.6 : 1);
  cam.rate = Math.exp(lerp(Math.log(cam.rate), Math.log(rateTarget), expK(dt, 0.7)));
  cam.trail = Math.exp(lerp(Math.log(cam.trail), Math.log(shot.trail * S.trailLength), expK(dt, 0.55)));
  cam.gain = lerp(cam.gain, shot.gain, k);
  cam.helio = lerp(cam.helio, S.heliosphere === 1 ? 1 : S.heliosphere === 2 ? 0 : shot.helio, k);
  cam.fabric = lerp(cam.fabric, shot.fabric, k);
  cam.grid = lerp(cam.grid, S.showGalaxyGrid ? shot.grid : 0, k);
  cam.ext = lerp(cam.ext, S.showExtinctions ? shot.ext : 0, k);
  cam.wM = lerp(cam.wM, shot.frame === 'm' ? 1 : 0, k);
  cam.wW = lerp(cam.wW, shot.frame === 'w' ? 1 : 0, k);
  cam.wF = lerp(cam.wF, shot.frame === 'f' ? 1 : 0, k);

  // advance time
  const sdt = sim.paused ? 0 : dt * cam.rate;
  const om = omega();
  sim.T += sdt;
  sim.theta = (sim.theta + om * sdt) % TAU;
  sim.thetaU += om * sdt;
  sim.galRot = (sim.galRot + om * PATTERN * sdt) % TAU;
  PLANETS.forEach((p, i) => { sim.phases[i] = (sim.phases[i] + wOf(p) * sdt) % TAU; });
  sim.scrollY = (sim.scrollY + S.sunVelocity * COS_T * sdt) % 1000;
  sim.realTime += dt;
  sim.audio = lerp(sim.audio, S.audioReactive ? sim.audioT : 0, expK(dt, 10));

  // camera
  cam.idle += dt;
  if (cam.idle > 6 && S.viewMode !== 7) {
    const d = expK(dt, 0.25);
    cam.userYaw *= 1 - d; cam.userPitch *= 1 - d; cam.zoom *= 1 - d;
  }
  cam.pX = lerp(cam.pX, S.mouseParallax ? cam.hoverX : 0, expK(dt, 2));
  cam.pY = lerp(cam.pY, S.mouseParallax ? cam.hoverY : 0, expK(dt, 2));
  const drift = Math.sin(sim.realTime * 0.045) * shot.drift + (shot.frame === 'w' ? sim.realTime * 0.02 : 0);
  const yawT = shot.yaw + drift + cam.userYaw + cam.pX * 0.12;
  const pitchT = clamp(shot.pitch + cam.userPitch - cam.pY * 0.06, -1.35, 1.35);
  const following = cam.followIdx >= 0;
  let distT = shot.dist;
  if (following) distT = Math.max(PLANETS[cam.followIdx].size * S.planetScale * 14, PLANETS[cam.followIdx].R * 1.4 + 8);
  distT *= Math.exp(cam.zoom);
  cam.yaw.step(yawT, dt, 1.25, true);
  cam.pitch.step(pitchT, dt, 1.25);
  cam.logDist.step(Math.log(distT), dt, 1.05);
  cam.tc.step(following ? 0 : shot.tc, dt, 1.0);
  cam.follow.step(following ? 1 : 0, dt, 1.4);
}

function planetRenderPos(i, F) {
  const p = PLANETS[i], ph = sim.phases[i];
  const q = [p.R * Math.cos(ph), p.R * Math.sin(ph)];
  let pos = v3.add(F.Sun, v3.add(v3.mul(F.r, q[0]), v3.mul(F.e2, q[1])));
  if (cam.fabric > 0.001) pos = v3.sub(pos, v3.mul(F.nF, fabricDepth(q) * cam.fabric));
  return pos;
}
const FAB_L = 62;
function fabricMasses() {
  const m = [0, 0, 120, 3.6];
  PLANETS.forEach((p, i) => { const ph = sim.phases[i]; m.push(p.R * Math.cos(ph), p.R * Math.sin(ph), 1.5 + p.size * 5, 0.6 + p.size * 1.4); });
  return m;
}
let fabM = fabricMasses();
function fabricWell(q) { let d = 0; for (let i = 0; i < 9; i++) { const dx = q[0] - fabM[i * 4], dy = q[1] - fabM[i * 4 + 1]; d += fabM[i * 4 + 2] / Math.sqrt(dx * dx + dy * dy + fabM[i * 4 + 3] ** 2); } return d; }
function fabricDepth(q) { return Math.max(fabricWell(q) - fabricWell([FAB_L, 0]), 0); }

function computeCamera(F) {
  fabM = fabricMasses();
  // in the fabric view aim at the middle of the well so the rim and the Sun at its throat are both framed
  const sunR = v3.sub(F.Sun, v3.mul(F.nF, fabricDepth([0, 0]) * cam.fabric * 0.55));
  let target = v3.lerp(sunR, [0, 0, 0], clamp(cam.tc.x, 0, 1));
  if (cam.followIdx >= 0 || cam.follow.x > 0.001) {
    const idx = cam.followIdx >= 0 ? cam.followIdx : cam.lastFollow;
    target = v3.lerp(target, planetRenderPos(idx, F), clamp(cam.follow.x, 0, 1));
  }
  // blended reference frame
  const fr = [
    { w: cam.wM, X: v3.mul(F.t, -1), U: [0, 1, 0] },
    { w: cam.wW, X: [1, 0, 0], U: [0, 1, 0] },
    { w: cam.wF, X: v3.mul(F.e2, -1), U: F.nF },
  ];
  let X = [0, 0, 0], U = [0, 0, 0];
  fr.forEach((f) => { X = v3.add(X, v3.mul(f.X, f.w)); U = v3.add(U, v3.mul(f.U, f.w)); });
  U = v3.norm(U);
  X = v3.norm(v3.sub(X, v3.mul(U, v3.dot(X, U))));
  const Z = v3.cross(X, U);
  const y = cam.yaw.x, p = cam.pitch.x, d = Math.exp(cam.logDist.x);
  const dir = v3.add(v3.add(v3.mul(X, Math.cos(p) * Math.cos(y)), v3.mul(Z, Math.cos(p) * Math.sin(y))), v3.mul(U, Math.sin(p)));
  const eye = v3.add(target, v3.mul(dir, d));
  const la = lookAt(eye, target, U);
  const fov = 50 * Math.PI / 180, aspect = W / Hh;
  const near = clamp(d * 0.004, 0.03, 6), far = d * 6 + 7000;
  cam.view = la.m; cam.proj = perspective(fov, aspect, near, far); cam.vp = mat4mul(cam.proj, cam.view);
  cam.eye = eye; cam.basis = la; cam.near = near; cam.dist = d; cam.target = target;
  cam.tanY = Math.tan(fov / 2); cam.tanX = cam.tanY * aspect; cam.focal = Hh / (2 * cam.tanY);
}

/* ───────────────────────── rendering ───────────────────────── */
function hexToRgb(h) { const n = parseInt(String(h).replace('#', '').slice(0, 6), 16) || 0xf5b94a; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function hsl(h, s, l) { const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
function trailColor(i) {
  if (S.trailColor === 1) return hsl(i / 8 * 0.85, 0.9, 0.6);
  if (S.trailColor === 2) { const a = hexToRgb(S.accent); return v3.lerp(a, [1, 1, 1], i / 14); }
  return PLANETS[i].col;
}

function pathUniforms(F) {
  return { uTheta: sim.theta, uOmega: omega(), uRg: RG, uAmp: S.waveAmplitude, uK: S.waveCount, uCosT: COS_T, uSinT: SIN_T };
}

function drawTrail(base, extra, segs) {
  use(P.trail, Object.assign({}, base, extra, { uSegs: segs }));
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, segs);
}

function bodyBasis(i, F) {
  const p = PLANETS[i], o = p.obl * Math.PI / 180;
  const axis = v3.norm(v3.sub(v3.mul(F.n, Math.cos(o)), v3.mul(F.e2, Math.sin(o))));
  const a1 = v3.norm(v3.sub(F.r, v3.mul(axis, v3.dot(F.r, axis))));
  const a2 = v3.cross(axis, a1);
  return { a1, a2, axis };
}

function drawBody(center, R, type, extra) {
  const d = v3.len(v3.sub(center, cam.eye));
  if (d <= R * 1.02) return 0;
  const pxR = R * cam.focal / d;
  if (pxR < 0.35) return pxR;
  const q = R * d / Math.sqrt(Math.max(d * d - R * R, 1e-6)) * 1.06 + 2.5 * d / cam.focal;
  const cv = mulPoint(cam.view, center);
  use(P.body, Object.assign({
    uView: cam.view, uProj: cam.proj, uCenter: center, uQuad: q, uCenterV: cv, uR: R, uFocal: cam.focal,
    uTime: sim.realTime, uType: type, uStyle: S.planetStyle, uAudio: sim.audio,
  }, extra));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return pxR;
}
function mulPoint(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
function mulDir(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; }

const screenPlanets = [];
function render() {
  const F = frameAt(sim.theta);
  computeCamera(F);
  const accent = hexToRgb(S.accent);
  const fwd = v3.mul(cam.basis.z, -1), right = cam.basis.x, up = cam.basis.y;
  const sunPos = v3.sub(F.Sun, v3.mul(F.nF, fabricDepth([0, 0]) * cam.fabric));
  const sunScale = 1 + (S.planetScale - 1) * 0.5;

  gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
  gl.viewport(0, 0, W, Hh);
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1);
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bindVertexArray(emptyVAO);

  // ── sky ──
  gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  if (S.background === 0) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, nebula.tex);
    use(P.sky, { uNeb: 0, uFwd: fwd, uRight: right, uUp: up, uTan: [cam.tanX, cam.tanY], uGain: 1.0 });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  if (S.background < 2) {
    gl.bindVertexArray(sky.vao);
    use(P.skyStars, { uView: cam.view, uProj: cam.proj, uTime: sim.realTime, uScale: Math.max(1, pxScale) });
    gl.drawArrays(gl.POINTS, 0, sky.count);
    gl.bindVertexArray(emptyVAO);
  }

  // ── opaque bodies (premultiplied, depth written per pixel) ──
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const sunV = mulPoint(cam.view, sunPos);
  const sunRadius = SUN_R * sunScale;
  const sunBasis = { a1: F.r, a2: F.e2, axis: F.n };
  drawBody(sunPos, sunRadius, 8, { uBasis: basisMat(sunBasis), uSpin: sim.realTime * 0.03, uEmis: 6.0, uColor: [1, 0.8, 0.4], uSunV: sunV, uRingN: [0, 1, 0] });
  screenPlanets.length = 0;
  const ringJobs = [];
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  PLANETS.forEach((p, i) => {
    const pos = planetRenderPos(i, F);
    const R = p.size * S.planetScale;
    const b = bodyBasis(i, F);
    const ringN = mulDir(cam.view, b.axis);
    const pxR = drawBody(pos, R, i, {
      uBasis: basisMat(b), uSpin: sim.realTime * p.spin, uEmis: 1, uColor: trailColor(i), uSunV: sunV, uRingN: ringN,
    });
    screenPlanets.push({ i, pos, pxR });
    if (p.ring && pxR > 0.6) ringJobs.push({ i, pos, R, b });
  });

  // ── black hole ──
  const bhD = v3.len(cam.eye);
  {
    const cv = mulPoint(cam.view, [0, 0, 0]);
    const z = Math.min(cv[2] + RS * 13, -cam.near * 1.05);
    const pr = cam.proj;
    const cz = pr[10] * z + pr[14], cw = pr[11] * z + pr[15];
    const depth = cw > 0 ? clamp((cz / cw) * 0.5 + 0.5, 0, 1) : 1;
    if (cw > 0 || bhD < RS * 16) {
      use(P.bh, { uCam: cam.eye, uFwd: fwd, uRight: right, uUp: up, uTan: [cam.tanX, cam.tanY], uRs: RS, uTime: (sim.realTime % 4000) + sim.T * 0.15,
        uDiskIn: 3.0, uDiskOut: 11.5, uDepth: depth, uBoost: 1 + sim.audio * 0.5, uBound: 13.0 });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  // ── planetary rings (premultiplied, no depth write) ──
  gl.depthMask(false);
  ringJobs.forEach((j) => {
    const p = PLANETS[j.i];
    use(P.ring, { uVP: cam.vp, uCenter: j.pos, uA1: j.b.a1, uA2: j.b.a2, uR: j.R, uOut: p.ring, uSun: sunPos, uCam: cam.eye, uN: j.b.axis,
      uType: j.i, uStyle: S.planetStyle, uTint: trailColor(j.i) });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });

  // ── galaxy ──
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.bindVertexArray(galaxy.vao);
  const galU = { uVP: cam.vp, uRot: sim.galRot, uFocal: cam.focal, uTime: sim.realTime, uGain: 1.0, uMaxStar: 4.5, uClear: clamp((1100 - v3.len(cam.eye)) / 600, 0, 1), uPx: Math.max(0.75, pxScale) };
  use(P.galaxy, galU);
  gl.drawArrays(gl.POINTS, 0, galaxy.nAdd);
  gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.POINTS, galaxy.nAdd, galaxy.nDust);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.bindVertexArray(emptyVAO);

  // ── galactic plane grid ──
  if (cam.grid > 0.01) {
    use(P.plane, { uVP: cam.vp, uSize: 1900, uColor: accent, uGain: 0.10 * cam.grid, uSunR: RG });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const base = Object.assign(pathUniforms(F), { uVP: cam.vp, uViewport: [W, Hh], uFocal: cam.focal });
  const trailYears = cam.trail;
  const segs = [1500, 3000, 4500, 6500][S.quality] || 3000;
  const galacticP = TAU / omega();

  // ── galactic orbit ring + drop lines ──
  const ringGain = 0.10 + 0.25 * cam.grid;
  drawTrail(base, { uR: 0, uPhase: 0, uW: 0, uAge0: -galacticP * 0.5, uAge1: galacticP * 0.5, uWidth: 1.3 * pxScale, uWorldW: 0.08,
    uColor: [0.75, 0.8, 1.0], uColor2: [0.75, 0.8, 1.0], uGain: ringGain * (1 - cam.fabric), uFadePow: 0, uHead: 0, uDash: 0, uStyle: 1 }, 2048);
  if (S.showDropLines && cam.fabric < 0.98) {
    const N = 110;
    use(P.drop, Object.assign(pathUniforms(F), { uVP: cam.vp, uViewport: [W, Hh], uStep: trailYears * 1.1 / N, uCount: N, uWidth: 1.4 * pxScale,
      uColor: [0.75, 0.82, 1.0], uGain: 0.32 * (1 - cam.fabric) }));
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, N);
  }

  // ── sun path: past (fading) and ahead (dashed) ──
  const sunCol = [1.0, 0.78, 0.42];
  drawTrail(base, { uR: 0, uPhase: 0, uW: 0, uAge0: 0, uAge1: trailYears * 1.25, uWidth: 2.2 * pxScale, uWorldW: 0.16, uColor: sunCol, uColor2: [1, 0.5, 0.2],
    uGain: 0.9 * (1 - cam.fabric), uFadePow: 1.3, uHead: 0, uDash: 0, uStyle: 0 }, 1024);
  drawTrail(base, { uR: 0, uPhase: 0, uW: 0, uAge0: 0, uAge1: -trailYears * 0.6, uWidth: 1.6 * pxScale, uWorldW: 0.1, uColor: sunCol, uColor2: sunCol,
    uGain: 0.45 * (1 - cam.fabric), uFadePow: 1.0, uHead: 0, uDash: 38, uStyle: 1 }, 512);

  // ── planet helices ──
  const tGain = cam.gain * (1 - cam.fabric) * (1 + sim.audio * 0.35);
  if (tGain > 0.003) {
    const width = (S.trailStyle === 1 ? 2.2 : S.trailStyle === 2 ? 5 : 7.5) * pxScale;
    PLANETS.forEach((p, i) => {
      const c = trailColor(i);
      drawTrail(base, { uR: p.R, uPhase: sim.phases[i], uW: wOf(p), uAge0: 0, uAge1: trailYears, uWidth: width, uWorldW: S.trailStyle === 1 ? 0.06 : 0.16,
        uColor: c, uColor2: v3.lerp(c, [0.35, 0.2, 0.6], 0.55), uGain: tGain * (S.trailStyle === 1 ? 2.2 : 1.35), uFadePow: 1.15, uHead: 1.2, uDash: 0, uStyle: S.trailStyle }, segs);
    });
  }

  // ── spacetime fabric ──
  if (cam.fabric > 0.01) {
    gl.bindVertexArray(fabricMesh.vao);
    use(P.fabric, { uVP: cam.vp, uSun: F.Sun, uE1: F.r, uE2: F.e2, uN: F.nF, uL: FAB_L, uMass: fabM, uSpacing: 2.4, uGain: cam.fabric, uDK: cam.fabric,
      uTime: sim.realTime, uScroll: [0, -sim.scrollY], uColor: [0.55, 0.32, 1.0], uOrb: PLANETS.map((p) => p.R) });
    gl.drawElements(gl.TRIANGLES, fabricMesh.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(emptyVAO);
  }

  // ── heliosphere ──
  if (cam.helio > 0.01) {
    const m = F.m;
    const b1 = v3.norm(v3.cross(m, [0, 1, 0])), b2 = v3.cross(b1, m);
    const R0 = 62;
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(helioMesh.vao);
    [[0.58, 1, 0.45], [1.0, 0, 0.6], [1.38, 2, 0.32]].forEach(([scale, layer, g]) => {
      use(P.helio, { uVP: cam.vp, uSun: sunPos, uM: m, uB1: b1, uB2: b2, uR0: R0, uScale: scale, uTime: sim.realTime, uCam: cam.eye, uGain: cam.helio * g, uLayer: layer });
      gl.drawElements(gl.TRIANGLES, helioMesh.count, gl.UNSIGNED_INT, 0);
    });
    gl.bindVertexArray(emptyVAO);
    use(P.ism, { uVP: cam.vp, uViewport: [W, Hh], uSun: sunPos, uM: m, uB1: b1, uB2: b2, uR0: R0, uTime: sim.realTime, uGain: cam.helio * 0.2 });
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 380);
  }

  // ── sun corona ──
  {
    const d = v3.len(v3.sub(sunPos, cam.eye));
    const q = Math.max(sunRadius * 9, 26 * pxScale * d / cam.focal);
    use(P.corona, { uView: cam.view, uProj: cam.proj, uCenter: sunPos, uQuad: q, uTime: sim.realTime, uGain: 1.0, uAudio: sim.audio, uTint: [1.0, 0.72, 0.38] });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  gl.depthMask(true);
  gl.disable(gl.DEPTH_TEST);

  // ── bloom ──
  gl.disable(gl.BLEND);
  const fx = S.bloom > 0.001;
  if (fx) {
    const b0 = bloom[0];
    gl.bindFramebuffer(gl.FRAMEBUFFER, b0.fbo); gl.viewport(0, 0, b0.w, b0.h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    use(P.pre, { uTex: 0, uTexel: [0.5 / W, 0.5 / Hh], uThresh: HAS_FLOAT ? 0.85 : 0.6 });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (let i = 1; i < bloom.length; i++) {
      const src = bloom[i - 1], dst = bloom[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      use(P.down, { uTex: 0, uTexel: [0.5 / src.w, 0.5 / src.h] });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bloom.length - 1; i > 0; i--) {
      const src = bloom[i], dst = bloom[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      use(P.up, { uTex: 0, uTexel: [0.5 / src.w, 0.5 / src.h], uW: 1.0 });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
  }

  // ── composite ──
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, Hh);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloom[0].tex);
  use(P.comp, { uScene: 0, uBloom: 1, uBloomStr: fx ? S.bloom * 0.16 : 0, uExposure: S.exposure * 1.05, uTime: sim.realTime,
    uGrain: S.cinematicFx ? 1 : 0, uVig: S.cinematicFx ? 0.55 : 0.15, uCA: S.cinematicFx ? 0.012 : 0, uRes: [W, Hh] });
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE0);

  updateLabels(F, sunPos);
}
function basisMat(b) { return new Float32Array([b.a1[0], b.a1[1], b.a1[2], b.a2[0], b.a2[1], b.a2[2], b.axis[0], b.axis[1], b.axis[2]]); }

/* ───────────────────────── labels ───────────────────────── */
const labelLayer = $('labels');
function mkLabel(cls) { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = '<span class="tick"></span><div class="n"></div><div class="d"></div>'; labelLayer.appendChild(el); return el; }
const labels = {
  planets: PLANETS.map((p) => { const el = mkLabel('planet'); el.style.setProperty('--c', `rgb(${p.col.map((x) => Math.round(x * 255)).join(',')})`); return el; }),
  sun: mkLabel('sun'), bh: mkLabel('bh'), arrow: mkLabel('arrow'), today: mkLabel('event today'),
  events: EVENTS.map(() => mkLabel('event')),
};
labels.arrow.innerHTML = '<div class="n"><span class="tx"></span><span class="ar">➝</span></div>';
function setLabelText() {
  const l = L(), en = T.en, both = bi();
  PLANETS.forEach((p, i) => {
    const el = labels.planets[i];
    el.querySelector('.n').textContent = S.language === 1 ? p.en : both ? `${p.ar} · ${p.en}` : p.ar;
    el.querySelector('.d').textContent = S.language === 1 ? p.hEn : both ? `${p.hAr} · ${p.hEn}` : p.hAr;
  });
  labels.bh.querySelector('.n').textContent = both ? `${T.ar.bh} · ${en.bh}` : l.bh;
  labels.bh.querySelector('.d').textContent = l.bhD;
  labels.arrow.querySelector('.tx').textContent = both ? `${T.ar.dir} · ${en.dir}` : l.dir;
  labels.today.querySelector('.n').textContent = both ? `${T.ar.today} · ${en.today}` : l.today;
  labels.today.querySelector('.d').textContent = '0 ' + l.ago;
  EVENTS.forEach((e, i) => {
    labels.events[i].querySelector('.n').textContent = S.language === 1 ? e.en : both ? `${e.ar} · ${e.en}` : e.ar;
    labels.events[i].querySelector('.d').textContent = `${e.myr} ${l.ago}`;
  });
}
function place(el, p, alpha, dx, dy, center) {
  if (!p || alpha < 0.02) { el.style.opacity = 0; return; }
  const x = p.x + (dx || 0), y = p.y + (dy || 0);
  el.style.transform = center ? `translate(${x}px, ${y}px) translate(-50%, -100%)` : `translate(${x}px, ${y}px) translate(0, -50%)`;
  el.style.opacity = alpha.toFixed(3);
}
function updateLabels(F, sunPos) {
  const show = S.showLabels && S.hudLayout !== 2 ? 1 : 0;
  const vp = cam.vp, d = cam.dist;
  const near = show * clamp((620 - d) / 260, 0, 1);
  const s = Math.max(0.75, window.innerHeight / 1080);
  screenPlanets.forEach((sp) => {
    const pr = project(vp, sp.pos);
    const off = Math.max(sp.pxR / (window.devicePixelRatio || 1) / S.renderScale, 3) + 6 * s;
    place(labels.planets[sp.i], pr, near * (cam.followIdx >= 0 && cam.followIdx !== sp.i ? 0.45 : 1), off, 0, false);
  });
  const sp = project(vp, sunPos);
  const sunName = labels.sun.querySelector('.n'), sunD = labels.sun.querySelector('.d');
  const far = d > 700;
  const l = L();
  const name = far ? (bi() ? `${T.ar.solar} · ${T.en.solar}` : l.solar) : (bi() ? `${T.ar.sun} · ${T.en.sun}` : l.sun);
  if (sunName.textContent !== name) sunName.textContent = name;
  if (sunD.textContent !== l.sunD) sunD.textContent = l.sunD;
  place(labels.sun, sp, show * (1 - cam.fabric * 0.5), 14 * s, -18 * s, false);
  // direction of motion arrow
  const ahead = frameAt(sim.theta + Math.min(cam.trail * 0.45, 400) * omega());
  const ap = project(vp, ahead.Sun);
  if (ap && sp) {
    const ang = Math.atan2(ap.y - sp.y, ap.x - sp.x);
    labels.arrow.querySelector('.ar').style.transform = `rotate(${ang}rad)`;
  }
  place(labels.arrow, ap, show * (1 - cam.fabric) * 0.9, 0, -10 * s, true);
  // black hole
  const bp = project(vp, [0, RS * 7, 0]);
  place(labels.bh, bp, show * clamp((cam.grid + (activeShot === 4 ? 1 : 0)), 0, 1), 0, -8 * s, true);
  // extinction markers along the past galactic orbit
  const extA = show * cam.ext;
  const tNow = sim.thetaU;
  const gMyr = (tNow - THETA0) / TAU * GAL_YEAR_MYR;
  EVENTS.forEach((e, i) => {
    const th = THETA0 - TAU * e.myr / GAL_YEAR_MYR;
    const pos = frameAt(th).Sun;
    place(labels.events[i], project(vp, pos), extA, 0, 0, true);
    if (i === 0) {
      labels.today.querySelector('.d').textContent = `${gMyr.toFixed(1)} ${l.myr} →`;
    }
  });
  place(labels.today, project(vp, frameAt(THETA0).Sun), extA, 0, 0, true);
}

/* ───────────────────────── HUD ───────────────────────── */
const hud = $('hud');
function applyLanguage() {
  const l = L();
  document.documentElement.lang = S.language === 1 ? 'en' : 'ar';
  document.documentElement.dir = S.language === 1 ? 'ltr' : 'rtl';
  hud.classList.toggle('bi', bi());
  $('subtitle').textContent = bi() ? `${T.ar.subtitle} · ${T.en.subtitle}` : l.subtitle;
  $('teleTitle').textContent = bi() ? `${T.ar.tele} · ${T.en.tele}` : l.tele;
  buildModes(); buildLegend(); buildTelemetry(); setLabelText(); updateCaption(true);
}
const MODE_ICONS = ['🎬', '🌀', '〰', '🌌', '⚫', '🫧', '🕸', '🖱'];
function buildModes() {
  const l = L(), el = $('modes');
  el.innerHTML = '';
  l.modes.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.dataset.mode = i;
    b.innerHTML = `<span class="ic">${MODE_ICONS[i]}</span><span class="lb">${bi() ? `${T.ar.modes[i]}<em class="en2">${T.en.modes[i]}</em>` : name}</span><span class="k">${i}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); selectMode(i); });
    el.appendChild(b);
  });
  updateModeButtons();
}
function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach((b) => {
    const m = +b.dataset.mode;
    b.classList.toggle('active', m === S.viewMode);
    b.classList.toggle('playing', S.viewMode === 0 && m === activeShot);
  });
}
function buildLegend() {
  const el = $('legend');
  el.innerHTML = '';
  PLANETS.forEach((p, i) => {
    const r = document.createElement('div');
    r.className = 'leg-row'; r.dataset.i = i;
    const c = trailColor(i).map((x) => Math.round(Math.min(1, x) * 255)).join(',');
    r.style.setProperty('--c', `rgb(${c})`);
    r.innerHTML = `<span class="sw"></span><span class="nm">${S.language === 1 ? p.en : p.ar}${bi() ? `<em class="en2">${p.en}</em>` : ''}</span><span class="hx">${S.language === 1 ? p.hEn : p.hAr}${bi() ? `<em class="en2">${p.hEn}</em>` : ''}</span>`;
    r.addEventListener('click', (e) => { e.stopPropagation(); followPlanet(cam.followIdx === i ? -1 : i); });
    el.appendChild(r);
  });
}
const teleKeys = ['speed', 'height', 'gtime', 'dist', 'lon', 'years'];
function buildTelemetry() {
  const l = L(), g = $('teleGrid');
  g.innerHTML = '';
  teleKeys.forEach((k) => {
    const d = document.createElement('div'); d.className = 'tv';
    d.innerHTML = `<div class="l">${l[k]}</div><div class="v" id="tv_${k}"></div>`;
    g.appendChild(d);
  });
}
let lastCaption = '';
function updateCaption(force) {
  const l = L();
  const id = cam.followIdx >= 0 ? 'follow' : SHOTS[activeShot].id;
  const key = id + S.language + cam.followIdx;
  if (!force && key === lastCaption) return;
  lastCaption = key;
  const cap = $('caption');
  let name = l.shots[id][0], desc = l.shots[id][1];
  if (id === 'follow') { const p = PLANETS[cam.followIdx]; name += ' — ' + (S.language === 1 ? p.en : p.ar); }
  $('shotName').textContent = bi() ? `${T.ar.shots[id][0]}${id === 'follow' ? ' — ' + PLANETS[cam.followIdx].ar : ''}` : name;
  $('shotDesc').innerHTML = bi() ? `${T.ar.shots[id][1]}<span class="en">${T.en.shots[id][1]}</span>` : desc;
  const idx = cam.followIdx >= 0 ? '◉' : String(activeShot).padStart(2, '0');
  $('shotIndex').textContent = S.viewMode === 0 ? `DIRECTOR · SHOT ${idx}` : `VIEW ${idx}`;
  cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
}
function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
let hudTimer = 1, fpsAcc = 0, fpsN = 0, fps = 60;
function updateHud(dt) {
  fpsAcc += dt; fpsN++;
  hudTimer += dt;
  $('shotProgress').style.width = (S.viewMode === 0 && cam.followIdx < 0 ? clamp(shotTimer / S.directorInterval, 0, 1) * 100 : 100) + '%';
  if (hudTimer < 0.2) return;
  hudTimer = 0;
  if (fpsAcc > 1) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const l = L();
  const F = frameAt(sim.theta);
  const h = S.waveAmplitude > 0 ? F.Sun[1] / S.waveAmplitude * 85 : 0;
  const gMyr = (sim.thetaU - THETA0) / TAU * GAL_YEAR_MYR;
  const ly = gMyr * 767;
  const set = (k, html) => { const e = $('tv_' + k); if (e && e.innerHTML !== html) e.innerHTML = html; };
  set('speed', `230 <small>km/s</small>`);
  set('height', `<span class="${h >= 0 ? 'c' : 'a'}">${h >= 0 ? '+' : '−'}${fmt(Math.abs(h), 1)}</span> <small>${l.ly} ${h >= 0 ? '▲' : '▼'}</small>`);
  set('gtime', `${fmt(gMyr, 2)} <small>${l.myr}</small>`);
  set('dist', ly > 10000 ? `${fmt(ly / 1000, 1)} <small>${l.kly}</small>` : `${fmt(ly, 0)} <small>${l.ly}</small>`);
  set('lon', `${fmt(((sim.thetaU - THETA0) * 180 / Math.PI) % 360, 2)}°`);
  set('years', `${fmt(sim.T, 1)}`);
  $('teleFoot').textContent = `${Math.round(fps)} FPS · ${W}×${Hh} · ${HAS_FLOAT ? 'HDR16F' : 'LDR'} · ${(galaxy.nAdd / 1000).toFixed(0)}k ★${sim.paused ? ' · ⏸' : ''}`;
  drawWave(F);
  // clock
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0'), ss = String(now.getSeconds()).padStart(2, '0');
  const tHtml = `${hh}:${mm}<small>${ss}</small>`;
  if ($('clockTime').innerHTML !== tHtml) $('clockTime').innerHTML = tHtml;
  const dl = S.language === 1 ? T.en : T.ar;
  $('clockDate').textContent = `${dl.days[now.getDay()]} · ${now.getDate()} ${dl.months[now.getMonth()]} ${now.getFullYear()}`;
  updateCaption(false);
  document.querySelectorAll('.leg-row').forEach((r) => r.classList.toggle('on', +r.dataset.i === cam.followIdx));
}
const waveCtx = $('wave').getContext('2d');
function drawWave() {
  const c = waveCtx, w = c.canvas.width, h = c.canvas.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(160,190,255,.18)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  const K = S.waveCount, span = Math.PI * 0.9;
  const grad = c.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(127,220,255,0)'); grad.addColorStop(0.5, S.accent); grad.addColorStop(1, 'rgba(127,220,255,.15)');
  c.strokeStyle = grad; c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x <= w; x += 2) {
    const th = sim.theta + (x / w - 0.5) * span;
    const y = h / 2 - Math.sin(K * th) * (h * 0.38);
    x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
  const y0 = h / 2 - Math.sin(K * sim.theta) * (h * 0.38);
  c.fillStyle = '#fff'; c.shadowColor = S.accent; c.shadowBlur = 12;
  c.beginPath(); c.arc(w / 2, y0, 4, 0, TAU); c.fill(); c.shadowBlur = 0;
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }
function applyHud() {
  hud.classList.toggle('hidden', S.hudLayout === 2);
  hud.classList.toggle('minimal', S.hudLayout === 1);
  document.documentElement.style.setProperty('--hud-opacity', S.hudOpacity);
  $('clock').classList.toggle('off', !S.showClock);
  const rgb = hexToRgb(S.accent).map((x) => Math.round(x * 255));
  document.documentElement.style.setProperty('--accent', `rgb(${rgb.join(',')})`);
  document.documentElement.style.setProperty('--accent-rgb', rgb.join(','));
}

/* ───────────────────────── interaction ───────────────────────── */
function selectMode(i) {
  S.viewMode = clamp(i | 0, 0, 7);
  cam.followIdx = -1;
  if (S.viewMode === 0) { directorIdx = 0; setShot(DIRECTOR_ORDER[0]); } else setShot(S.viewMode);
}
function followPlanet(i) {
  if (i >= 0) { cam.followIdx = i; cam.lastFollow = i; cam.zoom = 0; cam.userYaw = 0; cam.userPitch = 0; toast(L().toastFollow + (S.language === 1 ? PLANETS[i].en : PLANETS[i].ar)); }
  else cam.followIdx = -1;
  updateCaption(true);
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  cam.hoverX = e.clientX / window.innerWidth * 2 - 1; cam.hoverY = e.clientY / window.innerHeight * 2 - 1;
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true; canvas.classList.add('dragging');
  cam.userYaw += dx * 0.0055; cam.userPitch = clamp(cam.userPitch + dy * 0.0045, -1.6, 1.6);
  drag.x = e.clientX; drag.y = e.clientY; cam.idle = 0;
});
canvas.addEventListener('pointerup', (e) => {
  canvas.classList.remove('dragging');
  if (drag && !drag.moved) pick(e.clientX, e.clientY);
  drag = null;
});
canvas.addEventListener('wheel', (e) => { cam.zoom = clamp(cam.zoom + Math.sign(e.deltaY) * 0.12, -2.2, 2.4); cam.idle = 0; }, { passive: true });
canvas.addEventListener('dblclick', () => { cam.userYaw = 0; cam.userPitch = 0; cam.zoom = 0; followPlanet(-1); });
function pick(x, y) {
  let best = -1, bd = 1e9;
  const dpr = (window.devicePixelRatio || 1) * S.renderScale;
  screenPlanets.forEach((sp) => {
    const p = project(cam.vp, sp.pos); if (!p) return;
    const d = Math.hypot(p.x - x, p.y - y), r = Math.max(sp.pxR / dpr, 4) + 16;
    if (d < r && d < bd) { bd = d; best = sp.i; }
  });
  if (best >= 0) followPlanet(best); else if (cam.followIdx >= 0) followPlanet(-1);
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k >= '0' && k <= '7') selectMode(+k);
  else if (k === ' ') { sim.paused = !sim.paused; toast(sim.paused ? L().toastPause : L().toastPlay); e.preventDefault(); }
  else if (k === 'h') { S.hudLayout = S.hudLayout === 2 ? 0 : 2; applyHud(); }
  else if (k === 'l') S.showLabels = !S.showLabels;
  else if (k === 'r') { cam.userYaw = 0; cam.userPitch = 0; cam.zoom = 0; followPlanet(-1); }
  else if (k === 'escape') followPlanet(-1);
  else if (k === 'arrowright') followPlanet((cam.followIdx + 1) % 8);
  else if (k === 'arrowleft') followPlanet((cam.followIdx + 7) % 8);
});

/* ───────────────────────── Lively bridge ───────────────────────── */
const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'True';
window.livelyPropertyListener = function (name, val) {
  const n = Number(val);
  switch (name) {
    case 'language': S.language = clamp(n | 0, 0, 2); applyLanguage(); break;
    case 'viewMode': selectMode(n); break;
    case 'directorInterval': S.directorInterval = clamp(n, 8, 300); break;
    case 'timeSpeed': S.timeSpeed = clamp(n / 100, 0.05, 5); break;
    case 'sunVelocity': S.sunVelocity = clamp(n, 1, 40); break;
    case 'trailLength': S.trailLength = clamp(n / 100, 0.1, 4); break;
    case 'trailStyle': S.trailStyle = clamp(n | 0, 0, 2); break;
    case 'trailColor': S.trailColor = clamp(n | 0, 0, 2); buildLegend(); break;
    case 'orbitModel': S.orbitModel = clamp(n | 0, 0, 1); break;
    case 'planetStyle': S.planetStyle = clamp(n | 0, 0, 2); break;
    case 'planetScale': S.planetScale = clamp(n / 100, 0.3, 4); break;
    case 'waveAmplitude': S.waveAmplitude = clamp(n, 0, 200); break;
    case 'waveCount': S.waveCount = clamp(Math.round(n), 1, 12); break;
    case 'background': S.background = clamp(n | 0, 0, 2); break;
    case 'quality': S.quality = clamp(n | 0, 0, 3); buildGalaxy(); break;
    case 'renderScale': S.renderScale = clamp(n / 100, 0.3, 1); resize(); break;
    case 'fpsLimit': S.fpsLimit = clamp(n | 0, 0, 2); break;
    case 'bloom': S.bloom = clamp(n / 100, 0, 3); break;
    case 'exposure': S.exposure = clamp(n / 100, 0.2, 3); break;
    case 'cinematicFx': S.cinematicFx = bool(val); break;
    case 'showLabels': S.showLabels = bool(val); break;
    case 'showDropLines': S.showDropLines = bool(val); break;
    case 'showExtinctions': S.showExtinctions = bool(val); break;
    case 'showGalaxyGrid': S.showGalaxyGrid = bool(val); break;
    case 'heliosphere': S.heliosphere = clamp(n | 0, 0, 2); break;
    case 'hudLayout': S.hudLayout = clamp(n | 0, 0, 2); applyHud(); break;
    case 'hudOpacity': S.hudOpacity = clamp(n / 100, 0, 1); applyHud(); break;
    case 'showClock': S.showClock = bool(val); applyHud(); break;
    case 'accent': S.accent = String(val); applyHud(); if (S.trailColor === 2) buildLegend(); break;
    case 'audioReactive': S.audioReactive = bool(val); break;
    case 'mouseParallax': S.mouseParallax = bool(val); break;
  }
};
window.livelyAudioListener = function (arr) {
  if (!S.audioReactive || !arr || !arr.length) return;
  let s = 0; const n = Math.min(16, arr.length);
  for (let i = 0; i < n; i++) { let v = Number(arr[i]) || 0; if (v > 1) v /= 255; s += v; }
  sim.audioT = clamp(s / n * 2.2, 0, 1);
};
let livelyPaused = false;
window.livelyWallpaperPlaybackState = function (state) {
  const s = typeof state === 'object' && state ? state : { isPaused: state };
  const p = s.isPaused !== undefined ? bool(s.isPaused) || /pause|stop/i.test(String(s.isPaused)) : /pause|stop/i.test(String(state));
  livelyPaused = p;
  if (!p) last = performance.now();
};

/* ───────────────────────── main loop ───────────────────────── */
let last = performance.now(), lastDraw = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (livelyPaused || document.hidden) { last = now; return; }
  const cap = [30, 60, 0][S.fpsLimit];
  if (cap && now - lastDraw < 1000 / cap - 1.5) return;
  lastDraw = now;
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  updateSim(dt);
  render();
  updateHud(dt);
}

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
canvas.addEventListener('webglcontextrestored', () => location.reload(), false);
window.addEventListener('resize', resize);

// boot
document.body.classList.add('boot');
setTimeout(() => document.body.classList.remove('boot'), 400);
resize();
applyHud();
applyLanguage();
if (URLP.has('lang')) window.livelyPropertyListener('language', +URLP.get('lang'));
if (URLP.has('hud')) window.livelyPropertyListener('hudLayout', +URLP.get('hud'));
if (URLP.has('shot')) { S.viewMode = +URLP.get('shot'); setShot(S.viewMode === 0 ? DIRECTOR_ORDER[0] : S.viewMode, true); }
else setShot(DIRECTOR_ORDER[0], true);
if (URLP.has('t')) { const t = +URLP.get('t'); for (let i = 0; i < t * 30; i++) updateSim(1 / 30); }
window.__olx = { S, sim, cam, setShot, selectMode, followPlanet };
requestAnimationFrame(frame);
})();
