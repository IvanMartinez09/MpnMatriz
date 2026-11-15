/* MPN MATRIZ - efectos finos: scroll suave, revelados, cursor propio, botones magneticos, avisos */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var E = {};

  /* scroll suave */
  E.lenis = null;
  if (!reduce && window.Lenis) {
    E.lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -72 } });
    (function raf(t) { E.lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  E.bloquear = function (si) {
    document.documentElement.style.overflow = si ? "hidden" : "";
    if (E.lenis) si ? E.lenis.stop() : E.lenis.start();
  };
  E.irA = function (sel) {
    var el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) return;
    if (E.lenis) E.lenis.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  /* revelados: lo que ya esta en pantalla aparece al cargar */
  var io = null;
  E.revelar = function (raiz) {
    var els = (raiz || document).querySelectorAll(".rv:not(.in)");
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    if (!io) io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  };
  if (!reduce) document.documentElement.classList.add("anim");

  /* cursor propio */
  if (fino && !reduce) {
    document.documentElement.classList.add("con-cursor");
    var p = document.createElement("div"), a = document.createElement("div");
    p.className = "cur cur-p"; a.className = "cur cur-a"; a.innerHTML = "<span></span>";
    document.body.appendChild(a); document.body.appendChild(p);
    var mx = -100, my = -100, ax = -100, ay = -100;
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      p.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      var t = e.target.closest && e.target.closest("[data-cursor],a,button,label,select,.chip");
      var txt = t && t.getAttribute("data-cursor");
      a.classList.toggle("txt", !!txt);
      p.classList.toggle("oculto", !!txt);
      a.classList.toggle("link", !!t && !txt);
      a.querySelector("span").textContent = txt || "";
      a.classList.toggle("oculto", !!(e.target.closest && e.target.closest("input,textarea")));
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mx = my = -100; });
    (function seguir() {
      ax += (mx - ax) * 0.18; ay += (my - ay) * 0.18;
      a.style.transform = "translate3d(" + ax + "px," + ay + "px,0)";
      requestAnimationFrame(seguir);
    })();
  }

  /* botones magneticos */
  E.magnetico = function (raiz) {
    if (!fino || reduce) return;
    (raiz || document).querySelectorAll("[data-mag]:not([data-mag-on])").forEach(function (b) {
      b.setAttribute("data-mag-on", "");
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + (e.clientX - r.left - r.width / 2) * 0.18 + "px," + (e.clientY - r.top - r.height / 2) * 0.28 + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  };

  /* avisos */
  var tt;
  E.aviso = function (msg, err) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("err", !!err); t.classList.add("on");
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove("on"); }, err ? 4200 : 2400);
  };

  E.dinero = function (n) {
    return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  E.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };

  window.MPN_FX = E;
})();
