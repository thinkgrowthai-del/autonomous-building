/* Autonomous Building Technology: site interactions */
(function () {
  'use strict';
  // Hidden "before" states (reveals, staggered lists, banner text) must apply instantly. Without .js-init
  // they would transition from visible to hidden at load, so content faded OUT (later items slowest).
  document.documentElement.classList.add('js-init');
  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero entrance (double rAF so the initial state paints first) ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.documentElement.classList.add('is-loaded'); });
  });

  /* ---------- Sticky header ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  function setNav(open, returnFocus) {
    header.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (!open && returnFocus) toggle.focus();
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      setNav(!header.classList.contains('is-open'), true);
    });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () { setNav(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) setNav(false, true);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1200 && header.classList.contains('is-open')) setNav(false);
    });
  }

  /* ---------- Staggered lists: each child gets --i so CSS can cascade them ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('.system, .five-zero__list, .info-grid, .team-list, .pill-list, .starter').forEach(function (list) {
      list.classList.add('js-stagger');
      if (!list.classList.contains('reveal') && !list.closest('.reveal')) list.classList.add('reveal');
      Array.prototype.forEach.call(list.children, function (child, i) { child.style.setProperty('--i', i); });
    });
  }
  void document.documentElement.offsetHeight; // commit the hidden states with transitions off
  document.documentElement.classList.remove('js-init');

  /* ---------- Reveal on scroll (items entering together are sequenced) ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var watch = new Map(); // observed element -> reveal elements it triggers
    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        watch.get(entry.target).forEach(function (el) {
          if (n) {
            el.style.transitionDelay = (n * 90) + 'ms';
            setTimeout(function () { el.style.transitionDelay = ''; }, 1600);
          }
          n++;
          el.classList.add('is-visible');
        });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) {
      // Unmasking headings start fully clipped, and IntersectionObserver honours the target's own
      // clip-path, so they would never "intersect". Watch their (unclipped) parent instead.
      var target = el.matches('h2.reveal, .statement.reveal') ? el.parentElement : el;
      if (!watch.has(target)) { watch.set(target, []); io.observe(target); }
      watch.get(target).push(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Rotator: shared by the hero crossfade and the region spotlight ----------
     The progress bar's CSS animation is the clock: when it ends, the next item shows.
     Pausing the animation (hover, hidden tab, pause button) therefore pauses the rotation. */
  function rotator(o) {
    var i = 0, stopped = false;
    o.root.style.setProperty('--interval', o.interval + 'ms');
    function run() {
      var b = o.bars[i];
      b.classList.remove('is-running');
      void b.offsetWidth; // restart the animation
      b.classList.add('is-running');
    }
    function go(n) {
      o.bars[i].classList.remove('is-running');
      i = (n + o.count) % o.count;
      o.show(i);
      if (!stopped) run();
    }
    function next() {
      var n = (i + 1) % o.count, img = o.image && o.image(n);
      if (!img || img.complete) return go(n);
      // Wait for the next photo so we never fade to a blank frame; a failed image must not stall the rotation
      var done = false, onReady = function () { if (!done) { done = true; go(n); } };
      img.addEventListener('load', onReady, { once: true });
      img.addEventListener('error', onReady, { once: true });
    }
    o.bars.forEach(function (b) {
      b.addEventListener('animationend', function () { if (!stopped && b === o.bars[i]) next(); });
    });
    document.addEventListener('visibilitychange', function () { o.root.classList.toggle('is-away', document.hidden); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        // Several records can arrive in one batch (e.g. a fast scroll): the newest one wins
        o.root.classList.toggle('is-away', !entries[entries.length - 1].isIntersecting || document.hidden);
      }, { threshold: 0.35 }).observe(o.root);
    }
    run();
    return {
      go: go,
      stop: function () { stopped = true; o.bars[i].classList.remove('is-running'); }
    };
  }

  /* ---------- Hero crossfade ---------- */
  var heroSlides = document.querySelector('.hero__slides');
  if (heroSlides && !reduceMotion) {
    var slides = Array.prototype.slice.call(heroSlides.querySelectorAll('.hero__img'));
    var controls = document.querySelector('.hero__controls');
    var hero = document.querySelector('.hero');
    var pauseBtn = controls.querySelector('.hero__pause');
    var current = 0;
    controls.hidden = false;
    rotator({
      root: hero,
      interval: +heroSlides.getAttribute('data-slideshow') || 7000,
      count: slides.length,
      bars: Array.prototype.slice.call(controls.querySelectorAll('.hero__bars span')),
      image: function (n) { return slides[n]; },
      show: function (n) {
        var prev = slides[current];
        prev.classList.remove('is-active');
        prev.classList.add('is-leaving');
        setTimeout(function () { prev.classList.remove('is-leaving'); }, 1700);
        slides[n].classList.add('is-active');
        current = n;
      }
    });
    pauseBtn.addEventListener('click', function () {
      var paused = hero.classList.toggle('is-paused');
      pauseBtn.setAttribute('aria-label', paused ? 'Play background slideshow' : 'Pause background slideshow');
    });
  }

  /* ---------- Region spotlight (tabs; auto-advances until the visitor picks one) ---------- */
  var spot = document.querySelector('[data-spotlight]');
  if (spot) {
    var tabs = Array.prototype.slice.call(spot.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    var showRegion = function (n) {
      tabs.forEach(function (t, k) {
        var on = k === n;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].classList.toggle('is-active', on);
      });
    };
    var rot = null;
    if (!reduceMotion) {
      rot = rotator({
        root: spot,
        interval: +spot.getAttribute('data-spotlight') || 6000,
        count: tabs.length,
        bars: tabs.map(function (t) { return t.querySelector('.spotlight__bar'); }),
        image: function (n) { return panels[n].querySelector('img'); },
        show: showRegion
      });
      spot.addEventListener('mouseenter', function () { spot.classList.add('is-held'); });
      spot.addEventListener('mouseleave', function () { spot.classList.remove('is-held'); });
      spot.addEventListener('focusin', function () { spot.classList.add('is-held'); });
      spot.addEventListener('focusout', function () { spot.classList.remove('is-held'); });
    }
    var pick = function (n) {
      if (rot) { rot.stop(); rot.go(n); } else showRegion(n);
    };
    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { pick(k); });
      t.addEventListener('keydown', function (e) {
        var n = { ArrowRight: k + 1, ArrowDown: k + 1, ArrowLeft: k - 1, ArrowUp: k - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (n === undefined) return;
        e.preventDefault();
        n = (n + tabs.length) % tabs.length;
        pick(n);
        tabs[n].focus();
      });
    });
  }

  /* ---------- 5 Zero: highlight the outcome at the centre of the screen ---------- */
  var fzList = document.querySelector('.five-zero__list');
  if (fzList) {
    var fzRows = Array.prototype.slice.call(fzList.querySelectorAll('li'));
    var fzTicking = false;
    var fzUpdate = function () {
      fzTicking = false;
      var mid = window.innerHeight / 2, any = false;
      fzRows.forEach(function (row) {
        var r = row.getBoundingClientRect(), on = r.top <= mid && r.bottom > mid;
        row.classList.toggle('is-current', on);
        any = any || on;
      });
      fzList.classList.toggle('has-current', any); // only dim the others while one row is in focus
    };
    var fzRequest = function () { if (!fzTicking) { fzTicking = true; requestAnimationFrame(fzUpdate); } };
    window.addEventListener('scroll', fzRequest, { passive: true });
    window.addEventListener('resize', fzRequest);
    fzUpdate();
  }

  /* ---------- Gentle parallax on large photos ---------- */
  var topLayers = document.querySelectorAll('.hero__slides, .page-banner__img');
  var bandLayers = document.querySelectorAll('.photo-band img');
  if (!reduceMotion && (topLayers.length || bandLayers.length)) {
    var wide = window.matchMedia('(min-width: 768px)');
    var ticking = false;
    var parallax = function () {
      ticking = false;
      var on = wide.matches, vh = window.innerHeight;
      document.documentElement.classList.toggle('has-parallax', on);
      if (!on) return;
      topLayers.forEach(function (el) {
        var y = Math.min(window.scrollY, el.parentNode.offsetHeight);
        el.style.setProperty('--py', (y * 0.25).toFixed(1) + 'px');
      });
      bandLayers.forEach(function (el) {
        var r = el.parentNode.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // 1 entering → -1 leaving
        el.style.setProperty('--py', (-p * 32).toFixed(1) + 'px');
      });
    };
    var requestParallax = function () { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } };
    window.addEventListener('scroll', requestParallax, { passive: true });
    window.addEventListener('resize', requestParallax);
    parallax();
  }

  /* ---------- Contact form ---------- */
  var form = document.querySelector('#consult-form');
  if (form) {
    // Pre-select the service from ?service=<id> (links from the Services page)
    var svc = new URLSearchParams(window.location.search).get('service');
    var select = form.querySelector('#service');
    if (svc && select) {
      Array.prototype.forEach.call(select.options, function (o) { if (o.value === svc) select.value = svc; });
    }

    var status = document.querySelector('#form-status');
    var submit = form.querySelector('button[type="submit"]');

    function validateField(field) {
      var input = field.querySelector('input, select, textarea');
      if (!input) return true;
      var ok = input.checkValidity();
      field.classList.toggle('has-error', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      return ok;
    }
    form.querySelectorAll('.field').forEach(function (field) {
      var input = field.querySelector('input, select, textarea');
      if (input) input.addEventListener('blur', function () { validateField(field); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      // Honeypot: silently drop bot submissions
      if (form.querySelector('[name="_gotcha"]').value) return;

      var valid = true, firstInvalid = null;
      form.querySelectorAll('.field').forEach(function (field) {
        if (!validateField(field)) {
          valid = false;
          if (!firstInvalid) firstInvalid = field.querySelector('input, select, textarea');
        }
      });
      if (!valid) { firstInvalid.focus(); return; }

      submit.disabled = true;
      var label = submit.innerHTML;
      submit.textContent = 'Sending…';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        status.className = 'form-status is-success';
        status.textContent = 'Thank you. Your message has been sent and the team will be in touch.';
      }).catch(function () {
        status.className = 'form-status is-error';
        status.textContent = 'Sorry, your message could not be sent just now. Please try again shortly.';
      }).finally(function () {
        submit.disabled = false;
        submit.innerHTML = label;
        status.focus();
      });
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
