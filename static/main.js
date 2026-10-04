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

  // shared with game.js and home.js
  window.AshikaRain = rain;
  window.AshikaToast = (text) => toast(text);

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
      seen.unobserve(en.target);
      if (en.target.classList.contains("in")) return; // already shown by the scroll check
      en.target.classList.add("in");
      en.target.querySelectorAll(".num[data-to]").forEach(countUp);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
  // Wipes and curtains start fully clipped, and a fully clipped element never counts as visible.
  // Watch their (unclipped) parent instead and open them when it scrolls in.
  const clipped = new Map();
  const seenParent = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      (clipped.get(en.target) || []).forEach((el) => {
        if (el.classList.contains("in")) return;
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
  // Backup for the observers above: some browsers (seen on iPhone Safari) do not always report
  // elements as visible. Anything whose top is on screen is shown, whatever the observers say.
  const pending = new Set(document.querySelectorAll(".rv"));
  function revealVisible() {
    for (const el of pending) {
      if (el.classList.contains("in")) { pending.delete(el); continue; }
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.94 && r.bottom > 0) {
        el.classList.add("in");
        el.querySelectorAll(".num[data-to]").forEach(countUp);
        pending.delete(el);
      }
    }
  }

  function onScroll() {
    ticking = false;
    revealVisible();
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

  // a hello for people who open the console
  console.log("%cASHIKA Group%c  情報と世界を駆け巡る / Across information, around the world.\nSource: https://github.com/AKSHRK-Dev/ashika-group-site  (try ↑↑↓↓←→←→BA)",
    "font: 800 20px Inter, sans-serif; color: #1b60a6", "font: 12px Inter, sans-serif; color: #5c6878");
})();
