# Orbital Loom X: the maths behind the motion

This document explains how the wallpaper computes what you see. Distances and times are
compressed artistically so everything fits in one frame. The geometry and the relationships
between the parts are real.

---

## 1. The Sun's galactic orbit

The galactic centre (Sagittarius A\*) is the origin, and the galactic disc is the `xz` plane.
The Sun's position at galactic angle θ is

```
S(θ) = ( R_G cos θ ,  A sin(K θ) ,  R_G sin θ )
```

| symbol | meaning | value used |
|---|---|---|
| `R_G` | Sun's distance from the centre | 600 world units (~26,000 ly in reality) |
| `A` | amplitude of the up-and-down oscillation through the disc | `waveAmplitude` option (default 40) |
| `K` | number of oscillations per lap (must be an integer so the path closes) | `waveCount` option (default 4) |

θ advances at `ω = v / R_G`, where `v` is the `sunVelocity` option. In reality, one lap
(a *galactic year*) takes about 230 million years at ~230 km/s.

## 2. The tilted planetary plane

The planets orbit in the ecliptic, which is tilted **≈ 60.2°** to the galactic plane. At angle θ the
engine builds an orthonormal basis that travels with the Sun:

```
r̂(θ)  = ( cos θ, 0, sin θ )                          radial (away from the centre)
t̂(θ)  = (−sin θ, 0, cos θ )                          direction of motion
ê₂(θ) = cos T · t̂ + sin T · ŷ          with T = 60.2°
n̂     = r̂ × ê₂                                       ecliptic normal
```

## 3. The helix of each planet

A planet with orbital radius `R` and angular speed `w = 2π / P` (`P` is the period) sits at

```
X(age) = S(θ − ω·age) + R · ( cos φ(age) · r̂(θ − ω·age) + sin φ(age) · ê₂(θ − ω·age) )
φ(age) = φ₀ − w · age
```

`age` is how far back in time a trail point is. Because the Sun moves while the planet circles it,
`X(age)` traces a **helix** instead of a closed ellipse. Fast inner planets give tight coils; slow outer
planets give long, open ones.

Periods come from Kepler's third law (`P² ∝ R³`). The *Artistic* model compresses them as
`P^0.65` so Neptune still moves visibly. The *Real Kepler ratios* model uses `P` unchanged.

### Drawn on the GPU, not stored

The trails are not lists of past positions. Each trail is a set of instanced segments. The vertex
shader (`VS_TRAIL` in `shaders.js`) evaluates `X(age)` for both ends of its segment, projects them,
and expands them into a screen-space ribbon. Any trail length or speed therefore stays perfectly smooth.
θ and the planet phases are wrapped modulo 2π on the CPU, so precision never degrades over time.

A trail starts at the body's centre. Where the path runs toward the camera, that start would show as
a bright dot on the planet's face, so the shader fades each trail out within about one body radius of
its head (`uClear`).

## 4. Moons

Each moon orbits its parent in the parent's equatorial plane, which uses the real axial tilt, so
Uranus's moons circle almost vertically. Earth's Moon is the exception and uses the ecliptic. Moon
periods are compressed as `(days / 365.25)^0.3`, so Io visibly outruns Callisto without strobing.
Sizes are real ratios to the parent, with a small minimum so they stay visible.

## 5. Ray-marched black hole

For each pixel the black hole shader (`FS_BH`) integrates a light ray in the Schwarzschild field,
using the standard photon-orbit acceleration in units where the Schwarzschild radius is `r_s`:

```
d²x/dλ² = −1.5 · h² · x / |x|⁵        h = |x × v|  (conserved angular momentum)
```

The ray is stepped adaptively (small steps near the hole). It stops when it falls inside `r_s`
(black), crosses the accretion disc between `3 r_s` and `11.5 r_s`, or escapes. On the disc, colour
and brightness depend on radius (temperature) and on **Doppler beaming**: the side moving toward the
camera is brighter and bluer. Rays that pass close to the hole bend around it. That is why the far side
of the disc appears arched over and under the shadow, and why a thin **photon ring** circles it.

## 6. Spacetime fabric

The grid is an *embedding diagram*: an illustration in which depth stands for gravitational
potential. It is not a literal picture of curved space. Each mass `mᵢ` at `pᵢ` digs a softened well:

```
depth(q) = Σᵢ mᵢ / √( |q − pᵢ|² + εᵢ² )  −  depth(edge)
```

`εᵢ` (softening) keeps the bottom of each well finite. In the Kilonova and Cosmic Symphony stories,
a travelling wave is added to show gravitational radiation:

```
+ a · sin( k·|q − c| − ω t + 2·angle(q − c) )
```

Its amplitude grows as the two neutron stars spiral in. This is the "chirp" that LIGO hears.

## 7. Kilonova inspiral

The separation of the two neutron stars shrinks as `a(t) = a₀ (1 − t/T)^¼`. This is the leading-order
result for a circular binary that loses energy to gravitational waves. The orbital angular speed
follows Kepler, `ω ∝ a^(−3/2)`, so the stars speed up dramatically just before they merge.

## 8. Three-body problem

Three point masses are integrated with semi-implicit (symplectic) Euler steps, using 8 sub-steps per
frame and softened gravity `F = G m₁ m₂ r / (r² + ε²)^{3/2}`. The total momentum is set to zero at the
start so the system stays centred. Each run starts from slightly randomised positions, and the
motion is chaotic, so no two runs look the same.

## 9. Rendering pipeline

1. **HDR scene** in a 16-bit float buffer:
   - procedural nebula sky and about 150k galaxy particles;
   - ray-traced planet impostors, which write their own depth;
   - rings, trails and glows.
2. **Bloom**: a bright-pass threshold, then a dual-filter down/up blur chain. Any non-finite pixel is
   discarded first, so a driver glitch cannot spread across the frame.
3. **Composite**: ACES tone mapping, vignette, film grain and slight chromatic aberration.
4. **Dynamic resolution** (*Auto performance*): the render scale drops when frames run long and creeps
   back up when there is headroom, capped at 3840×2160.

Planet surfaces have a light build that compiles instantly and a detailed build (8-octave noise,
craters, relief lighting) that compiles in the background and swaps in when it is ready. Optional
photographic maps (Solar System Scope, CC BY 4.0) replace the procedural albedo.

## 10. Audio reactivity

Inside Lively Wallpaper, `livelyAudioListener(spectrum)` receives the system audio spectrum. The
engine averages the first 16 bands into a smoothed level `sim.audio` (0 to 1), which drives:

- trail brightness;
- the Sun's surface and the black hole's disc;
- the galaxy's glow;
- the pulsar's flashes;
- the gravitational-wave amplitude on the spacetime fabric.

Turn it off with the *Audio reactive* option.

---

© 2026 Y.A Al-Kmali · MIT License
