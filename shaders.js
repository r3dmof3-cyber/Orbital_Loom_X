/* Orbital Loom X — GLSL ES 3.00 shader library */
'use strict';
(function () {
const H = `#version 300 es
precision highp float;
precision highp int;
#define PI 3.14159265359
#define TAU 6.28318530718
`;

const NOISE = `
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a*vnoise(p); p = p*2.07 + vec3(4.1, 1.3, 7.7); a *= 0.5; } return s; }
`;

// ── fullscreen triangle ──
const VS_FULL = H + `
out vec2 vUv;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

// ── nebula equirect generator (run once) ──
const FS_NEBGEN = H + NOISE + `
in vec2 vUv; out vec4 o;
void main(){
  float phi = (vUv.x - 0.5) * TAU; float th = vUv.y * PI;
  vec3 d = vec3(sin(th)*cos(phi), cos(th), sin(th)*sin(phi));
  vec3 q = d * 2.2;
  float w = fbm(q * 1.3);
  vec3 q2 = q + vec3(w*1.8, w*0.9, -w*1.2);
  float n1 = fbm(q2 * 1.1 + 11.0);
  float n2 = fbm(q2 * 2.6 + 5.0);
  float n3 = fbm(q2 * 5.0 - 3.0);
  float neb = pow(smoothstep(0.42, 0.86, n1), 2.2);
  vec3 c = mix(vec3(0.22, 0.10, 0.48), vec3(0.04, 0.30, 0.52), smoothstep(0.3, 0.7, n2)) * neb * 0.11;
  c += vec3(0.65, 0.22, 0.30) * pow(smoothstep(0.55, 0.92, n2 * n1 * 1.7), 3.0) * 0.07;
  c *= 0.55 + 0.9 * n3;
  float dust = smoothstep(0.55, 0.75, fbm(q2 * 3.0 + 20.0));
  c *= 1.0 - dust * 0.6;
  c += vec3(0.010, 0.012, 0.022);
  o = vec4(c, 1.0);
}`;

const FS_SKY = H + `
in vec2 vUv; out vec4 o;
uniform sampler2D uNeb; uniform vec3 uFwd, uRight, uUp; uniform vec2 uTan; uniform float uGain;
void main(){
  vec2 n = vUv * 2.0 - 1.0;
  vec3 d = normalize(uFwd + n.x * uTan.x * uRight + n.y * uTan.y * uUp);
  vec2 uv = vec2(atan(d.z, d.x) / TAU + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
  o = vec4(texture(uNeb, uv).rgb * uGain, 1.0);
}`;

// ── background star sphere ──
const VS_SKYSTARS = H + `
layout(location=0) in vec3 aDir; layout(location=1) in vec3 aCol; layout(location=2) in vec2 aPar;
uniform mat4 uView, uProj; uniform float uTime, uScale;
out vec3 vCol; out float vA;
void main(){
  vec3 v = mat3(uView) * aDir;
  gl_Position = uProj * vec4(v * 100.0, 1.0);
  gl_Position.z = gl_Position.w * 0.99999;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aPar.y * 2.5) + aPar.y * 60.0);
  gl_PointSize = aPar.x * uScale;
  vCol = aCol; vA = tw;
}`;
const FS_POINT = H + `
in vec3 vCol; in float vA; out vec4 o;
void main(){ vec2 d = gl_PointCoord*2.0-1.0; float r2 = dot(d,d); if (r2 > 1.0) discard;
  float f = exp(-r2 * 6.0) + 0.12 * exp(-r2 * 1.5);
  o = vec4(vCol * f * vA, f * vA); }`;

// ── galaxy particles ──
const VS_GALAXY = H + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aCol; layout(location=2) in vec4 aPar;
uniform mat4 uVP; uniform float uRot, uFocal, uTime, uGain, uMaxStar, uPx, uClear;
out vec3 vCol; out float vA; flat out float vKind;
void main(){
  float c = cos(uRot), s = sin(uRot);
  vec3 p = vec3(c*aPos.x - s*aPos.z, aPos.y, s*aPos.x + c*aPos.z);
  vec4 clip = uVP * vec4(p, 1.0);
  gl_Position = clip;
  float w = max(clip.w, 0.001);
  float size = aPar.x * uFocal / w;
  float a = aPar.y * uGain;
  vKind = aPar.w;
  a *= mix(1.0, 0.08 + 0.92 * smoothstep(30.0, 230.0, length(p)), uClear);
  if (aPar.w < 0.5) {
    float tw = 0.78 + 0.22 * sin(uTime * (0.7 + aPar.z * 3.0) + aPar.z * 50.0);
    float mn = 1.6 * uPx;
    if (size < mn) a *= mix(1.0, (size*size)/(mn*mn), 0.82);
    a *= tw;
    a *= smoothstep(0.5, 4.0, w);
    size = clamp(size, mn, uMaxStar * uPx);
  } else {
    a *= smoothstep(25.0, 220.0, w);
    if (size > 340.0 * uPx) a *= (340.0 * uPx) / size;
    size = clamp(size, 2.0, 340.0 * uPx);
  }
  gl_PointSize = size;
  vCol = aCol; vA = a;
}`;
const FS_GALAXY = H + `
in vec3 vCol; in float vA; flat in float vKind; out vec4 o;
void main(){ vec2 d = gl_PointCoord*2.0-1.0; float r2 = dot(d,d); if (r2 > 1.0) discard;
  float f;
  if (vKind < 0.5) f = exp(-r2 * 7.0) + 0.10 * exp(-r2 * 2.0);
  else f = exp(-r2 * 3.2) * (1.0 - r2);
  o = vec4(vCol * f * vA, clamp(f * vA, 0.0, 1.0)); }`;

// ── black hole (fullscreen ray-march with gravitational bending) ──
const FS_BH = H + NOISE + `
in vec2 vUv; out vec4 o;
uniform vec3 uCam, uFwd, uRight, uUp; uniform vec2 uTan;
uniform float uRs, uTime, uDiskIn, uDiskOut, uDepth, uBoost, uBound;
void main(){
  vec2 n = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uFwd + n.x * uTan.x * uRight + n.y * uTan.y * uUp);
  vec3 ro = uCam / uRs;
  float B = uBound;
  float b = dot(ro, rd); float c = dot(ro, ro) - B*B; float disc = b*b - c;
  if (disc < 0.0) discard;
  float t0 = -b - sqrt(disc);
  if (-b + sqrt(disc) < 0.0) discard;
  vec3 p = ro + rd * max(t0, 0.0);
  vec3 v = rd;
  vec3 hv = cross(p, v); float h2 = dot(hv, hv);
  vec3 col = vec3(0.0); float a = 0.0; float minR = 1e5;
  for (int i = 0; i < 160; i++) {
    float r = length(p);
    minR = min(minR, r);
    if (r < 1.0) { a = 1.0; break; }
    if (r > B + 0.01 && dot(p, v) > 0.0) break;
    float dt = clamp(0.085 * r, 0.025, 1.2);
    vec3 acc = -1.5 * h2 * p / pow(r, 5.0);
    v += acc * dt;
    vec3 pn = p + v * dt;
    if (p.y * pn.y < 0.0) {
      float f = p.y / (p.y - pn.y);
      vec3 x = mix(p, pn, f);
      float rr = length(x.xz);
      if (rr > uDiskIn && rr < uDiskOut) {
        float ang = atan(x.z, x.x);
        float om = 1.6 / pow(rr, 1.5);
        float ta = ang + uTime * om;
        float swirl = fbm3(vec3(cos(ta)*rr*0.9, sin(ta)*rr*0.9, rr*2.4));
        float rings = 0.6 + 0.4 * sin(rr * 9.0 + swirl * 6.0);
        float x01 = (rr - uDiskIn) / (uDiskOut - uDiskIn);
        float temp = pow(uDiskIn / rr, 0.9) * pow(max(1.0 - sqrt(uDiskIn / rr) * 0.97, 0.0), 0.3);
        vec3 hot = vec3(1.0, 0.92, 0.80), warm = vec3(1.0, 0.55, 0.18), cool = vec3(0.55, 0.12, 0.04);
        vec3 dc = mix(hot, warm, smoothstep(0.0, 0.35, x01));
        dc = mix(dc, cool, smoothstep(0.35, 1.0, x01));
        vec3 vel = normalize(vec3(-x.z, 0.0, x.x)) * sqrt(0.5 / rr);
        float dop = 1.0 / max(0.2, 1.0 - dot(vel, -normalize(v)) * 1.4);
        float I = temp * (0.45 + 0.75 * swirl) * rings * pow(dop, 2.6) * 1.7 * uBoost;
        float edge = smoothstep(0.0, 0.06, x01) * smoothstep(1.0, 0.7, x01);
        float da = clamp(edge * (0.55 + 0.45 * swirl) * 0.9, 0.0, 1.0);
        col += (1.0 - a) * dc * I * da;
        a += (1.0 - a) * da * 0.85;
        if (a > 0.985) break;
      }
    }
    p = pn;
  }
  float ring = exp(-pow((minR - 1.55) * 5.0, 2.0));
  col += (1.0 - a) * vec3(1.0, 0.78, 0.5) * ring * 0.9 * uBoost;
  col += (1.0 - a) * vec3(1.0, 0.6, 0.3) * exp(-minR * 0.6) * 0.08;
  o = vec4(col, a);
  gl_FragDepth = a > 0.5 ? uDepth : 1.0;
}`;

// ── billboard (planet / sun / corona) ──
const VS_BILL = H + `
uniform mat4 uView, uProj; uniform vec3 uCenter; uniform float uQuad;
out vec3 vPos; out vec2 vQ;
void main(){
  vec2 c = vec2((gl_VertexID == 1 || gl_VertexID == 3) ? 1.0 : -1.0, (gl_VertexID >= 2) ? 1.0 : -1.0);
  vec3 cv = (uView * vec4(uCenter, 1.0)).xyz;
  vec3 p = cv + vec3(c * uQuad, 0.0);
  vPos = p; vQ = c;
  gl_Position = uProj * vec4(p, 1.0);
}`;

const FS_BODY = H + NOISE + `
in vec3 vPos; out vec4 o;
uniform mat4 uView, uProj; uniform vec3 uCenterV; uniform float uR, uFocal, uSpin, uTime, uEmis, uAudio;
uniform mat3 uBasis; uniform int uType, uStyle; uniform vec3 uColor, uSunV, uRingN; uniform vec2 uRingR;

float ringDensity(float r){
  if (uType == 5) {
    float d = 0.0;
    d += 0.22 * smoothstep(1.24, 1.26, r) * (1.0 - smoothstep(1.52, 1.53, r));
    d += 0.92 * smoothstep(1.52, 1.54, r) * (1.0 - smoothstep(1.94, 1.95, r));
    d += 0.62 * smoothstep(2.02, 2.03, r) * (1.0 - smoothstep(2.26, 2.27, r));
    d *= 1.0 - 0.8 * (smoothstep(2.205, 2.21, r) - smoothstep(2.22, 2.225, r));
    d *= 0.82 + 0.18 * sin(r * 150.0) * sin(r * 47.0);
    return d;
  }
  float d = 0.0;
  d += exp(-pow((r - 1.62) * 90.0, 2.0)); d += exp(-pow((r - 1.72) * 90.0, 2.0));
  d += exp(-pow((r - 1.84) * 80.0, 2.0)); d += 1.2 * exp(-pow((r - 2.0) * 60.0, 2.0));
  return d * 0.35;
}

uniform float uLod;
float fbmH(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 8; i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// crater field: bowl (negative) with a raised rim (positive)
float craters(vec3 p, float sc){
  p *= sc; vec3 i = floor(p), f = fract(p); float h = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z)); vec3 o3 = hash33(i + g);
    if (o3.y < 0.42) continue;
    float rad = 0.16 + 0.30 * o3.x * o3.z;
    float d = length(g + o3 - f) / rad;
    h += (smoothstep(0.72, 1.0, d) * (1.0 - smoothstep(1.0, 1.4, d)) * 0.55 - (1.0 - smoothstep(0.0, 0.92, d)) * 0.8) * rad;
  }
  return h;
}
float heightOf(vec3 p){
  if (uType == 0) return (fbm(p * 5.0) - 0.5) * 0.45 + craters(p, 5.0) * 1.3 + craters(p, 13.0) * 0.9 + (fbmH(p * 26.0) - 0.5) * 0.10;
  return (fbm(p * 3.0 + 1.0) - 0.5) * 0.9 + craters(p, 9.0) * 0.55 + (fbmH(p * 22.0) - 0.5) * 0.16;
}

vec3 surface(vec3 p, float lat, out float spec, out vec3 night, out vec3 atm, out float atmK){
  spec = 0.0; night = vec3(0.0); atm = vec3(0.0); atmK = 0.0;
  float fine = fbmH(p * 38.0) - 0.5;                       // sub-pixel when far away, crisp in close-ups
  if (uType == 0) {
    float n = fbm(p * 4.0); float cr = fbm(p * 14.0);
    vec3 c = mix(vec3(0.30,0.29,0.28), vec3(0.60,0.57,0.53), n);
    c *= 0.78 + 0.44 * smoothstep(0.35, 0.75, cr);
    float ch = craters(p, 5.0) + craters(p, 13.0) * 0.6;
    c *= 1.0 + ch * 1.1;
    c += vec3(0.16) * smoothstep(0.80, 0.95, fbm(p * 2.3 + 7.0)) * (0.6 + 0.8 * fbm(p * 30.0));   // bright ray systems
    c *= 1.0 + fine * 0.35 * uLod;
    return c;
  } else if (uType == 1) {
    vec3 w = p + 0.30 * vec3(fbm(p * 2.2 + uTime * 0.012), fbm(p * 2.2 + 5.0), fbm(p * 2.2 + 9.0)) - 0.15;
    float n = fbmH(vec3(w.x * 1.6, w.y * 1.6, w.z * 5.5) + vec3(uTime * 0.02, 0.0, 0.0));
    float n2 = fbm(vec3(w.xy * 3.0, w.z * 14.0));
    atm = vec3(1.0, 0.82, 0.55); atmK = 0.8;
    vec3 c = mix(vec3(0.66,0.47,0.24), vec3(0.90,0.80,0.60), smoothstep(0.25, 0.75, n));
    c *= 0.86 + 0.26 * n2;
    return c;
  } else if (uType == 2) {
    float h = fbm(p * 1.9 + 3.0) + 0.25 * fbm(p * 7.0) + 0.05 * fbm(p * 19.0) + 0.02 * fine * uLod;
    float land = smoothstep(0.665, 0.685, h);
    float ice = smoothstep(0.80, 0.86, abs(lat) + 0.05 * fbm(p*6.0));
    vec3 oc = mix(vec3(0.005,0.035,0.14), vec3(0.02,0.17,0.36), smoothstep(0.4, 0.665, h));
    oc += vec3(0.0, 0.10, 0.10) * smoothstep(0.63, 0.665, h);                 // shallow shelves
    float veg = fbm(p * 5.0 + 9.0), dry = smoothstep(0.42, 0.14, abs(abs(lat) - 0.36)) * smoothstep(0.35, 0.6, fbm(p * 3.0 + 4.0));
    vec3 lc = mix(vec3(0.07,0.20,0.05), vec3(0.24,0.30,0.10), smoothstep(0.35, 0.65, veg));
    lc = mix(lc, vec3(0.62,0.48,0.28), dry);
    lc = mix(lc, vec3(0.42,0.36,0.30), smoothstep(0.76, 0.86, h));             // mountains
    lc = mix(lc, vec3(0.95), smoothstep(0.86, 0.92, h));                       // snow caps
    lc *= 0.85 + 0.5 * fbm(p * 26.0);
    vec3 c = mix(oc, lc, land);
    c = mix(c, vec3(0.92,0.95,1.0), ice);
    vec3 cp = p + 0.06 * vec3(fbm(p * 5.0 + 2.0), fbm(p * 5.0 + 6.0), 0.0);
    float cl = smoothstep(0.50, 0.76, fbm(cp * 3.2 + vec3(uTime * 0.012, 0.0, uTime*0.006)) + 0.10 * fine);
    cl *= 0.75 + 0.5 * fbm(cp * 14.0 + uTime * 0.01);
    c = mix(c, vec3(1.0), clamp(cl, 0.0, 1.0) * 0.92);
    spec = (1.0 - land) * (1.0 - cl) * (1.0 - ice);
    night = vec3(1.0, 0.62, 0.25) * land * (1.0 - cl) * (1.0 - ice) * smoothstep(0.60, 0.78, vnoise(p * 55.0) * (0.6 + 0.8 * fbm(p * 9.0))) * 1.6;
    atm = vec3(0.30, 0.58, 1.0); atmK = 1.5;
    return c;
  } else if (uType == 3) {
    float n = fbm(p * 3.0 + 1.0); float m = fbm(p * 9.0);
    vec3 c = mix(vec3(0.42,0.15,0.06), vec3(0.82,0.42,0.20), n);
    c = mix(c, vec3(0.26,0.13,0.09), smoothstep(0.55, 0.72, fbm(p * 2.1 + 12.0)) * 0.65);   // dark basalt plains
    c *= 0.78 + 0.34 * m;
    c *= 1.0 + craters(p, 9.0) * 0.9;
    c *= 1.0 + fine * 0.4 * uLod;
    c = mix(c, vec3(0.95,0.92,0.9), smoothstep(0.86, 0.91, abs(lat) + 0.05 * fbm(p * 8.0)));
    atm = vec3(1.0, 0.55, 0.35); atmK = 0.4;
    return c;
  } else if (uType == 4 || uType == 5) {
    vec3 w = p + 0.05 * vec3(fbm(p * 6.0 + uTime * 0.01), fbm(p * 6.0 + 3.0), 0.0);
    float turb = fbm(w * vec3(3.0, 3.0, 1.0) * 2.0 + vec3(uTime * 0.01, 0.0, 0.0));
    float la = w.z + 0.035 * (fbmH(w * vec3(9.0, 9.0, 2.0)) - 0.5);
    float bands = sin(la * (uType == 4 ? 21.0 : 15.0) + turb * 3.2);
    vec3 a = uType == 4 ? vec3(0.90,0.83,0.70) : vec3(0.92,0.84,0.62);
    vec3 b = uType == 4 ? vec3(0.56,0.34,0.20) : vec3(0.76,0.62,0.40);
    vec3 c = mix(b, a, smoothstep(-0.7, 0.7, bands));
    c = mix(c, uType == 4 ? vec3(0.80,0.62,0.48) : vec3(0.88,0.78,0.56), 0.35 * sin(la * 47.0 + turb * 9.0) + 0.0);
    c *= 0.84 + 0.32 * fbmH(w * vec3(7.0, 7.0, 26.0) + vec3(uTime * 0.015, 0.0, 0.0));
    c *= 1.0 + 0.07 * sin(la * 150.0 + turb * 16.0) * uLod;
    if (uType == 4) {
      vec2 sp = vec2(atan(p.y, p.x), lat);
      vec2 dd = vec2(mod(sp.x - 1.0 + PI, TAU) - PI, (sp.y + 0.36) * 2.4);
      float r2 = dot(dd, dd), grs = exp(-r2 * 28.0);
      float swirl = 0.5 + 0.5 * sin(atan(dd.y, dd.x) * 2.0 + sqrt(r2) * 46.0 - uTime * 0.2);
      c = mix(c, mix(vec3(0.72,0.28,0.15), vec3(0.88,0.48,0.30), swirl), grs * 0.92);
      c = mix(c, vec3(0.95,0.90,0.80), exp(-pow((sqrt(r2) - 0.27) * 22.0, 2.0)) * 0.35);
    }
    atm = c; atmK = 0.4;
    return c;
  } else if (uType == 6) {
    float bands = sin(lat * 10.0 + fbm(p*3.0) * 1.5);
    atm = vec3(0.6, 0.95, 1.0); atmK = 0.8;
    vec3 c = mix(vec3(0.50,0.80,0.85), vec3(0.66,0.90,0.94), 0.5 + 0.5 * bands);
    c *= 0.94 + 0.12 * fbmH(p * vec3(4.0, 4.0, 18.0));
    return c;
  } else {
    float bands = sin(lat * 13.0 + fbm(p * 3.0 + uTime*0.01) * 2.5);
    vec3 c = mix(vec3(0.10,0.21,0.66), vec3(0.24,0.42,0.92), 0.5 + 0.5 * bands);
    c *= 0.88 + 0.24 * fbmH(p * vec3(5.0, 5.0, 20.0));
    vec2 dd = vec2(mod(atan(p.y, p.x) + 2.0 + PI, TAU) - PI, (lat + 0.3) * 3.0);
    c = mix(c, vec3(0.05,0.1,0.35), exp(-dot(dd,dd) * 30.0) * 0.8);
    c = mix(c, vec3(0.9,0.95,1.0), smoothstep(0.70, 0.84, fbmH(p * vec3(6.0, 6.0, 2.0) * 1.5 + vec3(uTime * 0.01, 0.0, 0.0))) * 0.6);
    atm = vec3(0.35, 0.55, 1.0); atmK = 0.9;
    return c;
  }
}

void main(){
  vec3 rd = normalize(vPos);
  vec3 c = uCenterV;
  float b = dot(rd, c);
  if (b <= 0.0) discard;
  float c2 = dot(c, c) - b*b;
  float R2 = uR * uR;
  float pw = b / uFocal;
  float edge = uR - sqrt(max(c2, 0.0));
  float aEdge = clamp(edge / pw + 0.5, 0.0, 1.0);
  if (aEdge <= 0.0) discard;
  vec3 hit, N;
  if (c2 >= R2) { N = normalize(rd * b - c); hit = c + N * uR; }
  else { float t = b - sqrt(R2 - c2); hit = rd * t; N = (hit - c) / uR; }
  vec4 clip = uProj * vec4(hit, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

  vec3 V = -rd;
  float mu = max(dot(N, V), 0.0);
  vec3 Nw = transpose(mat3(uView)) * N;
  vec3 l = transpose(uBasis) * Nw;
  float cs = cos(uSpin), sn = sin(uSpin);
  vec3 p = vec3(cs*l.x - sn*l.y, sn*l.x + cs*l.y, l.z);
  float lat = l.z;

  if (uType == 8) {
    float g = fbm(p * 16.0 + vec3(0.0, uTime * 0.04, uTime*0.02));
    float g2 = fbm(p * 5.0 - vec3(uTime * 0.015));
    float limb = pow(mu, 0.45);
    vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.86, 0.58), limb);
    col *= 0.72 + 0.45 * g + 0.25 * g2;
    col *= 1.0 + (fbmH(p * 52.0 + vec3(0.0, uTime * 0.05, 0.0)) - 0.5) * 0.55 * uLod;
    float spot = smoothstep(0.70, 0.78, fbm(p * 3.6 + 2.0)) * (1.0 - smoothstep(0.35, 0.75, abs(lat)));
    col *= 1.0 - 0.72 * spot;
    col *= uEmis * (1.0 + uAudio * 0.6);
    col *= uColor / vec3(1.0, 0.8, 0.4);
    if (uStyle == 2) {
      vec2 sp = vec2(atan(p.y, p.x), asin(clamp(lat,-1.0,1.0)));
      vec2 gg = abs(fract(sp * vec2(12.0, 8.0) / PI) - 0.5);
      float ln = 1.0 - smoothstep(0.0, 0.06, min(gg.x, gg.y));
      col = mix(col * 0.5, vec3(1.0,0.8,0.4) * uEmis * 1.5, ln);
    }
    o = vec4(col * aEdge, aEdge);
    return;
  }

  vec3 L = normalize(uSunV - hit);
  vec3 Nb = N;
  if (uStyle == 0 && uLod > 0.02 && (uType == 0 || uType == 3)) {
    float e = 0.004, h0 = heightOf(p);
    vec3 g = vec3(heightOf(p + vec3(e, 0.0, 0.0)) - h0, heightOf(p + vec3(0.0, e, 0.0)) - h0, heightOf(p + vec3(0.0, 0.0, e)) - h0) / e;
    g -= p * dot(g, p);
    vec3 pb = normalize(p - g * 0.055 * uLod);
    vec3 lb = vec3(cs * pb.x + sn * pb.y, -sn * pb.x + cs * pb.y, pb.z);
    Nb = normalize(mat3(uView) * (uBasis * lb));
  }
  float ndl = dot(N, L);
  float diff = clamp(dot(Nb, L) * 1.05 + 0.04, 0.0, 1.0) * smoothstep(-0.12, 0.10, ndl);
  float rim = pow(1.0 - mu, 3.0);
  float shadow = 1.0;
  if (uType == 5) {
    float den = dot(L, uRingN);
    if (abs(den) > 1e-4) {
      float t = dot(c - hit, uRingN) / den;
      if (t > 0.0) { float rr = length(hit + L * t - c) / uR; shadow = 1.0 - 0.75 * ringDensity(rr); }
    }
  }

  vec3 col; float alpha = aEdge;
  if (uStyle == 0) {
    float spec; vec3 night, atm; float atmK;
    vec3 alb = surface(p, lat, spec, night, atm, atmK);
    col = alb * diff * shadow * 1.28 + alb * 0.05;
    col += alb * pow(1.0 - mu, 2.0) * 0.18 * clamp(ndl + 0.5, 0.0, 1.0);
    vec3 H2 = normalize(L + V);
    col += vec3(1.0, 0.95, 0.85) * (pow(max(dot(N, H2), 0.0), 90.0) * 1.4 + pow(max(dot(N, H2), 0.0), 12.0) * 0.12) * spec * step(0.0, ndl);
    col += night * smoothstep(0.1, -0.15, ndl);
    col += atm * atmK * (rim * 1.3 + pow(1.0 - mu, 1.4) * 0.10) * clamp(ndl + 0.45, 0.0, 1.0);
  } else if (uStyle == 1) {
    col = uColor * (0.18 + diff * 0.7) + uColor * pow(rim + 0.05, 1.3) * 3.2;
    col += vec3(1.0) * pow(max(ndl,0.0), 12.0) * 0.4;
  } else {
    vec2 sp = vec2(atan(p.y, p.x), asin(clamp(lat,-1.0,1.0)));
    vec2 f = sp * vec2(12.0, 9.0) / PI;
    vec2 gg = abs(fract(f) - 0.5); vec2 fw = fwidth(f) * 1.2;
    float ln = 1.0 - smoothstep(0.0, 1.0, min(gg.x / max(fw.x,1e-4), gg.y / max(fw.y,1e-4)) * 0.5);
    float k = clamp(ln * 0.9 + rim * 1.2 + 0.12, 0.0, 1.0);
    col = uColor * (ln * 2.2 + rim * 2.0 + 0.1) * (0.5 + 0.5 * diff);
    alpha *= k;
  }
  o = vec4(col * alpha, alpha);
}`;

const FS_CORONA = H + NOISE + `
in vec3 vPos; in vec2 vQ; out vec4 o;
uniform float uTime, uGain, uAudio; uniform vec3 uTint;
void main(){
  float r = length(vQ);
  if (r > 1.0) discard;
  float ang = atan(vQ.y, vQ.x);
  float rays = fbm3(vec3(cos(ang) * 3.0, sin(ang) * 3.0, uTime * 0.12 - r * 2.0));
  float core = exp(-r * 13.0) * 4.0;
  float halo = exp(-r * 5.0) * (0.7 + 0.6 * rays) * 0.9;
  float wide = exp(-r * 2.2) * 0.12;
  float st = pow(max(0.0, 1.0 - abs(vQ.y) * 30.0), 2.0) * exp(-abs(vQ.x) * 2.5) * 0.25;
  float f = (core + halo + wide + st) * (1.0 - smoothstep(0.85, 1.0, r));
  o = vec4(uTint * f * uGain * (1.0 + uAudio * 0.8), 0.0);
}`;

// ── planetary rings ──
const VS_RING = H + `
uniform mat4 uVP; uniform vec3 uCenter, uA1, uA2; uniform float uR, uOut;
out vec2 vQ; out vec3 vW;
void main(){
  vec2 c = vec2((gl_VertexID == 1 || gl_VertexID == 3) ? 1.0 : -1.0, (gl_VertexID >= 2) ? 1.0 : -1.0) * uOut;
  vec3 w = uCenter + (uA1 * c.x + uA2 * c.y) * uR;
  vQ = c; vW = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_RING = H + NOISE + `
in vec2 vQ; in vec3 vW; out vec4 o;
uniform vec3 uCenter, uSun, uCam, uN, uTint; uniform float uR; uniform int uType, uStyle;
float ringDensity(float r){
  if (uType == 5) {
    float d = 0.0;
    d += 0.22 * smoothstep(1.24, 1.26, r) * (1.0 - smoothstep(1.52, 1.53, r));
    d += 0.92 * smoothstep(1.52, 1.54, r) * (1.0 - smoothstep(1.94, 1.95, r));
    d += 0.62 * smoothstep(2.02, 2.03, r) * (1.0 - smoothstep(2.26, 2.27, r));
    d *= 1.0 - 0.8 * (smoothstep(2.205, 2.21, r) - smoothstep(2.22, 2.225, r));
    d *= 0.82 + 0.18 * sin(r * 150.0) * sin(r * 47.0);
    return d;
  }
  float d = 0.0;
  d += exp(-pow((r - 1.62) * 90.0, 2.0)); d += exp(-pow((r - 1.72) * 90.0, 2.0));
  d += exp(-pow((r - 1.84) * 80.0, 2.0)); d += 1.2 * exp(-pow((r - 2.0) * 60.0, 2.0));
  return d * 0.35;
}
void main(){
  float r = length(vQ);
  float d = ringDensity(r);
  if (d < 0.005) discard;
  vec3 toSun = normalize(uSun - vW);
  vec3 oc = vW - uCenter;
  float b = dot(oc, toSun); float c = dot(oc, oc) - uR*uR; float disc = b*b - c;
  float sh = (disc > 0.0 && -b - sqrt(disc) > 0.0) ? 0.06 : 1.0;
  float sideL = dot(uN, toSun); float sideV = dot(uN, uCam - vW);
  float lit = sideL * sideV > 0.0 ? 1.0 : 0.38;
  vec3 col = uType == 5 ? mix(vec3(0.70,0.62,0.50), vec3(0.95,0.88,0.74), smoothstep(1.5, 2.0, r)) : vec3(0.6,0.8,0.85);
  if (uStyle != 0) col = uTint * 1.6;
  col *= (0.85 + 0.3 * vnoise(vec3(r * 60.0, 0.0, 0.0))) * lit * sh * 1.25;
  float a = clamp(d * 0.9, 0.0, 0.95);
  o = vec4(col * a, a);
}`;

// ── analytic helical trails ──
const PATH = `
uniform float uTheta, uOmega, uRg, uAmp, uK, uCosT, uSinT;
vec3 sunAt(float age){ float th = uTheta - uOmega * age; return vec3(uRg * cos(th), uAmp * sin(uK * th), uRg * sin(th)); }
vec3 pathPos(float age, float R, float phase, float w){
  float th = uTheta - uOmega * age;
  float c = cos(th), s = sin(th);
  vec3 S = vec3(uRg * c, uAmp * sin(uK * th), uRg * s);
  vec3 rh = vec3(c, 0.0, s);
  vec3 e2 = vec3(-s * uCosT, uSinT, c * uCosT);
  float ph = phase - w * age;
  return S + R * (cos(ph) * rh + sin(ph) * e2);
}
`;
const VS_TRAIL = H + PATH + `
uniform mat4 uVP; uniform vec2 uViewport; uniform float uFocal;
uniform float uR, uPhase, uW, uAge0, uAge1, uSegs, uWidth, uWorldW;
out float vS; out float vSide;
void main(){
  int vid = gl_VertexID;
  float endF = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  float side = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : -1.0;
  float seg = float(gl_InstanceID);
  float s0 = seg / uSegs, s1 = (seg + 1.0) / uSegs;
  vec4 c0 = uVP * vec4(pathPos(mix(uAge0, uAge1, s0), uR, uPhase, uW), 1.0);
  vec4 c1 = uVP * vec4(pathPos(mix(uAge0, uAge1, s1), uR, uPhase, uW), 1.0);
  const float NW = 0.02;
  if (c0.w < NW && c1.w < NW) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vS = 1.0; vSide = 0.0; return; }
  if (c0.w < NW) c0 = mix(c0, c1, (NW - c0.w) / (c1.w - c0.w));
  if (c1.w < NW) c1 = mix(c1, c0, (NW - c1.w) / (c0.w - c1.w));
  vec2 p0 = c0.xy / c0.w * uViewport * 0.5, p1 = c1.xy / c1.w * uViewport * 0.5;
  vec2 d = p1 - p0; float L = length(d);
  vec2 dir = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = endF > 0.5 ? c1 : c0;
  float w = max(uWidth, uWorldW * uFocal / c.w);
  vec2 off = nrm * side * w * 0.5 + dir * (endF > 0.5 ? 0.5 : -0.5) * min(w * 0.3, 2.0);
  c.xy += off / (uViewport * 0.5) * c.w;
  gl_Position = c;
  vS = mix(s0, s1, endF); vSide = side;
}`;
const FS_TRAIL = H + `
in float vS; in float vSide; out vec4 o;
uniform vec3 uColor, uColor2; uniform float uGain, uFadePow, uHead, uDash, uStyle, uSegs;
void main(){
  float x = vSide;
  float core = exp(-x * x * 26.0);
  float halo = exp(-x * x * 3.5);
  float prof = uStyle == 1.0 ? exp(-x*x*9.0) : core * 1.0 + halo * 0.32;
  float fade = uFadePow > 0.0 ? pow(max(1.0 - vS, 0.0), uFadePow) : 1.0;
  fade *= smoothstep(1.0, 0.97, vS);
  if (uDash > 0.0) fade *= step(0.45, fract(vS * uDash));
  if (uStyle == 2.0) { float k = fract(vS * uSegs * 0.125); fade *= pow(1.0 - abs(k - 0.5) * 2.0, 6.0) * 2.5; }
  float head = uHead * exp(-vS * 70.0);
  vec3 col = mix(uColor, uColor2, vS);
  o = vec4(col * prof * (fade + head) * uGain, 0.0);
}`;

// ── drop lines from the solar path to the galactic plane ──
const VS_DROP = H + PATH + `
uniform mat4 uVP; uniform vec2 uViewport; uniform float uStep, uCount, uWidth;
out float vK; out float vT; out float vSide;
void main(){
  int vid = gl_VertexID;
  float endF = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  float side = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : -1.0;
  float k = float(gl_InstanceID);
  vec3 top = sunAt(k * uStep);
  vec3 bot = vec3(top.x, 0.0, top.z);
  vec4 c0 = uVP * vec4(top, 1.0), c1 = uVP * vec4(bot, 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vK = 1.0; vT = 0.0; vSide = 0.0; return; }
  vec2 p0 = c0.xy / c0.w * uViewport * 0.5, p1 = c1.xy / c1.w * uViewport * 0.5;
  vec2 d = p1 - p0; float L = length(d);
  vec2 dir = L > 1e-5 ? d / L : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = endF > 0.5 ? c1 : c0;
  c.xy += nrm * side * uWidth * 0.5 / (uViewport * 0.5) * c.w;
  gl_Position = c;
  vK = k / uCount; vT = endF; vSide = side;
}`;
const FS_DROP = H + `
in float vK; in float vT; in float vSide; out vec4 o;
uniform vec3 uColor; uniform float uGain;
void main(){
  float a = pow(1.0 - vK, 1.4) * (1.0 - vT * 0.75) * exp(-vSide * vSide * 3.0);
  o = vec4(uColor * a * uGain, 0.0);
}`;

// ── galactic plane polar grid ──
const VS_PLANE = H + `
uniform mat4 uVP; uniform float uSize; out vec2 vP;
void main(){ vec2 c = vec2((gl_VertexID == 1 || gl_VertexID == 3) ? 1.0 : -1.0, (gl_VertexID >= 2) ? 1.0 : -1.0) * uSize;
  vP = c; gl_Position = uVP * vec4(c.x, 0.0, c.y, 1.0); }`;
const FS_PLANE = H + `
in vec2 vP; out vec4 o; uniform vec3 uColor; uniform float uGain, uSize, uSunR;
void main(){
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  float rr = r / 250.0;
  float fr = fwidth(rr);
  float ring = 1.0 - smoothstep(0.0, fr * 1.5, abs(fract(rr + 0.5) - 0.5));
  float sp = a / (TAU / 24.0);
  float fs = fwidth(sp);
  float spoke = (1.0 - smoothstep(0.0, fs * 1.5, abs(fract(sp + 0.5) - 0.5))) * smoothstep(80.0, 260.0, r);
  float sunRing = 1.0 - smoothstep(0.0, fwidth(r) * 2.0, abs(r - uSunR));
  float g = max(ring * 0.8, spoke * 0.45) + sunRing * 1.2;
  g *= smoothstep(uSize, uSize * 0.55, r);
  o = vec4(uColor * g * uGain, 0.0);
}`;

// ── heliosphere shell ──
const VS_HELIO = H + NOISE + `
layout(location=0) in vec3 aDir;
uniform mat4 uVP; uniform vec3 uSun, uM, uB1, uB2; uniform float uR0, uScale, uTime;
out vec3 vW; out vec3 vN; out vec3 vL;
void main(){
  vec3 d = aDir;
  vec3 wd = d.x * uM + d.y * uB1 + d.z * uB2;
  float cth = d.x;
  float tail = pow(max(0.0, -cth), 1.35);
  float r = uR0 * uScale * (1.0 + 1.9 * tail) * (1.0 - 0.10 * max(cth, 0.0));
  r *= 1.0 + 0.015 * sin(atan(d.z, d.y) * 3.0 + uTime * 0.4 + cth * 4.0) * (1.0 - cth);
  vec3 w = uSun + wd * r;
  vW = w; vN = wd; vL = d;
  gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_HELIO = H + NOISE + `
in vec3 vW; in vec3 vN; in vec3 vL; out vec4 o;
uniform vec3 uCam; uniform float uTime, uGain, uLayer;
void main(){
  vec3 V = normalize(uCam - vW);
  vec3 Nt = normalize(cross(dFdx(vW), dFdy(vW)));
  float f = 1.0 - abs(dot(Nt, V));
  float fres = pow(f, 3.2);
  float cth = vL.x;
  float az = atan(vL.z, vL.y);
  float flow = fbm3(vec3(acos(clamp(cth,-1.0,1.0)) * 3.0 - uTime * 0.35, cos(az) * 2.0, sin(az) * 2.0));
  float streak = 0.55 + 0.9 * smoothstep(0.35, 0.8, flow);
  vec3 nose = vec3(1.0, 0.42, 0.16), body = vec3(0.22, 0.62, 1.0), tailc = vec3(0.35, 0.3, 0.95);
  vec3 col = mix(body, nose, smoothstep(0.05, 0.8, cth));
  col = mix(col, tailc, smoothstep(-0.2, -0.9, cth));
  float a;
  if (uLayer < 0.5) a = fres * streak * 0.9 + 0.006;
  else if (uLayer < 1.5) { col = vec3(0.4, 0.9, 1.0); a = fres * 0.35; }
  else { col = vec3(1.0, 0.35, 0.18); a = fres * smoothstep(-0.3, 0.6, cth) * 0.55 * streak; }
  o = vec4(col * a * uGain, 0.0);
}`;

// ── interstellar wind streaks around the heliosphere ──
const VS_ISM = H + `
uniform mat4 uVP; uniform vec2 uViewport; uniform vec3 uSun, uM, uB1, uB2; uniform float uR0, uTime;
out float vA; out float vSide;
float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
float halfW(float x){
  float xn = x / uR0;
  if (xn > 1.0) return 0.0;
  float w = sqrt(clamp(1.0 - xn, 0.0, 2.0)) * 1.05;
  if (xn < 0.0) w = 1.05 * sqrt(1.0 - xn) * (1.0 + 0.25 * (-xn));
  return w * uR0 * 1.15;
}
vec3 flowPos(float x, float b, float psi){
  float rho = sqrt(b * b + pow(halfW(x), 2.0));
  return uSun + uM * x + (uB1 * cos(psi) + uB2 * sin(psi)) * rho;
}
void main(){
  int vid = gl_VertexID;
  float endF = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  float side = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : -1.0;
  float id = float(gl_InstanceID);
  float b = uR0 * 2.6 * sqrt(h1(id + 1.3)) + uR0 * 0.05;
  float psi = h1(id + 7.9) * TAU;
  float span = uR0 * 9.0;
  float ph = fract(h1(id + 3.3) + uTime * (0.035 + 0.02 * h1(id + 11.0)));
  float x0 = uR0 * 3.0 - ph * span;
  float len = uR0 * 0.22;
  float xa = x0, xb = x0 + len;
  vec4 c0 = uVP * vec4(flowPos(xa, b, psi), 1.0), c1 = uVP * vec4(flowPos(xb, b, psi), 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) { gl_Position = vec4(2.0,2.0,2.0,1.0); vA = 0.0; vSide = 0.0; return; }
  vec2 p0 = c0.xy / c0.w * uViewport * 0.5, p1 = c1.xy / c1.w * uViewport * 0.5;
  vec2 d = p1 - p0; float L = length(d); vec2 dir = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = endF > 0.5 ? c1 : c0;
  c.xy += nrm * side * 1.6 / (uViewport * 0.5) * c.w;
  gl_Position = c;
  float edge = smoothstep(0.0, 0.12, ph) * smoothstep(1.0, 0.8, ph);
  vA = edge * (endF > 0.5 ? 0.0 : 1.0); vSide = side;
}`;
const FS_ISM = H + `
in float vA; in float vSide; out vec4 o; uniform float uGain;
void main(){ o = vec4(vec3(0.55, 0.75, 1.0) * vA * exp(-vSide*vSide*2.5) * uGain, 0.0); }`;

// ── spacetime fabric sheet ──
const VS_FABRIC = H + `
layout(location=0) in vec2 aUV;
uniform mat4 uVP; uniform vec3 uSun, uE1, uE2, uN; uniform float uL, uDK; uniform vec4 uMass[9]; uniform vec4 uWave;
out vec2 vQ; out float vDepth; out float vR;
float well(vec2 q){
  float d = 0.0;
  for (int i = 0; i < 9; i++){ vec4 m = uMass[i]; vec2 dq = q - m.xy; d += m.z / sqrt(dot(dq, dq) + m.w * m.w); }
  return d;
}
void main(){
  vec2 q = aUV * uL;
  float d = max(well(q) - well(vec2(uL, 0.0)), 0.0);
  float rr = length(q);
  d += uWave.x * sin(rr * uWave.y - uWave.z + 2.0 * atan(q.y, q.x)) * smoothstep(uWave.w, uWave.w + 9.0, rr) * (1.0 - smoothstep(uL * 0.72, uL, rr));
  vec3 w = uSun + uE1 * q.x + uE2 * q.y - uN * (d * uDK);
  vQ = q; vDepth = d; vR = length(q);
  gl_Position = uVP * vec4(w, 1.0);
}`;
const FS_FABRIC = H + `
in vec2 vQ; in float vDepth; in float vR; out vec4 o;
uniform float uL, uSpacing, uGain, uTime; uniform vec2 uScroll; uniform vec3 uColor; uniform float uOrb[8];
void main(){
  vec2 g = (vQ + uScroll) / uSpacing;
  vec2 fw = fwidth(g);
  vec2 gd = abs(fract(g + 0.5) - 0.5) / max(fw, vec2(1e-4));
  float line = 1.0 - smoothstep(0.0, 1.4, min(gd.x, gd.y));
  float fade = smoothstep(uL, uL * 0.45, vR);
  float glow = 1.0 + vDepth * 0.06;
  float orb = 0.0;
  for (int i = 0; i < 8; i++){ float dd = abs(vR - uOrb[i]); orb += 1.0 - smoothstep(0.0, fwidth(vR) * 1.8, dd); }
  vec3 col = uColor * (line * 0.85 * glow + 0.035) + vec3(1.0, 0.85, 0.6) * orb * 0.35;
  float pulse = 0.5 + 0.5 * sin(vR * 0.35 - uTime * 1.2);
  col += uColor * 0.06 * pulse * smoothstep(uL*0.6, 0.0, vR);
  o = vec4(col * fade * uGain, 0.0);
}`;

// ── post processing ──
const FS_PRE = H + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThresh;
vec3 tap(vec2 uv){ vec3 c = texture(uTex, uv).rgb; float br = max(c.r, max(c.g, c.b)); float knee = uThresh * 0.6;
  float soft = clamp(br - uThresh + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - uThresh) / max(br, 1e-4); return min(c * contrib, vec3(60.0)); }
void main(){ vec2 h = uTexel; o = vec4((tap(vUv + vec2(-h.x,-h.y)) + tap(vUv + vec2(h.x,-h.y)) + tap(vUv + vec2(-h.x,h.y)) + tap(vUv + vec2(h.x,h.y))) * 0.25, 1.0); }`;
const FS_DOWN = H + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec2 h = uTexel;
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += texture(uTex, vUv + vec2(-h.x,-h.y)).rgb + texture(uTex, vUv + vec2(h.x,-h.y)).rgb;
  s += texture(uTex, vUv + vec2(-h.x,h.y)).rgb + texture(uTex, vUv + vec2(h.x,h.y)).rgb;
  o = vec4(s / 8.0, 1.0); }`;
const FS_UP = H + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uW;
void main(){ vec2 h = uTexel;
  vec3 s = texture(uTex, vUv + vec2(-h.x*2.0, 0.0)).rgb + texture(uTex, vUv + vec2(h.x*2.0, 0.0)).rgb;
  s += texture(uTex, vUv + vec2(0.0, -h.y*2.0)).rgb + texture(uTex, vUv + vec2(0.0, h.y*2.0)).rgb;
  s += (texture(uTex, vUv + vec2(-h.x,-h.y)).rgb + texture(uTex, vUv + vec2(h.x,-h.y)).rgb + texture(uTex, vUv + vec2(-h.x,h.y)).rgb + texture(uTex, vUv + vec2(h.x,h.y)).rgb) * 2.0;
  o = vec4(s / 12.0 * uW, 1.0); }`;
const FS_COMP = H + `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom; uniform float uBloomStr, uExposure, uTime, uGrain, uVig, uCA; uniform vec2 uRes;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 dc = vUv - 0.5; float r2 = dot(dc, dc);
  vec3 col;
  if (uCA > 0.0) { vec2 off = dc * r2 * uCA; col = vec3(texture(uScene, vUv - off).r, texture(uScene, vUv).g, texture(uScene, vUv + off).b); }
  else col = texture(uScene, vUv).rgb;
  col += texture(uBloom, vUv).rgb * uBloomStr;
  col *= uExposure;
  col = aces(col);
  col *= mix(1.0, smoothstep(0.75, 0.12, r2), uVig);
  col = pow(col, vec3(1.0 / 2.2));
  float n = hash(vUv * uRes + fract(uTime * 7.13) * 311.0) - 0.5;
  col += n * (uGrain * 0.035 + 1.5 / 255.0);
  o = vec4(col, 1.0);
}`;

window.SH = { VS_FULL, FS_NEBGEN, FS_SKY, VS_SKYSTARS, FS_POINT, VS_GALAXY, FS_GALAXY, FS_BH, VS_BILL, FS_BODY, FS_CORONA,
  VS_RING, FS_RING, VS_TRAIL, FS_TRAIL, VS_DROP, FS_DROP, VS_PLANE, FS_PLANE, VS_HELIO, FS_HELIO, VS_ISM, FS_ISM,
  VS_FABRIC, FS_FABRIC, FS_PRE, FS_DOWN, FS_UP, FS_COMP };
})();
