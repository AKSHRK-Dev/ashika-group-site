// group.ashikanw.com の小さな仕掛けだけ（言語の記憶・メール・色のコピー）。動きの演出は持たない。
(() => {
  const S = (() => { try { return JSON.parse(document.getElementById("strings").textContent); } catch (e) { return {}; } })();
  const toastEl = document.getElementById("toast");
  let timer;
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }
  // game.js が呼ぶ（以前の「アシカの雨」はやめたので、何もしない）
  window.AshikaRain = () => {};
  window.AshikaToast = toast;

  // 選んだ言語を覚えておき、次に "/" を開いたときにその言語へ送る（serve.mjs が読む）
  document.querySelectorAll("[data-set-lang]").forEach((a) => a.addEventListener("click", () => {
    document.cookie = "ashika_lang=" + a.dataset.setLang + "; path=/; max-age=31536000; SameSite=Lax";
  }));

  // メールアドレスはページに書かず、押したときに組み立てる（迷惑メール対策）
  document.querySelectorAll("[data-mail]").forEach((b) => b.addEventListener("click", () => {
    const subject = b.dataset.subject ? "?subject=" + encodeURIComponent(b.dataset.subject) : "";
    location.href = "mailto:" + b.dataset.mail + "@" + b.dataset.domain + subject;
  }));

  // 色見本：押すとカラーコードをコピー
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(S.copied || b.dataset.copy); } catch (e) { toast(b.dataset.copy); }
  }));

  // ---- 動き（動きを減らす設定では何もしない） ----
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // 画面の下にあるものだけ、入ってきたときにふわっと出す。並んでいるものは順に少しずつ遅らせる
    const targets = document.querySelectorAll(".sec .wrap > *, .svc, .cards > li, .news li, .timeline li, .steps li, .faqs details, .rows > div, .door, .notes .wrap, .foot > *");
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight || el.querySelector(".rv") || el.closest(".rv")) return;
      el.classList.add("rv");
      el.style.setProperty("--d", Math.min(Array.from(el.parentElement.children).indexOf(el), 5));
      io.observe(el);
    });

    // 数字は数え上げる（「30円」「1/2」などは、先頭の数字だけ）
    const nums = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        nums.unobserve(e.target);
        const el = e.target, text = el.textContent, m = /^(\d+)(\D.*)?$/.exec(text);
        if (!m || text.includes("/")) continue;
        const to = Number(m[1]), rest = m[2] || "";
        let start = 0;
        const step = (now) => {
          if (!start) start = now;
          const p = Math.min(1, (now - start) / 900);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + rest;
          if (p < 1) requestAnimationFrame(step); else el.textContent = text;
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    document.querySelectorAll(".facts b, .big b").forEach((el) => nums.observe(el));
  }

  // ---- 水面からアシカが飛び出して、また飛び込む（サービスの欄の上の弧を「水面」に見立てる） ----
  // 弧が画面に入るたびに1回。水面はふくらんでから割れ、アシカは放物線で跳び、飛び込んだところがへこんで、しぶきが上がる。
  // 形は毎コマ計算して描く（Safari でも動くよう、CSS の path の動きには頼らない）。動きを減らす設定では出さない。
  const sea = document.querySelector(".arc");
  if (sea && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const NS = "http://www.w3.org/2000/svg";
    const box = document.createElement("div");
    box.className = "splash";
    box.setAttribute("aria-hidden", "true");
    box.innerHTML = '<span class="sp-jumper"><span class="sp-seal"></span><span class="sp-ball"></span></span>';
    const svg = document.createElementNS(NS, "svg");
    const water = document.createElementNS(NS, "path");
    water.setAttribute("class", "sp-water");
    const drops = Array.from({ length: 12 }, () => { const c = document.createElementNS(NS, "circle"); c.setAttribute("class", "sp-drop"); c.setAttribute("r", "0"); return c; });
    svg.append(water, ...drops);
    box.append(svg);
    sea.prepend(box);
    sea.classList.add("has-splash");
    const jumper = box.querySelector(".sp-jumper");

    // しぶきの粒（飛び出すときに5つ、飛び込むときに7つ）。向きと速さは決め打ち
    const seeds = [[-0.9, -1.0], [-0.4, -1.25], [0.1, -1.4], [0.5, -1.15], [0.95, -0.9],
                   [-1.1, -0.95], [-0.7, -1.3], [-0.25, -1.5], [0.2, -1.55], [0.6, -1.3], [1.0, -1.0], [1.3, -0.7]];
    const DUR = 3.5, OUT = 0.36, IN = 1.8;      // 全体の長さ、飛び出す時刻、飛び込む時刻（秒）
    let w = 0, depth = 0, sw = 0, sh = 0, playing = false, t0 = 0;

    const measure = () => {
      w = box.clientWidth;
      depth = w * 0.06;                          // 弧の深さ（中央がいちばん高い）
      sw = Math.max(86, Math.min(150, w * 0.2)); // アシカの幅
      sh = sw * 339 / 512;
      box.style.setProperty("--sw", sw + "px");
      svg.setAttribute("viewBox", `0 0 ${w} ${box.clientHeight}`);
    };
    const base = (x) => { const k = (x - w / 2) / (w / 2); return depth * k * k; };
    const bell = (x, c, sigma) => Math.exp(-((x - c) * (x - c)) / (2 * sigma * sigma));

    const draw = (t) => {
      const span = Math.min(190, w * 0.36), x0 = w / 2 - span / 2, x1 = w / 2 + span / 2, sigma = sw * 0.62;
      // 水面のゆがみ：飛び出す前のふくらみ → 揺れ戻し、飛び込みのへこみ → 揺れ戻し
      let a0 = 0, a1 = 0;
      if (t < OUT) a0 = 24 * Math.pow(t / OUT, 2);
      else a0 = 24 * Math.exp(-3.4 * (t - OUT)) * Math.cos(8.5 * (t - OUT));
      if (t >= IN) a1 = -22 * Math.exp(-3 * (t - IN)) * Math.cos(9 * (t - IN));
      const surf = (x) => base(x) - a0 * bell(x, x0, sigma) - a1 * bell(x, x1, sigma);
      let d = `M0 ${surf(0).toFixed(1)}`;
      for (let i = 1; i <= 48; i++) { const x = (w * i) / 48; d += `L${x.toFixed(1)} ${surf(x).toFixed(1)}`; }
      water.setAttribute("d", d + `L${w} ${box.clientHeight}L0 ${box.clientHeight}Z`);

      // アシカ：放物線で跳ぶ。上りは鼻を上に、下りは鼻を下に向ける
      const p = Math.max(0, Math.min(1, (t - (OUT - 0.1)) / (IN + 0.12 - (OUT - 0.1))));
      const high = Math.max(96, Math.min(150, w * 0.24)), under = sh * 0.75;
      const x = x0 + span * p;
      const y = base(x) + under - (high + under) * 4 * p * (1 - p);
      jumper.style.transform = `translate(${(x - sw / 2).toFixed(1)}px, ${(y - sh / 2).toFixed(1)}px) rotate(${(-42 + 84 * p).toFixed(1)}deg)`;
      jumper.style.visibility = p > 0 && p < 1 ? "visible" : "hidden";

      // しぶき
      drops.forEach((c, i) => {
        const first = i < 5, start = first ? OUT : IN, age = t - start;
        if (age < 0 || age > 0.9) { c.setAttribute("r", "0"); return; }
        const [vx, vy] = seeds[i], ox = first ? x0 : x1, speed = first ? 120 : 150;
        const cx = ox + vx * speed * 0.45 * age, cy = base(ox) + vy * speed * age + 420 * age * age;
        c.setAttribute("cx", cx.toFixed(1));
        c.setAttribute("cy", cy.toFixed(1));
        // 水面より下に落ちた粒は消す（水の中に沈んだことにする）
        c.setAttribute("r", cy > base(cx) + 2 ? "0" : ((first ? 3.2 : 3.8) * (1 - age / 0.9) + 0.6).toFixed(1));
      });
    };

    const frame = (now) => {
      const t = (now - t0) / 1000;
      draw(Math.min(t, DUR));
      if (t < DUR) requestAnimationFrame(frame);
      else playing = false;
    };
    const play = () => {
      if (playing) return;
      playing = true;
      measure();
      t0 = performance.now();
      requestAnimationFrame(frame);
    };

    measure();
    draw(DUR);
    addEventListener("resize", () => { if (!playing) { measure(); draw(DUR); } });
    // 弧が画面のまんなか寄りに入ったら始める。画面から出たら、次に入ったときにもう一度
    new IntersectionObserver((entries) => { if (entries[0].isIntersecting) play(); }, { rootMargin: "-25% 0px -30% 0px" }).observe(box);
  }

  // スマホのメニュー：外を押すか Esc で閉じる
  const menu = document.querySelector(".menu");
  if (menu) {
    document.addEventListener("click", (ev) => { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus(); } });
  }
})();
