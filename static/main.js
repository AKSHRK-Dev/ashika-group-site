(() => {
  const root = document.documentElement;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  // light / dark
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
    location.href = "mailto:" + b.dataset.mail + "@" + b.dataset.domain;
  }));
})();
