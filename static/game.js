/*
 * Seal Ball: move the seal and keep the ball bouncing on its nose.
 * Used by /game/ (full size) and the 404 page (smaller). No dependencies.
 *
 * Controls: mouse / finger anywhere over the game moves the seal, or ← → / A D.
 * Space or Enter starts and restarts; P or Esc pauses.
 *
 * Kept light: one canvas, physics on a fixed 120 Hz step (same feel on 60 and 120 Hz screens),
 * resolution capped at 2x, and the loop stops while the tab is hidden or the game is off screen.
 */
(() => {
  const root = document.querySelector("[data-game]");
  if (!root) return;

  const S = (() => { try { return JSON.parse(document.getElementById("strings").textContent); } catch (e) { return {}; } })();
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const $ = (sel) => root.querySelector(sel);
  const ui = {
    score: $("[data-score]"), best: $("[data-best]"), lives: $("[data-lives]"), combo: $("[data-combo]"),
    overlay: $("[data-overlay]"), title: $("[data-title]"), text: $("[data-text]"), start: $("[data-start]"), share: $("[data-share]"),
  };

  const seal = new Image();
  seal.src = "/assets/seal.png";
  // where the nose is in seal.png (512 x 339)
  const NOSE_X = 450 / 512, NOSE_Y = 110 / 339, SEAL_RATIO = 339 / 512;

  const STEP = 1 / 120;
  const LIVES = 3;
  let w = 0, h = 0, scale = 1, dpr = 1;
  let state = "ready"; // ready | playing | paused | over
  let score = 0, best = Number(store.get("ashika-ball-best")) || 0, lives = LIVES, combo = 0;
  let balls = [], stars = [], bits = [], popups = [];
  let player = { x: 0, target: 0, vx: 0, bob: 0 };
  let keys = { left: false, right: false };
  let starTimer = 3, time = 0, shake = 0, raf = 0, last = 0, acc = 0, visible = true;

  // ---------------------------------------------------------------------------------------------
  // sizes
  // ---------------------------------------------------------------------------------------------
  const sealW = () => Math.max(96, Math.min(170, w * 0.24));
  const ground = () => h - 26 * scale;
  function nose() {
    const sw = sealW(), sh = sw * SEAL_RATIO;
    const bob = Math.sin(player.bob) * 2 * scale;
    return { x: player.x, y: ground() - sh + sh * NOSE_Y + bob, r: sw * 0.17 };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height; scale = h / 480;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.x = player.target = clampX(player.x || w / 2);
    if (state !== "playing") draw();
  }

  // the nose can reach both walls (the body slides off the left edge), so no ball is out of reach
  function clampX(x) {
    const r = sealW() * 0.17;
    return Math.max(r, Math.min(w - 4 * scale, x));
  }

  // ---------------------------------------------------------------------------------------------
  // game state
  // ---------------------------------------------------------------------------------------------
  function newBall(delay = 0) {
    const n = nose();
    return { x: n.x, y: n.y - h * 0.42, vx: 0, vy: 0, r: Math.max(13, 17 * scale), spin: 0, wait: delay, flash: delay };
  }

  function reset() {
    score = 0; lives = LIVES; combo = 0; time = 0; starTimer = 3;
    balls = [newBall(0.6)]; stars = []; bits = []; popups = [];
    player.x = player.target = w / 2;
    hud();
  }

  function start() {
    if (state === "playing") return;
    if (state !== "paused") reset();
    state = "playing";
    root.classList.add("is-playing");
    ui.overlay.hidden = true;
    canvas.focus({ preventScroll: true });
    kick();
  }

  function pause() {
    if (state !== "playing") return;
    state = "paused";
    showOverlay(S.game_paused || "Paused", S.game_resume_hint || "", S.game_resume || "Resume", false);
  }

  function gameOver() {
    state = "over";
    const record = score > best;
    if (record) { best = score; store.set("ashika-ball-best", best); }
    hud();
    const line = (S.game_result || "{n}").replace("{n}", score) + (record && score > 0 ? `  ${S.game_new_best || "New best!"}` : "");
    showOverlay(S.game_over || "Game over", line, S.game_again || "Play again", true);
    if (record && score >= 10 && window.AshikaRain) window.AshikaRain(Math.min(score, 40));
  }

  function showOverlay(title, text, button, share) {
    root.classList.remove("is-playing");
    ui.title.textContent = title;
    ui.text.textContent = text;
    ui.start.textContent = button;
    if (ui.share) {
      ui.share.hidden = !share || score === 0;
      const msg = (S.game_share_text || "{n}").replace("{n}", score);
      ui.share.href = "https://x.com/intent/post?text=" + encodeURIComponent(msg) + "&url=" + encodeURIComponent(location.origin + (S.game_url || "/"));
    }
    ui.overlay.hidden = false;
    draw();
  }

  function hud() {
    ui.score.textContent = score;
    ui.best.textContent = best;
    ui.lives.textContent = "●".repeat(lives) + "○".repeat(Math.max(0, LIVES - lives));
    ui.lives.setAttribute("aria-label", String(lives));
  }

  // ---------------------------------------------------------------------------------------------
  // physics (fixed step)
  // ---------------------------------------------------------------------------------------------
  function update(dt) {
    time += dt;
    player.bob += dt * 4;

    // the seal follows the pointer smoothly, or the keys at a steady speed
    if (keys.left || keys.right) player.target = clampX(player.x + (keys.right - keys.left) * w * 1.15 * dt);
    const before = player.x;
    player.x = clampX(player.x + (player.target - player.x) * Math.min(1, dt * 16));
    player.vx = (player.x - before) / dt;

    const gravity = 980 * scale * (1 + Math.min(score, 80) * 0.006);
    const n = nose();

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.wait > 0) { b.wait -= dt; b.flash -= dt; b.x = n.x; continue; }
      b.vy += gravity * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vx * dt * 0.02;
      // the walls always send the ball back toward the middle, so it never slides down a wall
      if (b.x < b.r) { b.x = b.r; b.vx = Math.max(Math.abs(b.vx) * 0.9, 120 * scale); }
      if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.max(Math.abs(b.vx) * 0.9, 120 * scale); }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.4; }

      // the nose: a generous circle, and only while the ball is coming down
      const dx = b.x - n.x, dy = b.y - n.y, reach = b.r + n.r;
      if (b.vy > 0 && dx * dx + dy * dy < reach * reach && b.y < n.y + n.r * 0.6) {
        const height = h * (0.5 + Math.random() * 0.14);
        b.vy = -Math.sqrt(2 * gravity * height);
        // where it hits the nose steers it, plus a random push that grows with the score,
        // so the ball never settles into bouncing straight up and the seal has to move
        const push = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 110 + Math.min(score, 60) * 3) * scale;
        b.vx = Math.max(-1, Math.min(1, dx / reach)) * 260 * scale + player.vx * 0.25 + push;
        b.y = n.y - reach;
        combo += 1;
        const gain = 1 + Math.floor(combo / 10);
        score += gain;
        popup(b.x, b.y - b.r, "+" + gain);
        burst(b.x, n.y - n.r * 0.4, 6, css("--brand-2", "#1b60a6"));
        player.bob = 0;
        if (score >= 25 && balls.length === 1 && lives > 0) balls.push(newBall(0.8));
        hud();
      }

      // in the water: lose a life
      if (b.y - b.r > ground() + 6 * scale) {
        splash(b.x);
        balls.splice(i, 1);
        lives -= 1; combo = 0; shake = 0.25;
        hud();
        if (lives <= 0) { gameOver(); return; }
        if (balls.length === 0) balls.push(newBall(0.9));
      }
    }

    // stars to catch with the ball, for bonus points
    starTimer -= dt;
    if (starTimer <= 0 && stars.length < 2) {
      stars.push({ x: w * (0.12 + Math.random() * 0.76), y: h * (0.12 + Math.random() * 0.35), t: 0, life: 7 });
      starTimer = 5 + Math.random() * 4;
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.t += dt; s.life -= dt;
      const hit = balls.some((b) => b.wait <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < b.r + 16 * scale);
      if (hit) {
        score += 5; combo += 1;
        popup(s.x, s.y, "+5 ★");
        burst(s.x, s.y, 14, "#f5b301");
        stars.splice(i, 1);
        hud();
      } else if (s.life <= 0) stars.splice(i, 1);
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i];
      p.life -= dt; p.vy += 600 * scale * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) bits.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt; popups[i].y -= 40 * scale * dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);
  }

  function burst(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 180) * scale;
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * scale, life: 0.5 + Math.random() * 0.3, color, r: (2 + Math.random() * 2) * scale });
    }
  }
  function splash(x) { burst(x, ground(), 16, css("--brand-2", "#1b60a6")); }
  function popup(x, y, text) { popups.push({ x, y, text, life: 0.8 }); }

  // ---------------------------------------------------------------------------------------------
  // drawing
  // ---------------------------------------------------------------------------------------------
  function draw() {
    if (!w) return;
    const ink = css("--brand-2", "#1b60a6");
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 8 * shake * 4, 0);

    // water
    const gy = ground();
    ctx.fillStyle = "rgba(27,96,166,.10)";
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.03 + time * 2.4) * 3 * scale);
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

    // stars
    for (const s of stars) {
      const fade = Math.min(1, s.life / 1.2);
      drawStar(s.x, s.y + Math.sin(s.t * 3) * 4 * scale, 13 * scale, s.t * 1.5, `rgba(245,179,1,${fade})`);
    }

    // seal
    const sw = sealW(), sh = sw * SEAL_RATIO;
    if (seal.complete && seal.naturalWidth) {
      const bob = Math.sin(player.bob) * 2 * scale;
      ctx.drawImage(seal, player.x - sw * NOSE_X, gy - sh + bob + 4 * scale, sw, sh);
    }

    // balls (a waiting ball blinks above the nose)
    const n = nose();
    for (const b of balls) {
      if (b.wait > 0 && Math.floor(b.flash * 8) % 2 === 0) continue;
      const y = b.wait > 0 ? n.y - h * 0.42 : b.y;
      const depth = Math.max(0.25, Math.min(1, (y - h * 0.1) / (gy - h * 0.1)));
      ctx.fillStyle = "rgba(14,26,43,.12)";
      ctx.beginPath(); ctx.ellipse(b.x, gy + 2 * scale, b.r * depth, b.r * 0.25 * depth, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(b.spin);
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2 * scale;
      ctx.beginPath(); ctx.arc(0, 0, b.r * 0.62, -0.6, 1.4); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); ctx.fill();
    }

    // sparks and +1s
    for (const p of bits) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = `800 ${Math.round(18 * scale)}px Inter, "Noto Sans JP", sans-serif`;
    ctx.textAlign = "center";
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.text.includes("★") ? "#d99a00" : ink;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (ui.combo) {
      ui.combo.textContent = combo >= 3 ? (S.game_combo || "{n} combo").replace("{n}", combo) : "";
    }
  }

  function drawStar(x, y, r, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ---------------------------------------------------------------------------------------------
  // loop
  // ---------------------------------------------------------------------------------------------
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "playing") {
      acc += dt;
      while (acc >= STEP && state === "playing") { update(STEP); acc -= STEP; }
    } else {
      // idle: the seal breathes, nothing else runs
      time += dt; player.bob += dt * 3;
    }
    draw();
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (raf || !visible || document.hidden) return;
    last = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------------------------
  // input
  // ---------------------------------------------------------------------------------------------
  function aim(ev) {
    const r = canvas.getBoundingClientRect();
    player.target = clampX(ev.clientX - r.left);
  }
  canvas.addEventListener("pointerdown", (ev) => {
    aim(ev);
    if (state !== "playing") start();
  });
  canvas.addEventListener("pointermove", (ev) => { if (state === "playing") aim(ev); });

  // keys work while the game is on screen (and do not scroll the page then)
  document.addEventListener("keydown", (ev) => {
    if (!visible || ev.target.closest?.("input, textarea")) return;
    const k = ev.key;
    const playing = state === "playing";
    if (k === "ArrowLeft" || k === "a" || k === "A") { keys.left = true; if (playing) ev.preventDefault(); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; if (playing) ev.preventDefault(); }
    else if ((k === " " || k === "Enter") && state !== "playing" && (document.activeElement === canvas || document.activeElement === document.body)) { ev.preventDefault(); start(); }
    else if ((k === "p" || k === "P" || k === "Escape") && state === "playing") pause();
  });
  document.addEventListener("keyup", (ev) => {
    const k = ev.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
  });

  ui.start.addEventListener("click", start);
  // a tap anywhere on the overlay (except the share link) also starts
  ui.overlay.addEventListener("click", (ev) => { if (!ev.target.closest("a, button")) start(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else kick(); });
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (!visible) pause(); else kick();
  }, { threshold: 0.2 }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  seal.onload = () => draw();

  // for automated play-testing only: open the page with #debug
  if (location.hash === "#debug") window.__sealBall = { get state() { return state; }, get score() { return score; }, get lives() { return lives; }, get balls() { return balls; }, nose };

  hud();
  resize();
  balls = [newBall(0)];
  balls[0].wait = 0;
  balls[0].y = nose().y - balls[0].r - 2;
  showOverlay(S.game_t || "Seal Ball", S.game_how || "", S.game_start || "Start", false);
  kick();
})();
