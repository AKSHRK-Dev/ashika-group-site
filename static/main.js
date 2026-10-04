(() => {
  const root = document.documentElement;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const S = (() => { try { return JSON.parse(document.getElementById("strings").textContent); } catch (e) { return {}; } })();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------------------------------------
  // small helpers
  // ---------------------------------------------------------------------------------------------
  const toastEl = document.getElementById("toast");
  let toastTimer;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function rain(count) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      const img = document.createElement("img");
      img.src = "/assets/seal.png";
      img.alt = "";
      img.className = "rain";
      img.style.left = Math.random() * 100 + "vw";
      img.style.width = 32 + Math.random() * 48 + "px";
      img.style.animationDuration = 2.2 + Math.random() * 2.4 + "s";
      img.style.animationDelay = Math.random() * 1.2 + "s";
      img.style.setProperty("--r", (Math.random() > .5 ? 1 : -1) * (180 + Math.random() * 540) + "deg");
      img.addEventListener("animationend", () => img.remove());
      document.body.appendChild(img);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // light / dark, with a circle that grows from the button
  // ---------------------------------------------------------------------------------------------
  const theme = document.getElementById("theme");
  const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  if (theme) {
    theme.setAttribute("aria-pressed", dark());
    theme.addEventListener("click", () => {
      const flip = () => {
        root.dataset.theme = dark() ? "light" : "dark";
        store.set("ashika-theme", root.dataset.theme);
        theme.setAttribute("aria-pressed", dark());
      };
      if (!document.startViewTransition || reduced) { flip(); return; }
      const r = theme.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add("theme-switch");
      const vt = document.startViewTransition(flip);
      vt.ready.then(() => {
        root.animate({ clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 650, easing: "cubic-bezier(.6, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" });
      });
      vt.finished.finally(() => root.classList.remove("theme-switch"));
    });
  }

  // remember the language, so "/" opens it next time; keep the section the visitor was reading
  document.querySelectorAll("[data-set-lang]").forEach((a) => a.addEventListener("click", (ev) => {
    document.cookie = "ashika_lang=" + a.dataset.setLang + "; path=/; max-age=31536000; SameSite=Lax";
    if (location.hash) { ev.preventDefault(); location.href = a.href + location.hash; }
  }));

  // phone menu
  const menu = document.getElementById("menu");
  const nav = document.getElementById("nav");
  if (menu && nav) {
    menu.addEventListener("click", () => menu.setAttribute("aria-expanded", nav.classList.toggle("open")));
    nav.addEventListener("click", (ev) => { if (ev.target.closest("a")) { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && nav.classList.contains("open")) { nav.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.focus(); } });
  }

  // the address is put together only when someone asks for it (no plain address in the page)
  document.querySelectorAll("[data-mail]").forEach((b) => b.addEventListener("click", () => {
    location.href = "mailto:" + b.dataset.mail + "@" + b.dataset.domain + (b.dataset.subject ? "?subject=" + encodeURIComponent(b.dataset.subject) : "");
  }));

  // ---------------------------------------------------------------------------------------------
  // reveal on scroll, and numbers that count once they are seen
  // ---------------------------------------------------------------------------------------------
  function countUp(el) {
    const to = Number(el.dataset.to);
    // the price falls instead of rising, like on ashikanw.com
    const from = to === 30 ? 1200 : 0;
    if (reduced || !Number.isFinite(to)) { el.textContent = to; return; }
    const start = performance.now(), dur = from > to ? 1500 : 1100;
    const step = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = from;
    requestAnimationFrame(step);
  }

  // How each element enters. Decided here from what the element is, so pages only need class="rv".
  //   wipe: headings are uncovered left to right   left/right: slide in from the side
  //   flip: cards tip up in 3D                      curtain: screenshots are drawn open
  //   pop: small things spring in                   up: everything else rises
  function animFor(el) {
    if (el.matches(".sec-head, h2, .year-no")) return "wipe";
    if (el.matches(".slide, .mark-boards, .type-sample, .map-item")) return "curtain";
    if (el.matches(".tl-item, .article, .faq")) return "right";
    if (el.matches("li.step, .points li, .rules li, .spec > div, .profile > div, .loc, .perk")) return "left";
    if (el.matches(".card, .role-card, .program, .value, .word, .repo, .mf, .board, .tech-block header")) return "flip";
    if (el.matches(".facts li, .swatches li, .downloads li, .sp-nums div, .stats li")) return "pop";
    const split = el.closest(".split, .biz, .join-teaser-in, .sp-teaser-in, .perk-hero");
    if (split && split !== el) {
      const column = [...split.children].find((child) => child === el || child.contains(el));
      if (column) return [...split.children].indexOf(column) % 2 === 0 ? "left" : "right";
    }
    return "up";
  }
  document.querySelectorAll(".rv").forEach((el) => {
    if (!el.dataset.anim) el.dataset.anim = animFor(el);
    // things in a row come in one after another, unless the page set its own order
    if (!el.style.getPropertyValue("--d") && el.parentElement) {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("rv"));
      if (siblings.length > 1) el.style.setProperty("--d", String(Math.min(siblings.indexOf(el), 8)));
    }
  });
  // cards in a grid alternate the side they tip from
  document.querySelectorAll('[data-anim="flip"]').forEach((el) => {
    el.style.setProperty("--flip", [...el.parentElement.children].indexOf(el) % 2 ? "1" : "-1");
  });

  const seen = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      en.target.querySelectorAll(".num[data-to]").forEach(countUp);
      seen.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
  // Wipes and curtains start fully clipped, and a fully clipped element never counts as visible.
  // Watch their (unclipped) parent instead and open them when it scrolls in.
  const clipped = new Map();
  const seenParent = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      (clipped.get(en.target) || []).forEach((el) => {
        el.classList.add("in");
        el.querySelectorAll(".num[data-to]").forEach(countUp);
      });
      seenParent.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0 });
  document.querySelectorAll(".rv").forEach((el) => {
    if ((el.dataset.anim === "wipe" || el.dataset.anim === "curtain") && el.parentElement) {
      const parent = el.parentElement;
      if (!clipped.has(parent)) { clipped.set(parent, []); seenParent.observe(parent); }
      clipped.get(parent).push(el);
    } else {
      seen.observe(el);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // header shadow, reading progress, timeline fill
  // ---------------------------------------------------------------------------------------------
  const header = document.querySelector(".site-header");
  const timelines = [...document.querySelectorAll(".timeline")];
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    if (header) {
      header.classList.toggle("scrolled", y > 8);
      header.style.setProperty("--p", max > 0 ? clamp(y / max, 0, 1) : 0);
    }
    timelines.forEach((tl) => {
      const r = tl.getBoundingClientRect();
      const fill = reduced ? 1 : clamp((innerHeight * .75 - r.top) / r.height, 0, 1);
      tl.style.setProperty("--fill", fill.toFixed(3));
    });
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // ---------------------------------------------------------------------------------------------
  // cards that tilt toward the pointer, and buttons that lean to it
  // ---------------------------------------------------------------------------------------------
  if (finePointer && !reduced) {
    document.querySelectorAll(".tilt").forEach((el) => {
      el.addEventListener("pointermove", (ev) => {
        const r = el.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height;
        el.classList.add("tilting");
        el.style.setProperty("--ry", ((px - .5) * 8).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((.5 - py) * 8).toFixed(2) + "deg");
        el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("tilting");
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
    document.querySelectorAll(".magnet").forEach((el) => {
      el.addEventListener("pointermove", (ev) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--tx", ((ev.clientX - r.left - r.width / 2) * .18).toFixed(1) + "px");
        el.style.setProperty("--ty", ((ev.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px");
      });
      el.addEventListener("pointerleave", () => { el.style.setProperty("--tx", "0px"); el.style.setProperty("--ty", "0px"); });
    });
  }

  // the drawing in each page head drifts with the scroll and leans toward the pointer
  const arts = [...document.querySelectorAll("[data-parallax]")];
  if (arts.length && !reduced) {
    const drift = () => arts.forEach((a) => a.style.setProperty("--sy", (scrollY * 0.25).toFixed(1) + "px"));
    addEventListener("scroll", () => requestAnimationFrame(drift), { passive: true });
    if (finePointer) {
      document.querySelectorAll(".page-head").forEach((head) => {
        head.addEventListener("pointermove", (ev) => {
          const r = head.getBoundingClientRect();
          head.style.setProperty("--px", ((ev.clientX - r.left) / r.width - .5).toFixed(3));
          head.style.setProperty("--py", ((ev.clientY - r.top) / r.height - .5).toFixed(3));
        });
        head.addEventListener("pointerleave", () => { head.style.setProperty("--px", "0"); head.style.setProperty("--py", "0"); });
      });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // canvas helper: sized to its box, paused when off screen or in a background tab
  // ---------------------------------------------------------------------------------------------
  function animated(canvas, draw) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, visible = true, raf = 0, last = performance.now();
    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = (now) => {
      const dt = Math.min(now - last, 50); last = now;
      draw(ctx, w, h, dt, now);
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); };
    new ResizeObserver(() => { size(); kick(); }).observe(canvas);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }).observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    return { kick };
  }

  // ---------------------------------------------------------------------------------------------
  // the globe on the seal's nose: dots on a sphere, and information racing between them
  // ---------------------------------------------------------------------------------------------
  const globe = document.getElementById("globe");
  let spinBoost = 0;
  if (globe) {
    const N = 520, pts = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    const arcs = [];
    let rot = 0, spawn = 0;
    const tilt = -.38, ct = Math.cos(tilt), st = Math.sin(tilt);
    const turn = (p, a) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca;
      return [x, p[1] * ct - z * st, p[1] * st + z * ct];
    };
    const slerp = (a, b, t) => {
      const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), om = Math.acos(dot);
      if (om < 1e-4) return a;
      const s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
      const lift = 1 + Math.sin(Math.PI * t) * .28 * om;
      return [(a[0] * s1 + b[0] * s2) * lift, (a[1] * s1 + b[1] * s2) * lift, (a[2] * s1 + b[2] * s2) * lift];
    };
    animated(globe, (ctx, w, h, dt) => {
      const R = Math.min(w, h) * .44, cx = w / 2, cy = h / 2;
      const ink = css("--brand-2") || "#1b60a6", faint = css("--line-strong") || "#c9d3df";
      rot += dt * (.00018 + spinBoost * .004);
      spinBoost *= .965;
      ctx.clearRect(0, 0, w, h);
      // body
      const g = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
      g.addColorStop(0, "rgba(127,178,234,.22)"); g.addColorStop(1, "rgba(27,96,166,.05)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = faint; ctx.lineWidth = 1; ctx.stroke();
      // dots
      for (const p of pts) {
        const q = turn(p, rot);
        const front = q[2] > 0;
        ctx.globalAlpha = front ? .35 + q[2] * .65 : .12;
        ctx.fillStyle = front ? ink : faint;
        ctx.beginPath(); ctx.arc(cx + q[0] * R, cy - q[1] * R, front ? 1.1 + q[2] * 1.1 : .9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // information on the move
      spawn -= dt;
      if (spawn <= 0 && arcs.length < 9) {
        arcs.push({ a: pts[(Math.random() * N) | 0], b: pts[(Math.random() * N) | 0], t: 0, speed: .00045 + Math.random() * .0004 });
        spawn = 260 + Math.random() * 420 - spinBoost * 200;
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.t += dt * arc.speed * (1 + spinBoost * 2);
        if (arc.t > 1.6) { arcs.splice(i, 1); continue; }
        const head = Math.min(arc.t, 1), tail = Math.max(0, arc.t - .45);
        ctx.beginPath();
        let drawing = false;
        for (let k = 0; k <= 24; k++) {
          const t = tail + (head - tail) * (k / 24);
          const q = turn(slerp(arc.a, arc.b, t), rot);
          const x = cx + q[0] * R, y = cy - q[1] * R;
          if (q[2] > -.15) { if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y); } else drawing = false;
        }
        ctx.strokeStyle = ink; ctx.globalAlpha = clamp(1.6 - arc.t, 0, 1) * .85; ctx.lineWidth = 1.6; ctx.stroke();
        if (arc.t <= 1) {
          const q = turn(slerp(arc.a, arc.b, head), rot);
          if (q[2] > -.15) {
            ctx.globalAlpha = 1; ctx.fillStyle = ink;
            ctx.shadowColor = ink; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(cx + q[0] * R, cy - q[1] * R, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  // poke the seal: the globe hops and spins
  const stage = document.getElementById("stage");
  const poke = document.getElementById("poke");
  const pokeCount = document.getElementById("poke-count");
  if (stage && poke) {
    let pokes = Number(store.get("ashika-pokes")) || 0;
    let hideTimer;
    poke.addEventListener("click", (ev) => {
      pokes++;
      store.set("ashika-pokes", pokes);
      spinBoost = 1;
      stage.classList.remove("hop");
      void stage.offsetWidth;
      stage.classList.add("hop");
      if (pokeCount && S.seal_count) {
        pokeCount.textContent = S.seal_count.replace("{n}", pokes);
        pokeCount.classList.add("show");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => pokeCount.classList.remove("show"), 2200);
      }
      if (!reduced) {
        const r = stage.getBoundingClientRect();
        const pop = document.createElement("span");
        pop.className = "pop";
        pop.textContent = "+1";
        pop.style.left = (ev.clientX ? ev.clientX - r.left : r.width * .4) + "px";
        pop.style.top = (ev.clientY ? ev.clientY - r.top - 20 : r.height * .6) + "px";
        pop.addEventListener("animationend", () => pop.remove());
        stage.appendChild(pop);
      }
      if (pokes % 10 === 0) rain(12);
    });
  }

  // ---------------------------------------------------------------------------------------------
  // vision page: streams of information flowing behind the slogan
  // ---------------------------------------------------------------------------------------------
  const streams = document.getElementById("streams");
  if (streams) {
    const parts = [];
    animated(streams, (ctx, w, h, dt) => {
      const ink = css("--brand-2") || "#1b60a6";
      while (parts.length < Math.min(90, w / 12)) {
        parts.push({ x: Math.random() * w, y: Math.random() * h, v: .03 + Math.random() * .12, r: .8 + Math.random() * 1.8, lane: Math.random() * Math.PI * 2 });
      }
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.v * dt;
        p.lane += dt * .0012;
        p.y += Math.sin(p.lane) * .12;
        if (p.x > w + 20) { p.x = -20; p.y = Math.random() * h; }
      }
      ctx.strokeStyle = ink;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) { ctx.globalAlpha = (1 - d / 90) * .22; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      ctx.fillStyle = ink;
      for (const p of parts) {
        ctx.globalAlpha = .25 + p.v * 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .12;
        ctx.fillRect(p.x - p.v * 260, p.y - p.r / 2, p.v * 260, p.r);
      }
      ctx.globalAlpha = 1;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // brand page: click a color to copy it
  // ---------------------------------------------------------------------------------------------
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(`${S.copied || "Copied"}: ${b.dataset.copy}`); }
    catch (e) { toast(b.dataset.copy); }
  }));

  // the seal in the footer jumps when clicked
  document.querySelectorAll(".swimmer").forEach((s) => s.addEventListener("click", () => {
    s.classList.remove("jump"); void s.offsetWidth; s.classList.add("jump");
  }));

  // ↑ ↑ ↓ ↓ ← → ← → B A
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let at = 0;
  document.addEventListener("keydown", (ev) => {
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    at = k === code[at] ? at + 1 : (k === code[0] ? 1 : 0);
    if (at === code.length) { at = 0; rain(40); toast(S.konami || "Seals everywhere!"); }
  });

  // ---------------------------------------------------------------------------------------------
  // 404: keep the ball in the air
  // ---------------------------------------------------------------------------------------------
  const gc = document.getElementById("game-canvas");
  if (gc) {
    const ctx = gc.getContext("2d");
    const scoreEl = document.getElementById("game-score");
    const bestEl = document.getElementById("game-best");
    const startBtn = document.getElementById("game-start");
    const seal = new Image(); seal.src = "/assets/seal.png";
    let w = 0, h = 0, ball, running = false, score = 0, best = Number(store.get("ashika-ball-best")) || 0, sealX = 0, raf = 0, last = 0;
    const showBest = () => { bestEl.textContent = best ? `${S.game_best || "Best"} ${best}` : ""; };
    const size = () => {
      const r = gc.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height; gc.width = w * dpr; gc.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const reset = () => { ball = { x: w / 2, y: h * .35, vx: (Math.random() - .5) * .2, vy: -.45, r: Math.max(18, Math.min(w, h) * .065), spin: 0 }; score = 0; scoreEl.textContent = 0; sealX = w / 2; };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const ink = css("--brand-2") || "#1b60a6";
      // the seal follows the ball along the floor
      if (seal.complete) { const sw = Math.min(160, w * .3), sh = sw * 339 / 512; ctx.drawImage(seal, sealX - sw * .85, h - sh - 4, sw, sh); }
      const d = clamp(1 - (h - ball.y) / h, .2, 1);
      ctx.fillStyle = "rgba(14,26,43,.12)"; ctx.beginPath(); ctx.ellipse(ball.x, h - 8, ball.r * d, ball.r * .25 * d, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.spin);
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, ball.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, ball.r * .62, -.6, 1.4); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.arc(ball.x - ball.r * .35, ball.y - ball.r * .35, ball.r * .22, 0, Math.PI * 2); ctx.fill();
    };
    const end = () => {
      running = false;
      if (score > best) { best = score; store.set("ashika-ball-best", best); }
      showBest();
      startBtn.textContent = S.game_again || "Play again";
      startBtn.hidden = false;
      if (score >= 10) rain(Math.min(score, 30));
    };
    const tick = (now) => {
      const dt = Math.min(now - last, 32); last = now;
      const level = 1 + score * .04;
      ball.vy += .0011 * dt * level;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.spin += ball.vx * dt * .02;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > w - ball.r) { ball.x = w - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy) * .5; }
      sealX += (ball.x - sealX) * .06;
      draw();
      if (ball.y > h - ball.r) { ball.y = h - ball.r; draw(); end(); return; }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      size(); reset(); running = true; startBtn.hidden = true; last = performance.now();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    };
    gc.addEventListener("pointerdown", (ev) => {
      if (!running) return;
      const r = gc.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      if (Math.hypot(x - ball.x, y - ball.y) > ball.r * 1.9) return;
      ball.vy = -(.55 + Math.min(score, 30) * .005);
      ball.vx = clamp((ball.x - x) / ball.r * .22 + (Math.random() - .5) * .12, -.45, .45);
      score++; scoreEl.textContent = score;
    });
    startBtn.addEventListener("click", start);
    addEventListener("resize", () => { if (!running) { size(); reset(); draw(); } });
    showBest(); size(); reset(); seal.onload = draw; draw();
  }

  // a hello for people who open the console
  console.log("%cASHIKA Group%c  情報と世界を駆け巡る / Across information, around the world.\nSource: https://github.com/AKSHRK-Dev/ashika-group-site  (try ↑↑↓↓←→←→BA)",
    "font: 800 20px Inter, sans-serif; color: #1b60a6", "font: 12px Inter, sans-serif; color: #5c6878");
})();
