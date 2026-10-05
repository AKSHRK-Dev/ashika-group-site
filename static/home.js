/*
 * The home page's toys: the Earth on the seal's nose, and small gimmicks around the page.
 * Loaded only on the home page. Everything decorative stops for prefers-reduced-motion.
 */
(() => {
  const root = document.documentElement;
  const S = (() => { try { return JSON.parse(document.getElementById("strings").textContent); } catch (e) { return {}; } })();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rain = (n) => window.AshikaRain && window.AshikaRain(n);
  const toast = (t) => window.AshikaToast && window.AshikaToast(t);
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;

  // ===========================================================================================
  // The Earth. NASA Blue Marble (day) and Black Marble (night lights) wrapped on a sphere.
  // Day and night follow where the sun really is right now. Drag it to spin it.
  //
  // Per pixel, the work that does not change between frames (where the pixel lands on the
  // globe before it turns) is done once; each frame only shifts the map and moves the sun.
  // ===========================================================================================
  const canvas = document.getElementById("globe");
  const stage = document.getElementById("stage");
  const TILT = 0.36; // the north pole leans toward the viewer a little
  const CITIES = [
    [34.69, 135.5], // Osaka: where ASHIKA Group is
    [35.68, 139.69], [37.57, 126.98], [25.03, 121.56], [1.35, 103.82], [-33.87, 151.21], [21.31, -157.86],
    [34.05, -118.24], [40.71, -74.01], [49.28, -123.12], [19.43, -99.13], [-23.55, -46.63], [51.51, -0.13],
    [48.86, 2.35], [52.52, 13.4], [55.76, 37.62], [25.2, 55.27], [19.08, 72.88], [-1.29, 36.82], [30.04, 31.24],
  ];
  const rad = Math.PI / 180;
  let rot = -135 * rad; // Japan (135°E) faces the viewer at the start; the longitude in front is -rot
  let spin = 0.12;       // radians per second, eastward like the real Earth
  let dragVel = 0;       // extra spin from dragging and pokes, fades away
  let boost = 0;

  if (canvas) {
    const ctx = canvas.getContext("2d");
    const day = new Image(), night = new Image();
    day.src = "/assets/earth-day.jpg";
    night.src = "/assets/earth-night.jpg";
    let tex = null, TW = 0, TH = 0; // day and night pixels
    let w = 0, h = 0, dpr = 1, size = 0, off = null, offCtx = null, img = null, px = null;
    let visible = true, raf = 0, last = performance.now();
    const arcs = [];
    let spawn = 0;

    function loadTextures() {
      if (!day.complete || !night.complete || !day.naturalWidth || !night.naturalWidth) return;
      TW = day.naturalWidth; TH = day.naturalHeight;
      const c = document.createElement("canvas");
      c.width = TW; c.height = TH;
      const cx = c.getContext("2d", { willReadFrequently: true });
      cx.drawImage(day, 0, 0, TW, TH);
      const d = new Uint32Array(cx.getImageData(0, 0, TW, TH).data.buffer.slice(0));
      cx.drawImage(night, 0, 0, TW, TH);
      const n = new Uint32Array(cx.getImageData(0, 0, TW, TH).data.buffer.slice(0));
      tex = { d, n };
      prepare();
      kick();
    }
    day.onload = night.onload = loadTextures;

    // where each pixel of the disc lands on the globe, before the globe turns
    function prepare() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!tex) return;
      // the globe image itself is drawn at most 2 x 190 px across, then scaled: smooth enough, and cheap
      size = Math.max(64, Math.min(380, Math.round(Math.min(w, h) * 0.88 * dpr)));
      off = document.createElement("canvas");
      off.width = off.height = size;
      offCtx = off.getContext("2d");
      img = offCtx.createImageData(size, size);
      const R = size / 2, ct = Math.cos(TILT), st = Math.sin(TILT);
      const list = { idx: [], row: [], u0: [], x1: [], y1: [], z1: [], shade: [] };
      // a soft light from the upper left
      const L = [-0.45, 0.5, 0.74], ll = Math.hypot(...L);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const sx = (x + 0.5 - R) / R, sy = (R - y - 0.5) / R;
          const q = sx * sx + sy * sy;
          if (q > 1) continue;
          const sz = Math.sqrt(1 - q);
          // undo the tilt: screen -> globe (before turning)
          const x1 = sx, y1 = sy * ct + sz * st, z1 = -sy * st + sz * ct;
          const lat = Math.asin(clamp(y1, -1, 1)), lon = Math.atan2(x1, z1);
          list.idx.push((y * size + x) * 4);
          list.row.push(Math.min(TH - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * TH)) * TW);
          list.u0.push(((lon + Math.PI) / (2 * Math.PI)) * TW);
          list.x1.push(x1); list.y1.push(y1); list.z1.push(z1);
          const lambert = Math.max(0, (sx * L[0] + sy * L[1] + sz * L[2]) / ll);
          list.shade.push(0.5 + 0.62 * lambert * (0.55 + 0.45 * sz));
        }
      }
      px = {
        n: list.idx.length,
        idx: Int32Array.from(list.idx), row: Int32Array.from(list.row), u0: Float32Array.from(list.u0),
        x1: Float32Array.from(list.x1), y1: Float32Array.from(list.y1), z1: Float32Array.from(list.z1),
        shade: Float32Array.from(list.shade),
      };
    }

    // where the sun is overhead right now (accurate to a degree or so: plenty for a picture)
    function sun() {
      const now = new Date();
      const start = Date.UTC(now.getUTCFullYear(), 0, 0);
      const dayOfYear = (now - start) / 864e5;
      const decl = -23.44 * rad * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
      const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
      const lon = (12 - hours) * 15 * rad;
      return [Math.cos(decl) * Math.sin(lon), Math.sin(decl), Math.cos(decl) * Math.cos(lon)];
    }

    function renderEarth() {
      const data = img.data;
      const out = new Uint32Array(data.buffer);
      const [Sx, Sy, Sz] = sun();
      const c = Math.cos(rot), s = Math.sin(rot);
      // light on a point = its position (turned) · sun; folded so only 3 products per pixel remain
      const A = Sx * c + Sz * s, B = -Sx * s + Sz * c;
      const shift = -(rot / (2 * Math.PI)) * TW; // longitude on screen = longitude on the map - rot
      const { n, idx, row, u0, x1, y1, z1, shade } = px;
      const D = tex.d, N = tex.n;
      const lights = isDark() ? 1.9 : 1.5;
      out.fill(0);
      for (let i = 0; i < n; i++) {
        let u = (u0[i] + shift) % TW;
        if (u < 0) u += TW;
        const t = row[i] + (u | 0);
        const dc = D[t], nc = N[t];
        const light = x1[i] * A + y1[i] * Sy + z1[i] * B;
        // soft line between day and night
        let k = (light + 0.1) / 0.28;
        k = k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
        const sh = shade[i];
        const dr = (dc & 255) * sh, dg = ((dc >> 8) & 255) * sh, db = ((dc >> 16) & 255) * sh;
        const nr = (nc & 255) * lights + dr * 0.08, ng = ((nc >> 8) & 255) * lights + dg * 0.08, nb = ((nc >> 16) & 255) * lights + db * 0.12 + 6;
        const r = nr + (dr - nr) * k, g = ng + (dg - ng) * k, b = nb + (db - nb) * k;
        out[idx[i] >> 2] = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
      }
      offCtx.putImageData(img, 0, 0);
    }

    // globe -> screen, the same turn and tilt as the pixels above
    function project(lat, lon, lift = 1) {
      const cl = Math.cos(lat);
      let x = cl * Math.sin(lon), y = Math.sin(lat), z = cl * Math.cos(lon);
      const c = Math.cos(rot), s = Math.sin(rot);
      const x2 = x * c + z * s, z2 = -x * s + z * c;
      const y3 = y * Math.cos(TILT) - z2 * Math.sin(TILT), z3 = y * Math.sin(TILT) + z2 * Math.cos(TILT);
      return { x: x2 * lift, y: y3 * lift, z: z3 };
    }

    function draw(dt) {
      const R = Math.min(w, h) * 0.44, cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      // atmosphere
      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.16);
      glow.addColorStop(0, isDark() ? "rgba(110,170,255,.55)" : "rgba(90,160,255,.45)");
      glow.addColorStop(1, "rgba(90,160,255,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, Math.PI * 2); ctx.fill();
      if (tex && px) {
        renderEarth();
        ctx.drawImage(off, cx - R, cy - R, R * 2, R * 2);
        // a thin line of air over the edge hides the stair-steps of the disc
        ctx.strokeStyle = "rgba(150,200,255,.55)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(cx, cy, R - 0.4, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = "#1b4f8a"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      }
      // a thin rim of light and a soft highlight
      const rim = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
      rim.addColorStop(0, "rgba(140,200,255,0)"); rim.addColorStop(1, "rgba(160,210,255,.35)");
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      const spec = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.45, 0, cx - R * 0.42, cy - R * 0.45, R * 0.7);
      spec.addColorStop(0, "rgba(255,255,255,.22)"); spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // information flying from Osaka (and between cities), and the cities themselves
      spawn -= dt;
      if (spawn <= 0 && arcs.length < 7) {
        const from = Math.random() < 0.65 ? 0 : (Math.random() * CITIES.length) | 0;
        let to = (Math.random() * CITIES.length) | 0;
        if (to === from) to = (to + 3) % CITIES.length;
        arcs.push({ a: CITIES[from], b: CITIES[to], t: 0, speed: 0.38 + Math.random() * 0.3 });
        spawn = 0.35 + Math.random() * 0.5 - boost * 0.3;
      }
      ctx.lineCap = "round";
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.t += dt * arc.speed * (1 + boost * 2);
        if (arc.t > 1.5) { arcs.splice(i, 1); continue; }
        const head = Math.min(arc.t, 1), tail = Math.max(0, arc.t - 0.45);
        const [la1, lo1] = arc.a, [la2, lo2] = arc.b;
        // great-circle path, lifted off the surface in the middle
        const p1 = vec(la1 * rad, lo1 * rad), p2 = vec(la2 * rad, lo2 * rad);
        const om = Math.acos(clamp(p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2], -1, 1)) || 1e-4;
        ctx.beginPath();
        let started = false;
        for (let k = 0; k <= 22; k++) {
          const t = tail + (head - tail) * (k / 22);
          const s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
          const v = [p1[0] * s1 + p2[0] * s2, p1[1] * s1 + p2[1] * s2, p1[2] * s1 + p2[2] * s2];
          const lift = 1 + Math.sin(Math.PI * t) * 0.22 * om;
          const lat = Math.asin(clamp(v[1], -1, 1)), lon = Math.atan2(v[0], v[2]);
          const q = project(lat, lon, lift);
          const X = cx + q.x * R, Y = cy - q.y * R;
          if (q.z > -0.05) { if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y); } else started = false;
        }
        const fade = clamp(1.5 - arc.t, 0, 1);
        ctx.strokeStyle = `rgba(255,214,120,${0.85 * fade})`; ctx.lineWidth = 1.6; ctx.shadowColor = "rgba(255,190,80,.9)"; ctx.shadowBlur = 8;
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      for (let i = 0; i < CITIES.length; i++) {
        const q = project(CITIES[i][0] * rad, CITIES[i][1] * rad);
        if (q.z < 0.05) continue;
        const pulse = i === 0 ? 2.6 + Math.sin(performance.now() / 300) * 0.9 : 1.6;
        ctx.fillStyle = i === 0 ? "rgba(255,120,90,.95)" : "rgba(255,226,150,.9)";
        ctx.beginPath(); ctx.arc(cx + q.x * R, cy - q.y * R, pulse * q.z + 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    function vec(lat, lon) { const c = Math.cos(lat); return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)]; }

    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        rot += (spin + dragVel) * dt;
        dragVel *= Math.pow(0.12, dt); // the push from a drag fades over a second or two
      }
      boost *= Math.pow(0.2, dt);
      draw(dt);
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); }

    // drag to spin (sideways drags only, so the page still scrolls on phones)
    let dragging = false, lastX = 0, lastT = 0;
    canvas.addEventListener("pointerdown", (ev) => {
      dragging = true; lastX = ev.clientX; lastT = performance.now();
      canvas.setPointerCapture(ev.pointerId);
      canvas.classList.add("grabbing");
      stage && stage.classList.add("dragged");
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      const now = performance.now(), dx = ev.clientX - lastX;
      const R = Math.min(w, h) * 0.44 || 100;
      rot += dx / R;
      dragVel = clamp((dx / R) / Math.max(0.008, (now - lastT) / 1000), -12, 12);
      lastX = ev.clientX; lastT = now;
      if (reduced) draw(0);
      kick();
    });
    const release = () => { if (!dragging) return; dragging = false; canvas.classList.remove("grabbing"); kick(); };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    new ResizeObserver(() => { prepare(); draw(0); kick(); }).observe(canvas);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    loadTextures();
    kick();
  }

  // poke the seal: the globe hops and spins
  const poke = document.getElementById("poke");
  const pokeCount = document.getElementById("poke-count");
  if (stage && poke) {
    let pokes = 0;
    try { pokes = Number(localStorage.getItem("ashika-pokes")) || 0; } catch (e) { /* private mode */ }
    let hideTimer;
    poke.addEventListener("click", (ev) => {
      pokes++;
      try { localStorage.setItem("ashika-pokes", pokes); } catch (e) { /* private mode */ }
      boost = 1; dragVel += 6;
      stage.classList.remove("hop"); void stage.offsetWidth; stage.classList.add("hop");
      if (pokeCount && S.seal_count) {
        pokeCount.textContent = S.seal_count.replace("{n}", pokes);
        pokeCount.classList.add("show");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => pokeCount.classList.remove("show"), 2200);
      }
      if (!reduced) {
        const r = stage.getBoundingClientRect();
        const pop = document.createElement("span");
        pop.className = "pop"; pop.textContent = "+1";
        pop.style.left = (ev.clientX ? ev.clientX - r.left : r.width * 0.4) + "px";
        pop.style.top = (ev.clientY ? ev.clientY - r.top - 20 : r.height * 0.6) + "px";
        pop.addEventListener("animationend", () => pop.remove());
        stage.appendChild(pop);
      }
      if (pokes % 10 === 0) rain(12);
    });
  }

  // ===========================================================================================
  // A greeting for the time of day where the visitor is
  // ===========================================================================================
  const greet = document.querySelector("[data-greet]");
  if (greet) {
    const hour = new Date().getHours();
    const key = hour < 5 ? "greet_night" : hour < 11 ? "greet_morning" : hour < 17 ? "greet_day" : hour < 22 ? "greet_evening" : "greet_night";
    if (S[key]) { greet.textContent = S[key]; greet.hidden = false; }
  }

  // ===========================================================================================
  // Bubbles that rise from the pointer in the hero
  // ===========================================================================================
  const hero = document.querySelector(".hero");
  if (hero && finePointer && !reduced) {
    let lastBubble = 0;
    hero.addEventListener("pointermove", (ev) => {
      const now = performance.now();
      if (now - lastBubble < 45) return;
      lastBubble = now;
      const r = hero.getBoundingClientRect();
      const b = document.createElement("span");
      b.className = "bubble";
      const size = 6 + Math.random() * 12;
      b.style.cssText = `left:${ev.clientX - r.left}px;top:${ev.clientY - r.top}px;width:${size}px;height:${size}px;--dx:${(Math.random() - 0.5) * 40}px`;
      b.addEventListener("animationend", () => b.remove());
      hero.appendChild(b);
    });
    // a soft light follows the pointer across the hero
    hero.addEventListener("pointermove", (ev) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--lx", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      hero.style.setProperty("--ly", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    });
  }

  // ===========================================================================================
  // The ticker runs faster and leans while the page is scrolled quickly
  // ===========================================================================================
  const track = document.querySelector(".ticker .track");
  if (track && !reduced && track.getAnimations) {
    let lastY = scrollY, speed = 0, ticking = false;
    const settle = () => {
      const anim = track.getAnimations()[0];
      speed *= 0.9;
      if (anim) anim.playbackRate = 1 + Math.min(Math.abs(speed) * 0.08, 7);
      track.style.setProperty("--lean", clamp(-speed * 0.25, -12, 12).toFixed(2) + "deg");
      if (Math.abs(speed) > 0.05) requestAnimationFrame(settle); else { ticking = false; if (anim) anim.playbackRate = 1; track.style.setProperty("--lean", "0deg"); }
    };
    addEventListener("scroll", () => {
      speed = clamp(scrollY - lastY, -120, 120);
      lastY = scrollY;
      if (!ticking) { ticking = true; requestAnimationFrame(settle); }
    }, { passive: true });
  }

  // ===========================================================================================
  // The three words decode themselves, like a signal coming in
  // ===========================================================================================
  // English words scramble through Latin letters, Japanese ones through kana and kanji
  const GLYPHS_JA = "アイウエオカキクケコサシスセソ01#%&*ΣΩλ情報世界駆巡";
  const GLYPHS_EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#%&*";
  function decode(el) {
    if (reduced || el.dataset.decoding) return;
    const target = el.dataset.text || (el.dataset.text = el.textContent);
    const GLYPHS = /^[\x00-\x7f]*$/.test(target) ? GLYPHS_EN : GLYPHS_JA;
    el.dataset.decoding = "1";
    const start = performance.now(), dur = 700 + target.length * 60;
    const step = (now) => {
      const p = (now - start) / dur;
      const shown = Math.floor(p * target.length * 1.2);
      el.textContent = [...target].map((ch, i) => (i < shown ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
      if (p < 1) requestAnimationFrame(step); else { el.textContent = target; delete el.dataset.decoding; }
    };
    requestAnimationFrame(step);
  }
  document.querySelectorAll(".word b").forEach((b) => {
    b.closest(".word").addEventListener("pointerenter", () => decode(b));
    new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { setTimeout(() => decode(b), 250); obs.disconnect(); } }, { threshold: 0.6 }).observe(b);
  });

  // ===========================================================================================
  // Fact cards flip over on tap (hover flips them with CSS on computers)
  // ===========================================================================================
  document.querySelectorAll(".facts .flip").forEach((li) => {
    li.addEventListener("click", () => li.classList.toggle("flipped"));
    li.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); li.classList.toggle("flipped"); } });
  });

  // ===========================================================================================
  // Back to the top, carried by the seal
  // ===========================================================================================
  const toTop = document.querySelector(".to-top");
  if (toTop) {
    const show = () => toTop.classList.toggle("show", scrollY > innerHeight * 0.9);
    addEventListener("scroll", show, { passive: true });
    show();
    toTop.addEventListener("click", () => {
      toTop.classList.remove("launch"); void toTop.offsetWidth; toTop.classList.add("launch");
      scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
  }

  // ===========================================================================================
  // Hidden: type "ashika" for a backflip; click the logo five times
  // ===========================================================================================
  let typed = "";
  document.addEventListener("keydown", (ev) => {
    if (ev.key.length !== 1 || ev.target.closest?.("input, textarea")) return;
    typed = (typed + ev.key.toLowerCase()).slice(-6);
    if (typed === "ashika" && stage) {
      stage.classList.remove("flip-seal"); void stage.offsetWidth; stage.classList.add("flip-seal");
      boost = 1; dragVel += 10;
      rain(24);
      toast(S.secret_word || "!");
    }
  });
  const brand = document.querySelector(".site-header .brand");
  if (brand) {
    let clicks = 0, timer;
    brand.addEventListener("click", (ev) => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => (clicks = 0), 1200);
      if (clicks >= 3) ev.preventDefault(); // stay on the page while someone is clicking away
      if (clicks === 5) {
        clicks = 0;
        brand.classList.remove("spin"); void brand.offsetWidth; brand.classList.add("spin");
        toast(S.logo_toast || "!");
      }
    });
  }
})();
