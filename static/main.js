(() => {
  const root = document.documentElement;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const S = (() => { try { return JSON.parse(document.getElementById("strings").textContent); } catch (e) { return {}; } })();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  // light / dark
  // ---------------------------------------------------------------------------------------------
  const theme = document.getElementById("theme");
  const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  if (theme) {
    theme.setAttribute("aria-pressed", dark());
    theme.addEventListener("click", () => {
      root.dataset.theme = dark() ? "light" : "dark";
      store.set("ashika-theme", root.dataset.theme);
      theme.setAttribute("aria-pressed", dark());
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
  // reveal on scroll: a short fade, once. Nothing else moves with the scroll.
  // ---------------------------------------------------------------------------------------------
  const items = [...document.querySelectorAll(".rv")];
  const show = (el) => el.classList.add("in");
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach(show);
  } else {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { show(en.target); seen.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    items.forEach((el) => seen.observe(el));
    // some browsers (seen on iPhone Safari) do not always report elements as visible:
    // anything already on screen when the page settles is shown anyway
    addEventListener("load", () => items.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) show(el); }));
  }

  // header line once the page has scrolled
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------------------------------------------------------------------------------------------
  // brand page: click a color to copy it
  // ---------------------------------------------------------------------------------------------
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(`${S.copied || "Copied"}: ${b.dataset.copy}`); }
    catch (e) { toast(b.dataset.copy); }
  }));

  // a hello for people who open the console
  console.log("%cASHIKA Group%c  情報と世界を駆け巡る / Across information, around the world.\nSource: https://github.com/AKSHRK-Dev/ashika-group-site",
    "font: 800 20px Inter, sans-serif; color: #1b60a6", "font: 12px Inter, sans-serif; color: #5c6878");
})();
