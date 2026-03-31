# OMG promo banner — animation asset spec (for ChatGPT / production)

Use this document as the single source of requirements when generating, exporting, or encoding the animated background for the **“OMG! Najlepsze Okazje!”** promo banner on the HotDeals home page.

---

## 1. Purpose and placement

- **Role:** Looping background behind Polish copy (“OMG! Najlepsze Okazje!”, CTA “Odkryj Oferty”) and optional stats. The asset should feel energetic and on-brand for deals / excitement, without overpowering text readability.
- **Layout:** Full-width hero inside a max content width of **~1280px** (`max-w-7xl`). Block **minimum height:** **300px** mobile, **400px** desktop. Background is shown with **contain** fitting and a **radial fade mask** (stronger fade toward edges), so important subject matter should stay somewhat central—**leave calmer / simpler areas** where text sits (typically **left side** in the design).

---

## 2. Aspect ratio and resolution

| Property | Requirement |
|----------|-------------|
| **Aspect ratio** | **16:9** (mandatory; matches existing static banner pipeline) |
| **Recommended export size** | **1280×720** (primary) or **1920×1080** if higher sharpness on large screens is required |
| **Safe zone** | Assume **left ~40–50%** may have heavy gradient overlay and text; keep the **main focal action** biased **right/center-right** if mirroring the current static illustration layout |

---

## 3. File formats (delivery)

Deliver **both** for broad browser support:

1. **WebM** — **VP9** or **AV1** (VP9 is widely enough supported for video backgrounds; AV1 optional for smaller size where supported).
2. **MP4** — **H.264**, **yuv420p**, for Safari and older environments.

**Avoid:** GIF as the primary deliverable (poor quality and large size for this use case).

**Optional:** High-quality **PNG or WebP** still frame as **poster** image (first frame or hero frame) for LCP, `prefers-reduced-motion`, and before video loads.

---

## 4. Encoding and performance targets

| Target | Guideline |
|--------|------------|
| **Duration** | Short seamless loop, e.g. **3–8 seconds** |
| **Frame rate** | **24–30 fps** |
| **Audio** | **None** (silent); autoplay on the web requires muted video |
| **File size (per file)** | Aim **~500 KB–1.5 MB** per codec variant; avoid exceeding **~2–3 MB** without strong justification (Core Web Vitals / LCP) |
| **Loop** | Seamless loop; no visible jump on restart |

Use modern compression (2-pass or CRF-style), avoid unnecessary resolution above 1920×1080 for this slot.

---

## 5. Visual and content guidelines

- Style can align with existing direction: **vibrant, upbeat**, 3D/cartoon or illustration acceptable; must remain **legible** behind red gradient and white text (high contrast subjects work better).
- No tiny text inside the video that must be read (marketing copy lives in HTML).
- Avoid **rapid flashing** in a way that could trigger photosensitivity concerns; keep motion **moderately energetic**, not strobe-like.

---

## 6. Accessibility

- Plan for users with **`prefers-reduced-motion: reduce`:** provide a **static poster** (or first frame) and do not rely on motion alone to convey critical information.
- Decorative motion only; all meaning stays in the page text and CTA.

---

## 7. Integration notes (for developers implementing `<video>`)

When replacing or complementing the current `<img>` background:

- Attributes: **`muted`**, **`loop`**, **`playsInline`**, **`autoPlay`** (and **`preload="metadata"`** or **`auto`** as appropriate).
- Use **`<source type="video/webm">`** then **`<source type="video/mp4">`** inside `<video>`.
- Reuse existing layout classes: full-bleed under overlay, **`object-contain`**, **`object-center`**, same mask behavior as the image.
- **Hover scale** on the banner may apply to the `<video>` element the same way as the image.
- Current app may store a **data URL in `localStorage`** for a generated **image**; video assets are expected to be **static files in `public/`** (or CDN URLs) unless the product explicitly adds dynamic video generation.

---

## 8. Checklist before handoff

- [ ] 16:9, 1280×720 or 1920×1080  
- [ ] WebM + MP4 exported, loop is seamless  
- [ ] No audio; file sizes within targets  
- [ ] Poster/static frame provided (optional but recommended)  
- [ ] Subject composition respects left-side text / overlay  
- [ ] Reduced-motion story considered (static alternative)

---

## 9. One-line prompt starter (optional)

You can paste this into ChatGPT when asking for export settings or ffmpeg commands:

> “I need a looping 16:9 silent video for a web hero at 1280×720: WebM (VP9) + H.264 MP4, under ~1.5 MB each, 24–30 fps, 3–8 s seamless loop, subject biased right for left-side text overlay.”

Adjust numbers only if art direction requires it.
