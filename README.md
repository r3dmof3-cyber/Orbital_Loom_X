<div align="center">

# 🌌 Orbital Loom X — الرحلة المجرية

**خلفية حية تفاعلية لبرنامج [Lively Wallpaper](https://github.com/lively-community/lively) على ويندوز**
**An interactive live wallpaper for [Lively Wallpaper](https://github.com/lively-community/lively) on Windows**

المجموعة الشمسية تنسج مسارات حلزونية وهي تسافر عبر مجرة درب التبانة. تُحسب الحركة رياضياً على كرت الشاشة (WebGL2).
*The Solar System weaving helical paths as it voyages through the Milky Way. The motion is computed on the GPU with WebGL2.*

[![Download](https://img.shields.io/badge/⬇_تحميل_Download-ZIP-f5b94a?style=for-the-badge)](https://github.com/r3dmof3-cyber/Orbital_Loom_X/raw/main/release/Orbital_Loom_X_Galactic_Voyage.zip)
[![Live Demo](https://img.shields.io/badge/▶_عرض_مباشر-Live_Demo-8a5cff?style=for-the-badge)](https://r3dmof3-cyber.github.io/Orbital_Loom_X/)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=for-the-badge)](LICENSE)

![Helical vortex](docs/screenshots/1-helical-vortex.jpg)

**برمجة وتصميم: يوسف أنور الكمالي — Yousif Anwar Alkmali — r3dmof3@gmail.com**

</div>

---

## 📥 التثبيت والتشغيل (عربي)

### الطريقة 1: ملف ZIP (موصى بها)
1. ثبّت **Lively Wallpaper** مجاناً من [Microsoft Store](https://apps.microsoft.com/detail/9ntm2qc6qws7) أو من [GitHub](https://github.com/lively-community/lively/releases).
2. حمّل الملف: **[Orbital_Loom_X_Galactic_Voyage.zip](https://github.com/r3dmof3-cyber/Orbital_Loom_X/raw/main/release/Orbital_Loom_X_Galactic_Voyage.zip)**. لا تفك الضغط.
3. افتح Lively واضغط زر **➕ Add Wallpaper**، ثم **Choose a file** واختر ملف ZIP. ويمكنك أيضاً سحب الملف وإفلاته داخل نافذة Lively.
4. اضغط على الخلفية في المكتبة لتطبيقها.
5. للتخصيص: اضغط **⋯** على الخلفية ثم **Customize**. ستجد أكثر من 30 خياراً، منها اللغة والوضع والسرعة وطول المسارات والألوان والجودة.
6. **مهم للتفاعل بالماوس:** افتح Lively ← **Settings** ← **Wallpaper** ← **Wallpaper Input** واختر **Mouse**.

### الطريقة 2: رابط مباشر بدون تحميل
في Lively اضغط **➕ Add Wallpaper**، ثم الصق الرابط التالي في خانة **Enter URL**:
```
https://r3dmof3-cyber.github.io/Orbital_Loom_X/
```
> هذه الطريقة تحتاج إنترنت ولا تعرض قائمة Customize. لذلك طريقة ZIP أفضل.

### الطريقة 3: من المصدر
حمّل المستودع (**Code → Download ZIP**) وفك الضغط، ثم اسحب ملف `index.html` إلى نافذة Lively.

---

## 🎬 اللقطات (الأوضاع)

| # | اللقطة | الوصف |
|---|--------|-------|
| 0 | 🎬 المخرج السينمائي | يتنقل تلقائياً بين اللقطات بحركة كاميرا ناعمة |
| 1 | 🌀 الدوامة الحلزونية | الكواكب ترسم لوالب خلف الشمس المندفعة |
| 2 | 〰️ المنظور الجانبي | اللوالب ممتدة مع أعمدة الارتفاع عن قرص المجرة |
| 3 | 🌌 الرحلة المجرية | درب التبانة كاملة، ومدار الشمس المتموج، وعلامات الانقراضات الخمس الكبرى |
| 4 | ⚫ الثقب الأسود A* | انحناء ضوئي محسوب (Ray-marching) وقرص تراكم بتأثير دوبلر |
| 5 | 🫧 الغلاف الشمسي | الصدمة الانتهائية، وحد الغلاف، وموجة القوس، والرياح بين النجمية |
| 6 | 🕸️ نسيج الزمكان | بئر جاذبية الشمس والكواكب تدور على مداراتها داخله |
| 7 | 🎥 كاميرا حرة | تحكم كامل بالماوس |

| | |
|---|---|
| ![](docs/screenshots/2-side-profile.jpg) | ![](docs/screenshots/3-galactic-voyage.jpg) |
| ![](docs/screenshots/4-black-hole.jpg) | ![](docs/screenshots/5-heliosphere.jpg) |
| ![](docs/screenshots/6-spacetime-fabric.jpg) | ![](docs/screenshots/hud-overview.jpg) |

## 🖱️ التحكم

| الإجراء | الوظيفة |
|---|---|
| سحب الماوس | تدوير الكاميرا |
| عجلة الماوس | تقريب أو إبعاد |
| نقر على كوكب | تتبّعه بالكاميرا |
| نقرتان | إعادة ضبط الكاميرا |
| `0`–`7` | تغيير اللقطة |
| `Space` | إيقاف الزمن مؤقتاً |
| `H` / `L` | إخفاء الواجهة أو الأسماء |
| `←` `→` / `Esc` | التنقل بين الكواكب أو إلغاء التتبع |

## ⚙️ نصائح الأداء
- إذا كان الجهاز ضعيفاً: من Customize قلل **دقة الرسم %** إلى 60–75، واختر الجودة **اقتصادي**، وحد **30 FPS**.
- Lively يوقف الخلفية تلقائياً عند تشغيل لعبة أو برنامج بملء الشاشة. يمكنك ضبط ذلك من Settings ← Performance.
- تحتاج الخلفية **WebGL2**، وهو متوفر في أي كرت شاشة حديث مع تعريفات محدثة.

---

## 📥 Install & Run (English)

1. Install **Lively Wallpaper** (free) from the [Microsoft Store](https://apps.microsoft.com/detail/9ntm2qc6qws7) or [GitHub](https://github.com/lively-community/lively/releases).
2. Download **[Orbital_Loom_X_Galactic_Voyage.zip](https://github.com/r3dmof3-cyber/Orbital_Loom_X/raw/main/release/Orbital_Loom_X_Galactic_Voyage.zip)**. Don't extract it.
3. In Lively, click **➕ Add Wallpaper**, then **Choose a file**, and pick the ZIP. You can also drag and drop it into the Lively window.
4. Click the wallpaper to apply it. Open **⋯ → Customize** for 30+ options.
5. For mouse interaction, go to **Settings → Wallpaper → Wallpaper Input → Mouse**.

**No download?** In Lively's *Enter URL* box, paste `https://r3dmof3-cyber.github.io/Orbital_Loom_X/`. This needs an internet connection and has no Customize panel.

### Features
- **Analytic helical trails.** Each planet's path, including the Sun's galactic orbit, its vertical oscillation and the 60° tilt of the ecliptic, is evaluated on the GPU every frame. The trails stay perfectly smooth at any length.
- **One continuous world.** The camera flies seamlessly from planetary close-ups out to the full ~150k-star Milky Way, with spiral arms, bar, bulge, dust lanes and nebulae.
- **Sagittarius A\*:** a ray-marched black hole with gravitational lensing, a Doppler-beamed accretion disk and a photon ring.
- **Procedural planets** with no textures: Earth's continents, clouds and city lights, Jupiter's Great Red Spot, and Saturn's rings with their shadow. Three styles: realistic, neon and holographic.
- **Heliosphere** with three layers and interstellar-wind streaks. A **spacetime fabric** gravity well.
- **Rendering and extras:**
  - HDR rendering, bloom, ACES tonemapping and a cinematic grade.
  - An automatic cinematic director.
  - Audio reactivity.
  - Arabic and English UI.
  - A clock and live telemetry.
- 100% offline, with no external libraries.

### Controls
Drag to orbit, scroll to zoom, click a planet to follow it, and double-click to reset. Keys: `0–7` shots, `Space` pause, `H` HUD, `L` labels, `←/→` cycle planets, `Esc` stop following.

---

## 📁 Project structure
```
index.html              page layout & HUD
style.css               glass HUD styling
shaders.js              all GLSL ES 3.00 shaders
script.js               engine: simulation, camera director, renderer, Lively bridge
LivelyInfo.json         Lively metadata
LivelyProperties.json   Lively "Customize" options
release/                ready-to-import ZIP
docs/screenshots/       images for this README
```

To rebuild the ZIP from source, zip these files together at the root of the archive: `index.html style.css shaders.js script.js LivelyInfo.json LivelyProperties.json thumbnail.jpg preview.gif README_AR.txt`.

## 📜 License
[MIT](LICENSE). Free to use, share and modify; please keep the credit.

**© 2026 Yousif Anwar Alkmali — يوسف أنور الكمالي — r3dmof3@gmail.com**

> Scientific note: distances, sizes and time scales are artistically compressed so everything fits in one scene. The real Sun moves at ~230 km/s, a galactic year is ~230 Myr, and the ecliptic is tilted ~60° to the galactic plane.
