/* PSI PM website behavior: fills settings from config.js, runs checkout, confirmation, and contact form. */
(function () {
  "use strict";
  var C = window.PSI || {};
  // the trademark symbol sits raised, level with the registered symbol, wherever the script writes a course name
  function tmHtml(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/™/g, '<span class="tm">™</span>'); }
  document.documentElement.classList.add("js");

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // First initial plus last name, lower case, letters only. The server makes the final decision
  // (it adds a number if the name is taken); this is only the preview shown to the student.
  function makeUsername(first, last) {
    var f = String(first || "").trim().charAt(0).toLowerCase().replace(/[^a-z]/g, "");
    var l = String(last || "").toLowerCase().replace(/[^a-z]/g, "");
    return f && l ? f + l : "";
  }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim()); }
  function functionsUrl() { return String(C.supabaseUrl || "").replace(/\/+$/, "") + "/functions/v1"; }
  function headers() {
    var h = { "Content-Type": "application/json" };
    if (C.supabaseKey) { h.apikey = C.supabaseKey; h.Authorization = "Bearer " + C.supabaseKey; }
    return h;
  }
  window.PSI_UTIL = { makeUsername: makeUsername, validEmail: validEmail };

  // Courses that can be bought online. Names follow the course catalog.
  var PROGRAMS = {
    pmp:   { name: "Advanced Project Management (PMP®) Training Program", short: "PMP® Training Program", page: "pmp.html",
             sub: "Live virtual class and 1 year of LMS access", fee: "Includes tuition and books. The PMP® exam fee and PMI membership are not included." },
    capm:  { name: "Project Management Fundamentals/CAPM® Course", short: "CAPM® Course", page: "capm.html",
             sub: "Live virtual class and 1 year of LMS access", fee: "Includes tuition and books. The CAPM® exam fee and PMI membership are not included." },
    cpmai: { name: "PMI-CPMAI™ Exam Prep Course", short: "PMI-CPMAI™ Exam Prep Course", page: "cpmai.html",
             sub: "Live virtual class and 1 year of LMS access", fee: "Includes the PMI-CPMAI™ exam fee. PMI membership is not included." },
    practical: { name: "Practical Project Management Course", short: "Practical Project Management", page: "practical.html",
             sub: "Three-day live virtual class", fee: "Includes tuition and books." }
  };
  // Self-paced courses (PDU courses and the Scrum and Theory of Constraints courses), sold one at a time. Names and PDU counts follow each course's listing.
  var PDU_FEE = "Finish the course to earn your Certificate of Completion and claim your PDUs with PMI.";
  [["pdu-wbs", "Work Breakdown Structure in Project Management", "Work Breakdown Structure", "pdu-work-breakdown-structure.html"],
   ["pdu-business-analysis", "Introduction to Business Analysis", "Introduction to Business Analysis", "pdu-introduction-to-business-analysis.html"],
   ["toc", "Theory of Constraints", "Theory of Constraints", "theory-of-constraints.html"],
   ["pdu-evm", "Earned Value Management", "Earned Value Management", "pdu-earned-value-management.html"],
   ["adv-scrum", "Advanced Scrum Mastery and Evidence-Based Management", "Advanced Scrum Mastery", "advanced-scrum-mastery.html"],
   ["psm", "Professional Scrum Master Fundamentals: Mastering Empirical Delivery", "Professional Scrum Master Fundamentals", "professional-scrum-master.html"],
   ["pdu-network", "Advanced Project Network Diagramming and Schedule", "Advanced Network Diagramming and Schedule", "pdu-network-diagramming-and-schedule.html"],
   ["pdu-ccpm", "Mastering Critical Chain Project Management: Principles, Application, and Analysis", "Critical Chain Project Management", "pdu-critical-chain-project-management.html"]
  ].forEach(function (p) { PROGRAMS[p[0]] = { name: p[1], short: p[2], page: p[3], sub: "Self-paced online course", fee: PDU_FEE }; });

  function isProgram(key) { return Object.prototype.hasOwnProperty.call(PROGRAMS, key); }
  function lmsFor(key) { return ((C.lmsPrograms || {})[key]) || C.lmsUrl || "#"; }

  /* ---------- settings from config.js ---------- */
  function applySettings() {
    var map = { phone: C.phone, email: C.email, address: C.address };
    $$("[data-site]").forEach(function (el) {
      var key = el.getAttribute("data-site");
      var val = key.indexOf("price:") === 0 ? (C.prices || {})[key.slice(6)] : map[key];
      if (val) { el.textContent = val; }
      else if (el.hasAttribute("data-fallback")) { el.textContent = el.getAttribute("data-fallback"); }
    });
    $$("[data-site-href]").forEach(function (el) {
      var key = el.getAttribute("data-site-href");
      if (key === "email" && C.email) el.setAttribute("href", "mailto:" + C.email);
      if (key === "phone" && C.phone) el.setAttribute("href", "tel:" + String(C.phone).replace(/[^\d+]/g, ""));
    });
    $$("[data-site-show]").forEach(function (el) {
      var key = el.getAttribute("data-site-show");
      el.hidden = !map[key];
    });
    $$("[data-lms]").forEach(function (el) {
      var k = el.getAttribute("data-lms");
      var url = k === "home" ? C.lmsUrl : lmsFor(k);
      if (url) el.setAttribute("href", url);
    });
  }

  /* ---------- checkout ---------- */
  /* The form works on the checkout page and, embedded, on each course page. All lookups stay inside the form's own
     page (or preview view), so several pages in one document never mix up their fields. */
  function initCheckout(root) {
    root = root || document;
    var form = root.querySelector("form[data-checkout]");
    if (!form || form.__psiBound) return;
    form.__psiBound = true;
    var grid = form.closest(".checkout-grid") || form.parentNode, scope = form.closest(".view") || document;
    function q(n) { return grid.querySelector('[data-f="' + n + '"]') || scope.querySelector('[data-f="' + n + '"]'); }
    var embedded = form.hasAttribute("data-embedded");
    var first = q("first"), last = q("last"), email = q("email"), agree = q("agree");
    var msg = q("msg"), btn = q("pay"), dateField = q("datefield"), dateSel = q("datesel");

    var key = embedded ? form.getAttribute("data-program")
      : (new URLSearchParams(window.__psiSearch ? window.__psiSearch() : window.location.search).get("program") || form.getAttribute("data-program") || "pmp");
    if (!isProgram(key)) key = "pmp";
    var prog = PROGRAMS[key];
    form.setAttribute("data-program", key);
    if (q("name")) q("name").innerHTML = tmHtml(prog.name);
    if (q("sub")) q("sub").innerHTML = tmHtml(prog.sub);
    if (q("fee")) q("fee").innerHTML = tmHtml(prog.fee || "");
    if (!embedded) {
      if (q("title")) q("title").innerHTML = "Enroll in the " + tmHtml(prog.name);
      $$("[data-site^='price:']", scope).forEach(function (el) { el.setAttribute("data-site", "price:" + key); });
      if ($("#back-link")) $("#back-link").setAttribute("href", prog.page);
      document.title = "Enroll in " + prog.short + " | PSI Project Management";
    }

    // Class dates come from config.js. With none listed, the choice is hidden.
    var dates = ((C.classDates || {})[key]) || [];
    dateSel.innerHTML = "";
    if (dates.length) {
      var ph = document.createElement("option"); ph.value = ""; ph.textContent = "Select a class date"; dateSel.appendChild(ph);
      dates.forEach(function (d) { var o = document.createElement("option"); o.value = d; o.textContent = d; dateSel.appendChild(o); });
    }
    dateField.hidden = !dates.length;
    applySettings();

    function show(text, kind) { msg.textContent = text; msg.className = "form-msg" + (kind ? " " + kind : ""); }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!first.value.trim() || !last.value.trim()) { show("Enter your first and last name.", "error"); (first.value.trim() ? last : first).focus(); return; }
      if (!validEmail(email.value)) { show("Enter a valid email address.", "error"); email.focus(); return; }
      if (dates.length && !dateSel.value) { show("Choose a class date.", "error"); dateSel.focus(); return; }
      if (!agree.checked) { show("Please confirm you agree to the Student Enrollment Agreement.", "error"); agree.focus(); return; }
      btn.disabled = true; show("Taking you to secure payment...", "");
      var payload = { program: key, first_name: first.value.trim(), last_name: last.value.trim(), email: email.value.trim() };
      if (dates.length) payload.class_date = dateSel.value;
      fetch(functionsUrl() + "/create-checkout-session", {
        method: "POST", headers: headers(), body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; });
      }).then(function (res) {
        if (res.ok && res.body && res.body.url) { window.__psiGo ? window.__psiGo(res.body.url) : (window.location.href = res.body.url); return; }
        throw new Error((res.body && res.body.message) || "We could not start your payment.");
      }).catch(function (err) {
        btn.disabled = false;
        show((err && err.message ? err.message : "We could not start your payment.") + " Please try again or contact us.", "error");
      });
    });
  }

  function initWelcome() {
    var box = $("#welcome-status");
    if (!box) return;
    var params = new URLSearchParams(window.__psiSearch ? window.__psiSearch() : window.location.search);
    var sid = params.get("session_id");
    var userEl = $("#w-username"), endEl = $("#w-ends"), note = $("#w-note");
    if (!sid) { note.textContent = "Your username and access dates are in the email we sent you."; userEl.textContent = "In your email"; endEl.textContent = "In your email"; return; }

    var tries = 0, max = 30;
    function poll() {
      tries++;
      fetch(functionsUrl() + "/checkout-status?session_id=" + encodeURIComponent(sid), { headers: headers() })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.status === "ready") {
            userEl.textContent = j.username || "In your email";
            endEl.textContent = j.access_ends ? formatDate(j.access_ends) : "In your email";
            note.textContent = "We emailed you a link to set your password.";
            $("#w-lede").textContent = "Your payment is confirmed and your student account is ready.";
            if (j.program && isProgram(j.program)) {
              $("#w-title").innerHTML = "You're enrolled in the " + tmHtml(PROGRAMS[j.program].short);
              var go = $("#w-go"); go.setAttribute("href", lmsFor(j.program)); go.textContent = "Go to your program";
            }
            if (j.class_date) { $("#w-class").textContent = j.class_date; $("#w-class-card").hidden = false; }
            celebrate();
            return;
          }
          if (j && j.status === "needs_attention") {
            userEl.textContent = "We are finishing your account";
            endEl.textContent = "You will hear from us shortly";
            note.textContent = "Your payment went through. A team member will complete your enrollment and email you. You can also contact us.";
            return;
          }
          again();
        })
        .catch(again);
    }
    function again() {
      if (tries >= max) {
        userEl.textContent = "In your email"; endEl.textContent = "In your email";
        note.textContent = "Your account is being set up. Check your email in a few minutes for your username and password link.";
        return;
      }
      setTimeout(poll, 2500);
    }
    function formatDate(s) {
      var d = new Date(s + (String(s).length <= 10 ? "T12:00:00" : ""));
      return isNaN(d) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
    poll();
  }

  /* ---------- contact form (opens the visitor's email app) ---------- */
  function initContact() {
    var form = $("#contact-form");
    if (!form) return;
    var msg = $("#contact-msg"), btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#c-name").value.trim(), from = $("#c-email").value.trim();
      var topic = $("#c-interest").value, body = $("#c-message").value.trim();
      function show(text, kind) { msg.textContent = text; msg.className = "form-msg" + (kind ? " " + kind : ""); }
      if (!name) { show("Enter your name.", "error"); $("#c-name").focus(); return; }
      if (!validEmail(from)) { show("Enter a valid email address.", "error"); $("#c-email").focus(); return; }
      if (!body) { show("Enter a message so we know how to help.", "error"); $("#c-message").focus(); return; }
      btn.disabled = true; show("Sending...", "");
      fetch(functionsUrl() + "/submit-contact", {
        method: "POST", headers: headers(),
        body: JSON.stringify({ name: name, email: from, interest: topic, message: body, company: ($("#c-company") || {}).value || "" })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; });
      }).then(function (res) {
        if (res.ok && res.body && res.body.ok) {
          form.reset();
          show("Thank you. Your message has been sent and we will reply by email.", "ok");
          btn.disabled = false;
          return;
        }
        throw new Error((res.body && res.body.message) || "");
      }).catch(function (err) {
        btn.disabled = false;
        var where = C.email ? " Please email us at " + C.email + " instead." : " Please try again shortly.";
        show((err && err.message ? err.message : "We could not send your message.") + where, "error");
      });
    });
  }



  /* ---------- rotating student comments ---------- */
  /* The rotating comments. A page can hold more than one (the home page has all of them, a course page has its own),
     and in the single-file preview every page is in one document, so each carousel is set up separately. */
  function initQuotes() {
    var all = $$(".carousel");
    if (!all.length) return;
    document.documentElement.classList.add("js-carousel");
    all.forEach(startCarousel);
  }

  function startCarousel(root) {
    if (root.__psiOn) return;
    root.__psiOn = true;
    var slides = $$(".quote", root), dots = $$(".qdot", root);
    var playBtn = $(".qplay", root), bar = $(".quote-progress", root), now = $(".qnow", root), stage = $(".quote-stage", root);
    var INTERVAL = window.__psiQuoteMs || 5000, idx = 0, timer = null, userPaused = false, hoverPaused = false;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!slides.length) return;
    root.style.setProperty("--qms", INTERVAL + "ms");

    function show(i, manual) {
      idx = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle("is-active", n === idx); s.setAttribute("aria-hidden", n === idx ? "false" : "true"); });
      dots.forEach(function (d, n) { if (n === idx) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      if (now) now.textContent = String(idx + 1);
      if (stage) stage.setAttribute("aria-live", manual || userPaused || reduce ? "polite" : "off");
      restart();
    }
    function running() { return !userPaused && !hoverPaused && !reduce && !document.hidden; }
    function restart() {
      clearTimeout(timer);
      if (bar) { bar.classList.remove("run"); void bar.offsetWidth; }
      if (running()) { if (bar) bar.classList.add("run"); timer = setTimeout(function () { show(idx + 1, false); }, INTERVAL); }
    }
    function setPaused(v) {
      userPaused = v;
      root.classList.toggle("is-paused", v);
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", v ? "true" : "false");
        playBtn.setAttribute("aria-label", v ? "Resume automatic rotation" : "Pause automatic rotation");
      }
      if (stage) stage.setAttribute("aria-live", v ? "polite" : "off");
      restart();
    }
    if ($(".qprev", root)) $(".qprev", root).addEventListener("click", function () { show(idx - 1, true); });
    if ($(".qnext", root)) $(".qnext", root).addEventListener("click", function () { show(idx + 1, true); });
    if (playBtn) playBtn.addEventListener("click", function () { setPaused(!userPaused); });
    dots.forEach(function (d, n) { d.addEventListener("click", function () { show(n, true); }); });
    // Hovering or focusing inside the section holds the current comment so it can be read.
    root.addEventListener("mouseenter", function () { hoverPaused = true; root.classList.add("is-paused"); restart(); });
    root.addEventListener("mouseleave", function () { hoverPaused = false; if (!userPaused) root.classList.remove("is-paused"); restart(); });
    root.addEventListener("focusin", function () { hoverPaused = true; root.classList.add("is-paused"); restart(); });
    root.addEventListener("focusout", function (e) { if (!root.contains(e.relatedTarget)) { hoverPaused = false; if (!userPaused) root.classList.remove("is-paused"); restart(); } });
    document.addEventListener("visibilitychange", restart);
    if (reduce) { root.classList.add("is-stopped"); if (playBtn) playBtn.hidden = true; }
    show(0, false);
  }



  /* ---------- scroll zoom-in, XP bar, count-up ---------- */
  var REVEAL_SEL = ".hero-copy,.hero-mark,.trust .ti,.page-head .container>*:not(.hero-split),.hero-split>*,main section>.container>h2,main section>.container>.lead-18,.cards>*,.team>*,.orgs li,.split-side,.split-main,.rows>.row,.band .container>*,.closing>*,.panel,.summary,.powerups>*,.acts>*,.how,.path-select>*,.path-panel,.carousel,.checkout-grid>*,.status-box>*,.achv";
  var STAGGER_SEL = ".cards>*,.team>*,.orgs li,.powerups>*,.acts>*,.path-select>*,.trust .ti,.status-box>*";
  var revealIO = null;
  function initReveal() {
    var root = document.documentElement;
    if (!root.classList.contains("js-reveal")) return;
    var els = $$(REVEAL_SEL).filter(function (e) { return !e.closest("header,footer"); });
    // stagger siblings so they pop in one after another
    $$(STAGGER_SEL).forEach(function (e) {
      var kids = Array.prototype.filter.call(e.parentNode.children, function (c) { return c.matches(STAGGER_SEL); });
      e.style.setProperty("--d", Math.min(kids.indexOf(e), 8) * 80 + "ms");
    });
    var alive = false;
    function show(e) { e.classList.add("is-in"); }
    // Way 1: the browser tells us when something scrolls into view.
    revealIO = new IntersectionObserver(function (entries) {
      alive = true;
      entries.forEach(function (en) { if (en.isIntersecting) show(en.target); });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (e) { revealIO.observe(e); });
    // Way 2: check positions ourselves on scroll, resize, touch and load, in case the signal above never arrives.
    var queued = false;
    function sweep() {
      queued = false;
      var h = window.innerHeight || root.clientHeight;
      els.forEach(function (e) {
        if (!e.classList.contains("is-in") && !e.closest("[hidden]") && e.getBoundingClientRect().top < h * 0.92) show(e);
      });
    }
    function queue() { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(sweep); } }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    window.addEventListener("touchmove", queue, { passive: true });
    window.addEventListener("load", queue);
    setTimeout(queue, 250); setTimeout(queue, 1200);
    // Way 3: if nothing has been reported by now, switch the animation off so nothing can stay hidden.
    setTimeout(function () {
      if (!alive && !els.some(function (e) { return e.classList.contains("is-in"); })) root.classList.remove("js-reveal");
    }, 3500);
    window.__psiSweep = queue;
  }
  // In the preview, pages are shown and hidden, so a shown page replays its animation.
  window.__psiRevealReset = function (root) { $$(".is-in", root).forEach(function (e) { e.classList.remove("is-in"); }); if (window.__psiSweep) setTimeout(window.__psiSweep, 60); };

  function initXP() {
    var fill = $(".xp-fill");
    if (!fill) return;
    var drift = document.documentElement.classList.contains("js-reveal");
    function tick() {
      var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      if (drift) h.style.setProperty("--sy", String(Math.round(window.scrollY)));
      fill.style.width = (max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0) + "%";
    }
    window.addEventListener("scroll", tick, { passive: true }); window.addEventListener("resize", tick); tick();
    window.__psiXP = tick;
  }

  function initCounts() {
    var nodes = $$(".count[data-to]");
    if (!nodes.length || !("IntersectionObserver" in window) || !document.documentElement.classList.contains("js-reveal")) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, to = Number(el.getAttribute("data-to")), suf = el.getAttribute("data-suffix") || "", t0 = null;
        io.unobserve(el);
        function step(ts) {
          if (t0 === null) t0 = ts;
          var k = Math.min(1, (ts - t0) / 1400), eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(to * eased).toLocaleString("en-US") + (k >= 1 ? suf : "");
          if (k < 1) requestAnimationFrame(step);
        }
        el.textContent = "0"; requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- choose your path ---------- */
  function initPath() {
    var box = $(".path-select"), panel = $("#path-panel");
    if (!box || !panel) return;
    var opts = $$(".path-opt", box);
    opts.forEach(function (o) {
      o.addEventListener("click", function (e) {
        e.preventDefault();
        opts.forEach(function (x) { x.classList.toggle("is-selected", x === o); x.setAttribute("aria-pressed", x === o ? "true" : "false"); });
        var key = o.getAttribute("data-key"), price = (C.prices || {})[key] || "", enroll = o.getAttribute("data-enroll");
        panel.className = "path-panel is-in is-open";
        var meta = o.getAttribute("data-meta") + (price ? "  |  " + price : "");
        panel.innerHTML = "";
        function add(tag, cls, text) { var n = document.createElement(tag); n.className = cls; n.innerHTML = tmHtml(text); panel.appendChild(n); return n; }
        add("p", "pp-k", "Path unlocked: " + o.getAttribute("data-level"));
        add("p", "pp-name", o.getAttribute("data-name"));
        add("p", "pp-meta", meta);
        add("p", "pp-blurb", o.getAttribute("data-blurb"));
        var row = document.createElement("div"); row.className = "cta-row";
        var a = document.createElement("a"); a.className = "btn btn-primary"; a.href = o.getAttribute("href"); a.textContent = "See the course"; row.appendChild(a);
        if (enroll) { var b = document.createElement("a"); b.className = "btn btn-ghost"; b.href = enroll; b.textContent = "Enroll now"; row.appendChild(b); }
        panel.appendChild(row);
      });
    });
  }

  /* ---------- achievement + confetti on the confirmation page ---------- */
  function celebrate() {
    var a = $("#w-achv"); if (a) { a.hidden = false; a.classList.add("is-in"); }
    if (!(window.matchMedia && !matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    var host = document.createElement("div"); host.className = "confetti"; host.setAttribute("aria-hidden", "true");
    var colors = ["#2563EB", "#38BDF8", "#FFFFFF", "#F59E0B", "#E11D48"];
    for (var i = 0; i < 44; i++) {
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100) + "%"; p.style.background = colors[i % colors.length];
      p.style.setProperty("--x", (Math.random() * 160 - 80) + "px"); p.style.setProperty("--r", (Math.random() * 900 - 450) + "deg");
      p.style.setProperty("--t", (1.8 + Math.random() * 1.2) + "s"); p.style.setProperty("--w", (Math.random() * 0.5) + "s");
      host.appendChild(p);
    }
    document.body.appendChild(host); setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 3600);
  }


  /* ---------- PDU course filter ---------- */
  function initPduFilter() {
    var chips = $$(".chip"), cards = $$("#pdu-cards .pdu-card"), count = $("#pdu-count");
    if (!chips.length) return;
    var labels = { all: "all", wow: "Ways of Working", ps: "Power Skills", ba: "Business Acumen" };
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        var cat = ch.getAttribute("data-cat"), shown = 0;
        chips.forEach(function (x) { var on = x === ch; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
        cards.forEach(function (c) {
          var match = cat === "all" || (" " + c.getAttribute("data-cats") + " ").indexOf(" " + cat + " ") > -1;
          c.hidden = !match; if (match) { shown++; c.classList.add("is-in"); }
        });
        count.textContent = cat === "all" ? "Showing all " + count.getAttribute("data-total") + " courses"
          : "Showing " + shown + " of " + count.getAttribute("data-total") + " courses that earn " + labels[cat] + " PDUs";
      });
    });
  }


  /* ---------- menu on small screens: the checkbox does the work; this just tidies up ---------- */
  /* The Enrollment Agreement opens in a lightbox over the page, so a student can read it without losing
     what they have typed. With scripts off the same links open the full agreement page instead. */
  function initAgreement() {
    $$(".lb-toggle").forEach(function (tog) {
      var box = tog.nextElementSibling;
      if (!box || !box.classList.contains("lb") || tog.__psiOn) return;
      tog.__psiOn = true;
      var scope = tog.closest("section, main") || document, lastFocus = null;
      function sync() {
        if (tog.checked) {
          lastFocus = document.activeElement;
          document.body.classList.add("lb-lock");
          var body = $(".lb-body", box);
          if (body) { body.scrollTop = 0; body.focus(); }
        } else {
          document.body.classList.remove("lb-lock");
          if (lastFocus && lastFocus.focus) lastFocus.focus();
        }
      }
      tog.addEventListener("change", sync);
      // the plain link inside the checkbox sentence opens it too, instead of leaving the page
      $$("a[data-agreement]", scope).forEach(function (a) {
        a.addEventListener("click", function (e) { e.preventDefault(); tog.checked = true; sync(); });
      });
      // the labels that open and close it can be used from the keyboard
      $$("label[tabindex]", scope).forEach(function (l) {
        l.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tog.checked = !tog.checked; sync(); }
        });
      });
      document.addEventListener("keydown", function (e) {
        if (!tog.checked) return;
        if (e.key === "Escape") { tog.checked = false; sync(); return; }
        if (e.key !== "Tab") return;
        var f = $$("a[href], button:not([disabled]), label[tabindex], [tabindex='0']", box).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    });
  }

  /* The hover menus under the two course tabs. Choosing an item (or the tab itself) closes the menu straight away,
     even though the mouse is still over it, and it opens again the next time the mouse comes back to the tab. */
  function initMenus() {
    var items = $$(".nav-item.has-menu");
    function shut(item) {
      item.classList.remove("menu-open");
      var c = $(".menu-caret", item);
      if (c) c.setAttribute("aria-expanded", "false");
    }
    function shutAll(except) { items.forEach(function (i) { if (i !== except) shut(i); }); }
    items.forEach(function (item) {
      if (item.__psiMenu) return;
      item.__psiMenu = true;
      var caret = $(".menu-caret", item), timer = null, openedAt = 0;
      function open() {
        clearTimeout(timer);
        if (item.classList.contains("menu-closed")) return;
        shutAll(item);
        if (!item.classList.contains("menu-open")) openedAt = Date.now();
        item.classList.add("menu-open");
        if (caret) caret.setAttribute("aria-expanded", "true");
      }
      // choosing an item closes the menu straight away, even though the mouse is still over it
      function closeNow() {
        clearTimeout(timer);
        shut(item);
        var f = document.activeElement;
        if (f && item.contains(f) && f.blur) f.blur();   // blur first: leaving focus would otherwise cancel "closed"
        item.classList.add("menu-closed");
      }
      // the script opens and closes the menu on hover itself, so it does not depend on the browser's own hover handling
      // "closed" lasts until the mouse comes back to the tab or keyboard focus leaves it
      item.addEventListener("mouseenter", function () { item.classList.remove("menu-closed"); open(); });
      item.addEventListener("mouseleave", function () {
        clearTimeout(timer);
        timer = setTimeout(function () { shut(item); }, 160);
      });
      item.addEventListener("focusout", function (e) { if (!item.contains(e.relatedTarget)) item.classList.remove("menu-closed"); });
      $$(".menu a, :scope > a", item).forEach(function (a) { a.addEventListener("click", closeNow); });
      if (caret) {
        caret.addEventListener("click", function (e) {
          e.preventDefault(); e.stopPropagation();
          // a tap fires a hover and then a click together, so a click right after opening must not close it again
          if (item.classList.contains("menu-open") && Date.now() - openedAt > 450) { shut(item); item.classList.add("menu-closed"); }
          else { item.classList.remove("menu-closed"); open(); }
        });
      }
      item.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && item.classList.contains("menu-open")) { shut(item); var l = $(":scope > a", item); if (l) l.focus(); item.classList.add("menu-closed"); }
      });
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".nav-item.has-menu")) { shutAll(); items.forEach(function (i) { i.classList.remove("menu-closed"); }); } });
  }

  function initNav() {
    initMenus();
    var box = $("#nav-check"), nav = $("#site-nav");
    if (!box || !nav) return;
    function close() { if (box.checked) box.checked = false; }
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.checked) { close(); var l = $(".nav-toggle"); if (l) l.focus && l.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 1120) close(); });
  }

  if (window.__psiPreview) {
    window.__psi = { applySettings: applySettings, initCheckout: initCheckout, initWelcome: initWelcome };
    window.__psiPrograms = PROGRAMS;
    applySettings(); initContact(); initQuotes(); initReveal(); initXP(); initCounts(); initPath(); initPduFilter(); initNav(); initAgreement();
  } else {
    applySettings();
    initCheckout();
    initWelcome();
    initContact();
    initQuotes();
    initReveal();
    initXP();
    initCounts();
    initPath();
    initPduFilter();
    initNav();
    initAgreement();
  }
})();
