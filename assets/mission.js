/* ============================================================
   PROJECT PHOSPHORUS — page behavior
   No framework, no build step. One rAF loop drives every
   scroll-linked graphic; everything else is rendered once
   from assets/data.js.
   ============================================================ */
(function () {
  'use strict';

  var D = window.PHOS || {};
  var TRAJ = D.TRAJ;

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- tiny helpers -------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function fmt(n, dp) {
    var s = Math.abs(n) >= 1000 ? Number(n).toLocaleString('en-GB', {
      minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0
    }) : Number(n).toFixed(dp || 0);
    return s.replace(/,/g, ' ');
  }
  function dayToDate(iso, offset) {
    var d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function prettyDate(iso) {
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var p = iso.split('-');
    return p[2].replace(/^0/, '') + ' ' + M[+p[1] - 1] + ' ' + p[0];
  }

  /* Piecewise keyframe map: [[in, out], ...] with in ascending. */
  function keyed(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        var f = (t - a[0]) / (b[0] - a[0] || 1);
        return lerp(a[1], b[1], f);
      }
    }
    return stops[stops.length - 1][1];
  }

  /* ---------- scroll engine ------------------------------- */

  var ticks = [];
  var needsFrame = false;

  function onTick(fn) { ticks.push(fn); }

  function frame() {
    needsFrame = false;
    var vh = window.innerHeight;
    var doc = document.documentElement;
    var total = doc.scrollHeight - vh;
    var page = total > 0 ? clamp(window.scrollY / total, 0, 1) : 0;
    doc.style.setProperty('--scroll', page.toFixed(4));
    for (var i = 0; i < ticks.length; i++) ticks[i](vh, page);
  }

  function request() {
    if (!needsFrame) { needsFrame = true; requestAnimationFrame(frame); }
  }

  /* Progress of a sticky track: 0 when its top reaches the top of the
     viewport, 1 when its bottom reaches the bottom. */
  function trackProgress(track) {
    var r = track.getBoundingClientRect();
    var span = track.offsetHeight - window.innerHeight;
    if (span <= 0) return r.top <= 0 ? 1 : 0;
    return clamp(-r.top / span, 0, 1);
  }

  /* ---------- starfield ----------------------------------- */

  function starfield(canvas) {
    var ctx = canvas.getContext('2d');
    var stars = [];
    var w = 0, h = 0, dpr = 1;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(clamp(w * h / 5200, 60, 420));
      stars = [];
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() < 0.86 ? Math.random() * 0.8 + 0.25 : Math.random() * 1.5 + 0.9,
          a: Math.random() * 0.55 + 0.18,
          d: Math.random() * 0.55 + 0.25,      /* parallax depth */
          p: Math.random() * Math.PI * 2       /* twinkle phase */
        });
      }
      draw(0);
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      var off = (window.scrollY || 0) * 0.12;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var y = s.y - off * s.d;
        y = ((y % h) + h) % h;
        var tw = REDUCED ? 1 : 0.78 + 0.22 * Math.sin(t * 0.0011 + s.p);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.r > 1.1 ? '#F2E8D0' : '#CFC7B4';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    var raf;
    function loop(t) { draw(t); raf = requestAnimationFrame(loop); }

    size();
    window.addEventListener('resize', size, { passive: true });
    if (REDUCED) { onTick(function () { draw(0); }); }
    else { raf = requestAnimationFrame(loop); }
  }

  /* ---------- hero stats ---------------------------------- */

  function buildHero() {
    var wrap = $('#heroStats');
    if (!wrap) return;
    var M = D.MISSION;
    /* one number up top; the rest live in the ledger below */
    var rows = [
      ['Round trip', fmt(M.totalDays), 'days']
    ];
    rows.forEach(function (r) {
      var d = el('div', 'hero__stat');
      d.appendChild(el('dt', null, r[0]));
      var dd = el('dd');
      dd.appendChild(document.createTextNode(r[1]));
      dd.appendChild(el('small', null, ' ' + r[2]));
      d.appendChild(dd);
      wrap.appendChild(d);
    });
  }

  /* ---------- ledger -------------------------------------- */

  function buildLedger() {
    var wrap = $('#ledger');
    if (!wrap) return;
    var head = el('div', 'ledger__head');
    ['', 'Venus', 'Mars', ''].forEach(function (t) { head.appendChild(el('div', null, t)); });
    wrap.appendChild(head);

    D.LEDGER.forEach(function (row) {
      var r = el('div', 'ledger__row');
      r.setAttribute('data-win', row.win);
      r.appendChild(el('div', 'ledger__metric', row.metric));
      r.appendChild(el('div', 'ledger__v num', row.venus));
      r.appendChild(el('div', 'ledger__m num', row.mars));
      r.appendChild(el('div', 'ledger__note', row.note));
      wrap.appendChild(r);
    });
  }

  /* ---------- atmospheric interpolation ------------------- */

  var P = D.PROFILE || [];

  function sample(km) {
    km = clamp(km, P[0].km, P[P.length - 1].km);
    var lo = P[0], hi = P[P.length - 1];
    for (var i = 1; i < P.length; i++) {
      if (km <= P[i].km) { lo = P[i - 1]; hi = P[i]; break; }
    }
    var f = (km - lo.km) / (hi.km - lo.km || 1);
    function logi(a, b) { return Math.exp(lerp(Math.log(Math.max(a, 1e-9)), Math.log(Math.max(b, 1e-9)), f)); }
    return {
      km: km,
      tC: lerp(lo.tC, hi.tC, f),
      atm: logi(lo.atm, hi.atm),
      rho: logi(lo.rho, hi.rho),
      liftAir: logi(lo.liftAir, hi.liftAir),
      liftHe: logi(lo.liftHe, hi.liftHe),
      shield: logi(lo.shield, hi.shield)
    };
  }

  function zoneOf(km) {
    if (km >= 90) return ['Vacuum', 'space'];
    if (km >= 70) return ['Upper haze', 'haze'];
    if (km >= 56.5) return ['Upper cloud deck', 'cloud'];
    if (km > 54) return ['Middle cloud deck', 'cloud'];
    if (km >= 50) return ['THE BAND — habitable', 'band'];
    if (km >= 47.5) return ['Lower cloud deck', 'cloud'];
    if (km >= 30) return ['Too hot to float', 'hot'];
    if (km >= 5) return ['Furnace', 'hot'];
    return ['Surface — 92 atm, 464 °C', 'surface'];
  }

  /* ---------- descent stage (canvas) ---------------------- */

  var SKY = [
    [100, [5, 5, 12], [10, 9, 18]],
    [72, [10, 9, 18], [30, 22, 54]],
    [62, [26, 21, 52], [78, 60, 92]],
    [56, [72, 60, 90], [176, 150, 104]],
    [52, [116, 98, 84], [214, 176, 112]],
    [48, [186, 143, 82], [222, 164, 86]],
    [40, [200, 140, 68], [206, 116, 52]],
    [25, [186, 102, 46], [168, 63, 24]],
    [10, [147, 64, 26], [122, 42, 16]],
    [0, [122, 42, 16], [74, 20, 8]]
  ];

  function skyAt(km) {
    var a = SKY[0], b = SKY[SKY.length - 1];
    for (var i = 1; i < SKY.length; i++) {
      if (km >= SKY[i][0]) { a = SKY[i - 1]; b = SKY[i]; break; }
      a = SKY[i - 1]; b = SKY[i];
    }
    var f = clamp((a[0] - km) / (a[0] - b[0] || 1), 0, 1);
    function mix(i, j) {
      return 'rgb(' + Math.round(lerp(a[i][j], b[i][j], f)) + ',' +
        Math.round(lerp(a[i][j + 1], b[i][j + 1], f)) + ',' +
        Math.round(lerp(a[i][j + 2], b[i][j + 2], f)) + ')';
    }
    return [mix(1, 0), mix(2, 0)];
  }

  var ALT_STOPS = [
    [0.00, 100], [0.16, 72], [0.26, 63], [0.36, 58],
    [0.46, 55], [0.58, 52], [0.68, 49.5], [0.76, 45],
    [0.85, 32], [0.93, 14], [1.00, 0]
  ];

  function descentStage(ship3d) {
    var stage = $('#descent');
    if (!stage) return;
    var track = $('.stage__track', stage);
    var canvas = $('#descentCanvas');
    var ctx = canvas.getContext('2d');
    var out = {
      alt: $('#dAlt'), temp: $('#dTemp'), pres: $('#dPres'),
      lift: $('#dLift'), shield: $('#dShield'), zone: $('#dZone')
    };
    var marker = $('#dMarker');
    var scale = $('#dScale');

    /* altitude ticks down the left edge */
    var TICKS = [100, 90, 80, 70, 60, 55, 50, 45, 40, 30, 20, 10, 0];
    var tickNodes = TICKS.map(function (t) {
      var n = el('div', 'descent__tick', t + ' km');
      if (t % 20 === 0 || t === 50 || t === 55) n.setAttribute('data-major', '1');
      scale.appendChild(n);
      return n;
    });

    /* procedural cloud streaks, fixed to altitudes */
    var streaks = [];
    (function () {
      var seed = 20420727;
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      for (var i = 0; i < 260; i++) {
        var km = 24 + rnd() * 64;                     /* 24 – 88 km */
        var dense = km > 47 && km < 71 ? 1 : 0.28;    /* the real decks */
        streaks.push({
          km: km,
          depth: 0.42 + rnd() * 0.62,
          x: rnd() * 1.6 - 0.3,
          w: (0.22 + rnd() * 0.78),
          h: 6 + rnd() * 34,
          a: (0.05 + rnd() * 0.3) * dense,
          warm: rnd()
        });
      }
      streaks.sort(function (a, b) { return a.depth - b.depth; });
    })();

    var w = 0, h = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var SPAN = 30; /* km visible top-to-bottom */

    function render(alt) {
      if (!w || !h) size();
      var pxPerKm = h / SPAN;
      function yOf(km) { return h / 2 + (alt - km) * pxPerKm; }

      var sky = skyAt(alt);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, sky[0]);
      g.addColorStop(1, sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      /* streaks */
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        var y = h / 2 + (alt - s.km) * pxPerKm * s.depth;
        if (y < -80 || y > h + 80) continue;
        var sw = w * s.w * (0.6 + s.depth * 0.8);
        var sx = s.x * w - sw * 0.2;
        var fade = clamp(1 - Math.abs(s.km - alt) / (SPAN * 0.9), 0, 1);
        var grad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
        var col = s.warm > 0.5 ? '242,232,208' : '232,205,150';
        grad.addColorStop(0, 'rgba(' + col + ',0)');
        grad.addColorStop(0.5, 'rgba(' + col + ',' + (s.a * fade).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.ellipse) ctx.ellipse(sx + sw / 2, y, sw / 2, s.h * s.depth / 2, 0, 0, Math.PI * 2);
        else ctx.rect(sx, y - s.h * s.depth / 2, sw, s.h * s.depth);
        ctx.fill();
      }

      /* the band, 50–54 km */
      var yb = yOf(D.FLOAT_BAND.hi), yl = yOf(D.FLOAT_BAND.lo);
      if (yl > -60 && yb < h + 60) {
        ctx.fillStyle = 'rgba(95,208,196,0.10)';
        ctx.fillRect(0, yb, w, yl - yb);
        ctx.strokeStyle = 'rgba(95,208,196,0.55)';
        ctx.lineWidth = 1;
        [yb, yl].forEach(function (y) {
          ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
        });
        ctx.fillStyle = 'rgba(95,208,196,0.95)';
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        ctx.fillText('FLOAT BAND  50 – 54 km', 18, yb - 9);
      }

      /* the airship, parked at 52 km — in three dimensions when WebGL is up */
      var ys = yOf(52);
      var shipLen = Math.min(w * 0.34, 260);
      if (ship3d) {
        ship3d(alt, w, h, { span: SPAN, x: 0.62, len: shipLen });
      } else if (ys > -120 && ys < h + 120) {
        var scaleF = clamp(1 - Math.abs(52 - alt) / 26, 0.15, 1);
        drawShip(ctx, w * 0.62, ys, shipLen, scaleF);
      }

      /* the surface */
      var y0 = yOf(0);
      if (y0 < h + 40) {
        var sg = ctx.createLinearGradient(0, y0 - 60, 0, h);
        sg.addColorStop(0, 'rgba(199,56,27,0)');
        sg.addColorStop(0.5, 'rgba(199,56,27,0.75)');
        sg.addColorStop(1, 'rgba(60,12,6,1)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, y0 - 60, w, h - y0 + 60);
        ctx.strokeStyle = 'rgba(255,122,69,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        for (var x = 0; x <= w; x += 14) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.021) * 5 + Math.sin(x * 0.007) * 9);
        }
        ctx.stroke();
      }

      /* left-edge tick positions */
      for (var t = 0; t < TICKS.length; t++) {
        var node = tickNodes[t];
        var ty = yOf(TICKS[t]);
        node.style.top = ty + 'px';
        node.style.opacity = (ty < -10 || ty > h + 10) ? 0 : 1;
      }
      marker.style.top = (h / 2) + 'px';
    }

    function drawShip(c, cx, cy, len, k) {
      var a = len / 2, b = len / 7.6;
      c.save();
      c.globalAlpha = clamp(k, 0, 1);
      c.fillStyle = 'rgba(20,18,35,0.92)';
      c.strokeStyle = 'rgba(242,232,208,0.9)';
      c.lineWidth = 1.4;
      c.beginPath();
      if (c.ellipse) c.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
      c.fill(); c.stroke();
      /* solar crown */
      c.beginPath();
      c.strokeStyle = 'rgba(232,179,58,0.9)';
      c.lineWidth = 2;
      c.moveTo(cx - a * 0.62, cy - b * 0.74);
      c.quadraticCurveTo(cx, cy - b * 1.08, cx + a * 0.62, cy - b * 0.74);
      c.stroke();
      /* gondola */
      c.fillStyle = 'rgba(95,208,196,0.95)';
      c.fillRect(cx - a * 0.2, cy + b * 0.86, a * 0.4, b * 0.52);
      c.strokeStyle = 'rgba(242,232,208,0.5)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx - a * 0.16, cy + b * 0.86); c.lineTo(cx - a * 0.3, cy + b * 0.2);
      c.moveTo(cx + a * 0.16, cy + b * 0.86); c.lineTo(cx + a * 0.3, cy + b * 0.2);
      c.stroke();
      c.restore();
    }

    var last = -1;
    onTick(function () {
      var p = trackProgress(track);
      var alt = keyed(ALT_STOPS, p);
      if (Math.abs(alt - last) < 0.012) return;
      last = alt;
      var s = sample(alt);
      var z = zoneOf(alt);
      render(alt);
      out.alt.firstChild.nodeValue = alt.toFixed(1);
      out.temp.firstChild.nodeValue = fmt(s.tC, 0);
      out.pres.firstChild.nodeValue = s.atm >= 1 ? s.atm.toFixed(2) : s.atm.toFixed(3);
      out.lift.firstChild.nodeValue = s.liftAir >= 1 ? s.liftAir.toFixed(2) : s.liftAir.toFixed(3);
      out.shield.firstChild.nodeValue = fmt(s.shield, 0);
      out.zone.textContent = z[0];
      out.temp.setAttribute('data-hot', s.tC > 90 ? '1' : '0');
      out.pres.setAttribute('data-hot', s.atm > 2 ? '1' : '0');
      out.alt.setAttribute('data-band', z[1] === 'band' ? '1' : '0');
      out.zone.style.color = z[1] === 'band' ? 'var(--aqua)' :
        z[1] === 'hot' || z[1] === 'surface' ? 'var(--ember)' : 'var(--cream)';
    });

    window.addEventListener('resize', function () { size(); last = -1; request(); }, { passive: true });
    size();
    render(100);
  }

  /* ---------- program phases ---------------------------- */

  function buildPhases() {
    var wrap = $('#phases');
    if (!wrap) return;
    D.PHASES.forEach(function (ph) {
      var p = el('article', 'phase');
      p.setAttribute('data-status', ph.status);

      var id = el('div', 'phase__id');
      id.appendChild(el('p', 'phase__tag', ph.tag));
      id.appendChild(el('h3', 'phase__name', ph.name));
      id.appendChild(el('p', 'phase__years num', ph.years));
      if (ph.window) id.appendChild(el('p', 'phase__years num', '◷ ' + ph.window));
      id.appendChild(el('span', 'phase__badge', ph.status === 'funded' ? 'Funded or committed' : ph.status === 'flagship' ? 'Flagship' : 'Proposed'));
      p.appendChild(id);

      var body = el('div', 'phase__body');
      body.appendChild(el('p', 'phase__thesis', ph.thesis));
      var items = el('div', 'phase__items');
      ph.items.forEach(function (it) {
        var row = el('div', 'phase__item');
        var hd = el('div', 'phase__item-h');
        hd.appendChild(el('p', 'phase__item-n', it.name));
        hd.appendChild(el('p', 'phase__item-w', it.who + (it.when ? ' · ' + it.when : '')));
        row.appendChild(hd);
        row.appendChild(el('p', 'phase__item-d', it.what));
        items.appendChild(row);
      });
      body.appendChild(items);
      p.appendChild(body);
      wrap.appendChild(p);
    });

    var nodes = Array.prototype.slice.call(wrap.querySelectorAll('.phase'));
    onTick(function (vh) {
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        var on = r.top < vh * 0.6 && r.bottom > vh * 0.25;
        nodes[i].classList.toggle('is-active', on);
      }
    });
  }

  /* ---------- launch-window table ------------------------- */

  function buildWindows() {
    var body = $('#windowRows');
    if (!body) return;
    D.WINDOWS.forEach(function (w) {
      var tr = el('tr');
      if (w.use && w.use.indexOf('PHASE 4') === 0) tr.setAttribute('data-flag', 'crew');
      [
        [prettyDate(w.open) + ' → ' + prettyDate(w.close), 'left'],
        [prettyDate(w.best), null],
        [prettyDate(w.arrive), null],
        [w.tof + ' d', null],
        [w.c3.toFixed(2), null],
        [w.vinf.toFixed(2), null]
      ].forEach(function (c) {
        var td = el('td', null, c[0]);
        if (c[1] === 'left') td.style.textAlign = 'left';
        tr.appendChild(td);
      });
      var use = el('td', 'use', w.use || '—');
      tr.appendChild(use);
      body.appendChild(tr);
    });
  }

  /* ---------- airship cutaway ----------------------------- */

  function cutaway() {
    var host = $('#shipSvg');
    if (!host) return;
    var W = 1440, H = 560;
    var s = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: '100%',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Cutaway of the Phosphorus airship: a 129 meter envelope carrying sealed helium lift cells above an ambient-pressure breathable-air volume, with a gondola holding the habitat module and the Vesper ascent vehicle'
    });

    var cx = 720, cy = 190, a = 340, b = 92;
    var LX = 318, RX = 1126;        /* label columns */

    var defs = svg('defs');
    var lg = svg('linearGradient', { id: 'env', x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(svg('stop', { offset: '0%', 'stop-color': '#232037' }));
    lg.appendChild(svg('stop', { offset: '100%', 'stop-color': '#12101F' }));
    defs.appendChild(lg);
    s.appendChild(defs);

    s.appendChild(svg('ellipse', { cx: cx, cy: cy, rx: a, ry: b, fill: 'url(#env)', stroke: '#F2E8D0', 'stroke-width': 2.2 }));

    /* sealed helium lift cells */
    [-0.58, -0.195, 0.195, 0.58].forEach(function (f) {
      s.appendChild(svg('ellipse', {
        cx: cx + a * f, cy: cy - b * 0.22, rx: a * 0.17, ry: b * 0.48,
        fill: 'rgba(232,179,58,0.16)', stroke: 'rgba(232,179,58,0.72)', 'stroke-width': 1.6
      }));
    });

    /* ambient-pressure breathable-air volume, lower hull */
    s.appendChild(svg('path', {
      d: 'M' + (cx - a * 0.78) + ' ' + (cy + b * 0.36) +
         ' Q' + cx + ' ' + (cy + b * 1.62) + ' ' + (cx + a * 0.78) + ' ' + (cy + b * 0.36) +
         ' Q' + cx + ' ' + (cy + b * 0.26) + ' ' + (cx - a * 0.78) + ' ' + (cy + b * 0.36) + 'Z',
      fill: 'rgba(95,208,196,0.20)', stroke: 'rgba(95,208,196,0.8)', 'stroke-width': 1.6
    }));

    /* ballonets */
    [-0.46, 0.46].forEach(function (f) {
      s.appendChild(svg('ellipse', {
        cx: cx + a * f, cy: cy + b * 0.38, rx: a * 0.095, ry: b * 0.19,
        fill: 'rgba(242,232,208,0.07)', stroke: 'rgba(242,232,208,0.45)', 'stroke-width': 1.2, 'stroke-dasharray': '5 4'
      }));
    });

    /* solar crown */
    s.appendChild(svg('path', {
      d: 'M' + (cx - a * 0.76) + ' ' + (cy - b * 0.62) + ' Q' + cx + ' ' + (cy - b * 1.32) + ' ' + (cx + a * 0.76) + ' ' + (cy - b * 0.62),
      fill: 'none', stroke: '#E8B33A', 'stroke-width': 6, 'stroke-linecap': 'round'
    }));

    /* gondola and suspension */
    var gw = 196, gh = 50, gx = cx - gw / 2, gy = cy + b + 34;
    [-0.30, -0.10, 0.10, 0.30].forEach(function (f) {
      s.appendChild(svg('line', {
        x1: cx + gw * f, y1: gy, x2: cx + a * f * 1.1, y2: cy + b * 0.95,
        stroke: 'rgba(242,232,208,0.3)', 'stroke-width': 1.2
      }));
    });
    s.appendChild(svg('rect', { x: gx, y: gy, width: gw, height: gh, fill: '#141223', stroke: '#5FD0C4', 'stroke-width': 2 }));
    s.appendChild(svg('rect', { x: gx + 9, y: gy + 9, width: 72, height: gh - 18, fill: 'rgba(95,208,196,0.28)' }));
    s.appendChild(svg('rect', { x: gx + 88, y: gy + 9, width: 42, height: gh - 18, fill: 'rgba(232,179,58,0.24)' }));
    s.appendChild(svg('rect', { x: gx + 137, y: gy + 9, width: 50, height: gh - 18, fill: 'rgba(255,122,69,0.30)' }));

    [cx - a - 8, cx + a + 8].forEach(function (px) {
      s.appendChild(svg('ellipse', { cx: px, cy: cy, rx: 7, ry: 24, fill: 'none', stroke: '#8B8373', 'stroke-width': 2 }));
    });

    /* scale bar */
    var sy = H - 26;
    s.appendChild(svg('line', { x1: cx - a, y1: sy, x2: cx + a, y2: sy, stroke: '#5A5648', 'stroke-width': 1.2 }));
    [-a, a].forEach(function (o) {
      s.appendChild(svg('line', { x1: cx + o, y1: sy - 7, x2: cx + o, y2: sy + 7, stroke: '#5A5648', 'stroke-width': 1.2 }));
    });
    var sl = svg('text', { x: cx, y: sy - 14, 'text-anchor': 'middle', 'font-family': '"IBM Plex Mono", monospace', 'font-size': 18, fill: '#8B8373' });
    sl.textContent = '129 m — longer than a Boeing 747 (70.6 m)';
    s.appendChild(sl);

    /* callouts in two clean columns, single straight leaders */
    var CALLS = [
      { x: cx - a * 0.58, y: cy - b * 0.70, ex: LX, ey: 74,  anchor: 'end',
        t: 'Helium lift cells', v: '46 000 m³ · 66.8 t lift', c: '#E8B33A' },
      { x: cx - a * 0.46, y: cy + b * 0.38, ex: LX, ey: 246, anchor: 'end',
        t: 'Ballonets', v: 'buoyancy and thermal trim', c: '#C9BFA8' },
      { x: gx + 45, y: gy + gh, ex: LX, ey: 420, anchor: 'end',
        t: 'Habitat module', v: '2 crew · 30 days · 1 atm', c: '#5FD0C4' },
      { x: cx + a * 0.14, y: cy - b * 1.16, ex: RX, ey: 74,  anchor: 'start',
        t: 'Thin-film photovoltaics', v: '~1 000 m² · 2 601 W/m²', c: '#E8B33A' },
      { x: cx + a * 0.40, y: cy + b * 1.00, ex: RX, ey: 246, anchor: 'start',
        t: 'Breathable-air volume', v: '31 500 m³ · 16.8 t · ambient', c: '#5FD0C4' },
      { x: gx + 162, y: gy + gh, ex: RX, ey: 420, anchor: 'start',
        t: 'Vesper ascent vehicle', v: '~8.0 km/s to Venus orbit', c: '#FF7A45' }
    ];
    CALLS.forEach(function (c) {
      var tip = c.ex + (c.anchor === 'start' ? -14 : 14);
      s.appendChild(svg('line', {
        x1: c.x, y1: c.y, x2: tip, y2: c.ey - 6,
        stroke: c.c, 'stroke-width': 1.2, opacity: 0.5
      }));
      s.appendChild(svg('circle', { cx: c.x, cy: c.y, r: 3.5, fill: c.c }));
      var t1 = svg('text', {
        x: c.ex, y: c.ey, 'text-anchor': c.anchor,
        'font-family': 'Archivo, sans-serif', 'font-size': 20, 'font-weight': 600, fill: '#F2E8D0'
      });
      t1.textContent = c.t;
      var t2 = svg('text', {
        x: c.ex, y: c.ey + 22, 'text-anchor': c.anchor,
        'font-family': '"IBM Plex Mono", monospace', 'font-size': 16, fill: c.c
      });
      t2.textContent = c.v;
      s.appendChild(t1); s.appendChild(t2);
    });

    host.appendChild(s);
  }

  /* ---------- lift calculator ----------------------------- */

  function liftCalc() {
    var input = $('#altRange');
    if (!input) return;
    var V_HE = 46000, V_AIR = 31500, STRUCT = 20.6;
    var outs = {
      alt: $('#cAlt'), t: $('#cTemp'), p: $('#cPres'),
      he: $('#cHe'), air: $('#cAir'), net: $('#cNet'), verdict: $('#cVerdict')
    };
    function update() {
      var km = +input.value / 10;
      var s = sample(km);
      var he = V_HE * s.liftHe / 1000;
      var air = V_AIR * s.liftAir / 1000;
      var gross = he + air;
      var net = gross - STRUCT;
      outs.alt.textContent = km.toFixed(1);
      outs.t.textContent = fmt(s.tC, 0);
      outs.p.textContent = s.atm.toFixed(2);
      outs.he.textContent = he.toFixed(1);
      outs.air.textContent = air.toFixed(1);
      outs.net.textContent = net.toFixed(1);
      var v, col;
      if (km < 48) { v = 'Lift is plentiful — but it is ' + fmt(s.tC, 0) + ' °C outside.'; col = 'var(--ember)'; }
      else if (km <= 54) { v = 'Nominal. Shirt-sleeve pressure, workable heat, ' + net.toFixed(0) + ' t of useful lift.'; col = 'var(--aqua)'; }
      else if (km <= 58) { v = 'Comfortable, but the hull can only carry ' + net.toFixed(0) + ' t. Payload starts to bite.'; col = 'var(--sulfur)'; }
      else { v = 'Too thin. This hull cannot lift its own structure up here.'; col = 'var(--critical)'; }
      outs.verdict.textContent = v;
      outs.verdict.style.color = col;
      input.setAttribute('aria-valuetext', km.toFixed(1) + ' kilometers');
    }
    input.addEventListener('input', update);
    update();
  }

  /* ---------- simple list renderers ----------------------- */

  function buildLaminate() {
    var wrap = $('#laminate');
    if (!wrap) return;
    var cols = ['#F2E8D0', '#C9BFA8', '#E8B33A', '#5FD0C4'];
    D.LAMINATE.forEach(function (l, i) {
      var row = el('div', 'lam');
      row.style.setProperty('--layercol', cols[i % cols.length]);
      var h = el('div');
      h.appendChild(el('p', 'lam__n', l.layer));
      h.appendChild(el('p', 'lam__t num', l.thick));
      row.appendChild(h);
      row.appendChild(el('p', 'lam__w', l.why));
      wrap.appendChild(row);
    });
  }

  function buildAloft() {
    var wrap = $('#loops');
    if (!wrap) return;
    D.ALOFT.loops.forEach(function (l) {
      var c = el('article', 'loop');
      c.appendChild(el('h4', 'loop__n', l.name));
      var flow = el('p', 'loop__flow');
      flow.appendChild(el('span', 'loop__in', l.in));
      flow.appendChild(el('span', 'loop__arrow', '→'));
      flow.appendChild(el('span', 'loop__out', l.out));
      c.appendChild(flow);
      c.appendChild(el('p', 'loop__how', l.how));
      wrap.appendChild(c);
    });
  }

  function buildCost() {
    var wrap = $('#costBars');
    if (!wrap) return;
    var max = Math.max.apply(null, D.COSTS.phases.map(function (p) { return p.usd; }));
    D.COSTS.phases.forEach(function (p, i) {
      var b = el('div', 'costbar');
      if (i === 4) b.setAttribute('data-flag', 'crew');
      if (i === 0) b.setAttribute('data-flag', 'funded');
      var top = el('div', 'costbar__top');
      top.appendChild(el('span', null, p.name));
      top.appendChild(el('b', null, '$' + p.usd.toFixed(1) + ' bn'));
      b.appendChild(top);
      var tr = el('div', 'costbar__track');
      var fi = el('div', 'costbar__fill');
      fi.style.width = '0%';
      fi.setAttribute('data-w', (p.usd / max * 100).toFixed(1) + '%');
      tr.appendChild(fi); b.appendChild(tr);
      b.appendChild(el('p', 'note', p.note));
      wrap.appendChild(b);
    });

    var cmp = $('#costCompare');
    if (cmp) {
      var rows = [{ label: 'Project Phosphorus, all five phases', usd: D.COSTS.total, venus: true }]
        .concat(D.COSTS.marsEstimates.map(function (m) { return { label: m.label, usd: m.usd }; }));
      var mx = 1000;
      rows.forEach(function (r) {
        var row = el('div', 'compare__row' + (r.venus ? ' compare__row--venus' : ''));
        row.appendChild(el('p', 'compare__label', r.label));
        var tr = el('div', 'compare__track');
        var f = el('div', 'compare__fill');
        f.style.width = '0%';
        f.setAttribute('data-w', (r.usd / mx * 100).toFixed(2) + '%');
        tr.appendChild(f);
        row.appendChild(tr);
        row.appendChild(el('p', 'compare__val', '$' + fmt(r.usd, r.usd < 100 ? 1 : 0) + ' bn'));
        cmp.appendChild(row);
      });
    }

    var fired = false;
    onTick(function (vh) {
      if (fired) return;
      var r = wrap.getBoundingClientRect();
      if (r.top < vh * 0.9) {
        fired = true;
        Array.prototype.forEach.call(document.querySelectorAll('.costbar__fill, .compare__fill'), function (n, i) {
          setTimeout(function () { n.style.width = n.getAttribute('data-w'); }, REDUCED ? 0 : i * 70);
        });
      }
    });
  }

  function buildRisks() {
    var wrap = $('#risks');
    if (!wrap) return;
    D.RISKS.forEach(function (r) {
      var a = el('article', 'risk');
      a.setAttribute('data-sev', r.severity);
      var h = el('div', 'risk__h');
      h.appendChild(el('p', 'risk__rank num', 'RISK ' + String(r.rank).padStart(2, '0')));
      h.appendChild(el('h3', 'risk__n', r.name));
      h.appendChild(el('span', 'risk__sev', r.severity));
      a.appendChild(h);
      var b = el('div', 'risk__body');
      b.appendChild(el('p', 'risk__what', r.what));
      var fix = el('p', 'risk__fix');
      fix.appendChild(el('b', null, 'What we do about it'));
      fix.appendChild(document.createTextNode(r.fix));
      b.appendChild(fix);
      a.appendChild(b);
      wrap.appendChild(a);
    });
  }

  function buildSources() {
    var wrap = $('#sources');
    if (!wrap) return;
    D.SOURCES.forEach(function (s) {
      var row = el('div', 'source');
      row.appendChild(el('p', 'source__tag', s.tag));
      var p = el('p');
      var a = el('a', null, s.cite);
      a.href = s.url; a.rel = 'noopener'; a.target = '_blank';
      p.appendChild(a);
      row.appendChild(p);
      wrap.appendChild(row);
    });
  }

  /* ---------- science: open questions --------------------- */

  function buildScience() {
    var wrap = $('#science');
    if (!wrap) return;
    D.SCIENCE.forEach(function (q) {
      var a = el('article', 'q');
      var h = el('div', 'q__h');
      h.appendChild(el('p', 'q__n num', String(q.n).padStart(2, '0')));
      h.appendChild(el('p', 'q__tag', q.tag));
      a.appendChild(h);
      var b = el('div', 'q__b');
      b.appendChild(el('h3', 'q__name', q.name));
      b.appendChild(el('p', 'q__known', q.known));
      var split = el('div', 'q__split');
      [['A probe can', q.probe, 'probe'], ['A crew can', q.crew, 'crew']].forEach(function (c) {
        var col = el('div', 'q__col q__col--' + c[2]);
        col.appendChild(el('p', 'q__col-k', c[0]));
        col.appendChild(el('p', 'q__col-v', c[1]));
        split.appendChild(col);
      });
      b.appendChild(split);
      a.appendChild(b);
      wrap.appendChild(a);
    });
  }

  function buildSampling() {
    var wrap = $('#sampling');
    if (!wrap) return;
    D.SAMPLING.forEach(function (st) {
      var band = st.km >= 50 && st.km <= 54;
      var row = el('div', 'st' + (band ? ' st--band' : ''));
      var alt = el('div', 'st__alt');
      alt.appendChild(el('span', 'st__km num', String(st.km)));
      alt.appendChild(el('span', 'st__unit', 'km'));
      row.appendChild(alt);
      var body = el('div', 'st__b');
      var top = el('div', 'st__top');
      top.appendChild(el('h4', 'st__n', st.name));
      top.appendChild(el('span', 'st__dur num', st.dur));
      body.appendChild(top);
      body.appendChild(el('p', 'st__gets', st.gets));
      body.appendChild(el('p', 'st__kit num', st.kit));
      row.appendChild(body);
      wrap.appendChild(row);
    });
  }

  /* ---------- construction -------------------------------- */

  function buildConstruction() {
    var wrap = $('#build');
    if (!wrap) return;
    D.BUILD.forEach(function (b) {
      var a = el('article', 'bd');
      var l = el('div', 'bd__l');
      l.appendChild(el('p', 'bd__step', b.step));
      l.appendChild(el('p', 'bd__where num', b.where));
      var fig = el('div', 'bd__fig');
      fig.appendChild(el('p', 'bd__num', b.num));
      fig.appendChild(el('p', 'bd__numlab', b.numlab));
      l.appendChild(fig);
      a.appendChild(l);
      var r = el('div', 'bd__r');
      r.appendChild(el('h4', 'bd__head', b.head));
      r.appendChild(el('p', 'bd__body', b.body));
      a.appendChild(r);
      wrap.appendChild(a);
    });
  }

  /* ---------- chasing the sun: one day and one night ------ */

  function sunChart() {
    var host = $('#lapSvg');
    if (!host || !D.SUNCHASE) return;
    var pickKm = $('#lapPick'), pickAir = $('#lapAir');
    var out = {
      day: $('#lDay'), night: $('#lNight'), sun: $('#lSun'),
      prop: $('#lProp'), store: $('#lStore'), wind: $('#lWind')
    };
    var chase = (D.ALOFT && D.ALOFT.chase) || { dayKm: 51, airspeedMs: 10, nightKm: 55 };
    var km = chase.dayKm, air = chase.airspeedMs;

    var W = 920, H = 318, PAD = { l: 58, r: 58, t: 26, b: 26 };
    var IW = W - PAD.l - PAD.r;
    var s = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: '100%',
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'One day and one night aboard the airship at the selected day-side altitude and airspeed: the altitude flown, the battery state, and the length of daylight and darkness'
    });
    host.appendChild(s);

    function uniq(key) {
      var seen = {}, list = [];
      D.SUNCHASE.forEach(function (r) { if (!seen[r[key]]) { seen[r[key]] = 1; list.push(r[key]); } });
      return list;
    }
    function buttons(pick, values, current, onpick) {
      values.forEach(function (v) {
        var b = el('button', 'lap__btn' + (v === current ? ' is-on' : ''));
        b.type = 'button';
        b.textContent = v;
        b.setAttribute('aria-pressed', v === current ? 'true' : 'false');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(pick.children, function (c) {
            var on = c === b;
            c.classList.toggle('is-on', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          onpick(v);
        });
        pick.appendChild(b);
      });
    }
    buttons(pickKm, uniq('km'), km, function (v) { km = v; select(); });
    buttons(pickAir, uniq('u'), air, function (v) { air = v; select(); });

    function txt(x, y, t, o) {
      o = o || {};
      var n = svg('text', {
        x: x, y: y, 'text-anchor': o.a || 'middle',
        'font-family': o.f || '"IBM Plex Mono", monospace',
        'font-size': o.s || 17, fill: o.c || '#8B8373',
        'font-weight': o.w || 400, 'letter-spacing': o.ls || 0
      });
      n.textContent = t;
      s.appendChild(n);
      return n;
    }

    function draw(row) {
      while (s.firstChild) s.removeChild(s.firstChild);
      var hours = row.dayH + row.nightH;
      var dayW = IW * row.dayH / hours;
      var sunset = PAD.l + dayW;
      var end = PAD.l + IW;

      /* rows, top to bottom: altitude flown, battery state, day/night bar, hour axis */
      var altHi = PAD.t + 6, altLo = PAD.t + 34;
      var topY = PAD.t + 76, botY = PAD.t + 124;
      var labelY = PAD.t + 150;
      var barY = PAD.t + 158, barH = 44;
      var axisY = barY + barH + 16;

      /* altitude: low and upwind by day, climb at sunset, coast high through the night */
      var altD = 'M' + PAD.l + ' ' + altLo + ' L' + sunset + ' ' + altLo + ' L' + (sunset + 14) + ' ' + altHi +
                 ' L' + (end - 14) + ' ' + altHi + ' L' + end + ' ' + altLo;
      s.appendChild(svg('path', { d: altD, fill: 'none', stroke: '#8B8373', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      txt(PAD.l - 10, altLo + 5, row.km + ' km', { a: 'end', s: 14, c: '#5A5648' });
      txt(end + 10, altHi + 5, chase.nightKm + ' km', { a: 'start', s: 14, c: '#5A5648' });
      txt(PAD.l + dayW / 2, altLo - 10, row.u ? 'props on · ' + row.u + ' m/s upwind · ' + row.propKw + ' kW' : 'props off · drifting', { s: 14, c: '#8B8373' });
      txt(sunset + (IW - dayW) / 2, altHi - 10, 'coasting', { s: 14, c: '#8B8373' });

      /* day / night bar, widths in proportion to hours */
      var dayG = svg('linearGradient', { id: 'dayg', x1: 0, y1: 0, x2: 1, y2: 0 });
      dayG.appendChild(svg('stop', { offset: '0%', 'stop-color': '#5A4A2E' }));
      dayG.appendChild(svg('stop', { offset: '50%', 'stop-color': '#E8B33A' }));
      dayG.appendChild(svg('stop', { offset: '100%', 'stop-color': '#5A4A2E' }));
      var defs = svg('defs'); defs.appendChild(dayG); s.appendChild(defs);
      s.appendChild(svg('rect', { x: PAD.l, y: barY, width: dayW, height: barH, fill: 'url(#dayg)' }));
      s.appendChild(svg('rect', { x: sunset, y: barY, width: IW - dayW, height: barH, fill: '#141223', stroke: '#2A2740', 'stroke-width': 1 }));
      txt(PAD.l + dayW / 2, barY + 27, 'DAYLIGHT  ' + Math.round(row.dayH) + ' h', { c: '#1A1408', s: 18, w: 500, ls: 1.4 });
      txt(sunset + (IW - dayW) / 2, barY + 27, 'NIGHT  ' + Math.round(row.nightH) + ' h', { c: '#F2E8D0', s: 18, w: 500, ls: 1.4 });

      /* hour axis */
      s.appendChild(svg('line', { x1: PAD.l, y1: axisY, x2: end, y2: axisY, stroke: '#2A2740', 'stroke-width': 1 }));
      for (var t = 0; t <= hours + 0.01; t += 24) {
        var x = PAD.l + (t / hours) * IW;
        s.appendChild(svg('line', { x1: x, y1: axisY, x2: x, y2: axisY + 6, stroke: '#2A2740', 'stroke-width': 1 }));
        txt(x, axisY + 24, String(Math.round(t)), { s: 14, c: '#5A5648' });
      }
      txt(PAD.l + IW / 2, axisY + 44, 'hours since local sunrise', { s: 14, c: '#5A5648' });

      /* battery: charging through the day, full at sunset, drawn down through the night */
      s.appendChild(svg('line', { x1: PAD.l, y1: topY, x2: end, y2: topY, stroke: '#1F1D33', 'stroke-width': 1 }));
      s.appendChild(svg('line', { x1: PAD.l, y1: botY, x2: end, y2: botY, stroke: '#1F1D33', 'stroke-width': 1 }));
      txt(PAD.l - 10, topY + 5, 'full', { a: 'end', s: 14, c: '#5A5648' });
      txt(PAD.l - 10, botY + 5, 'empty', { a: 'end', s: 14, c: '#5A5648' });
      var fullAt = PAD.l + dayW * 0.6; /* topped up well before sunset; the surplus runs the props */
      var d = 'M' + PAD.l + ' ' + botY + ' L' + fullAt + ' ' + topY + ' L' + sunset + ' ' + topY + ' L' + end + ' ' + botY;
      s.appendChild(svg('path', { d: d, fill: 'none', stroke: '#5FD0C4', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
      s.appendChild(svg('circle', { cx: sunset, cy: topY, r: 4.5, fill: '#5FD0C4' }));
      txt(sunset, topY - 12, Math.round(row.storageKwh) + ' kWh stored', { c: '#5FD0C4', s: 16, a: sunset > end - 120 ? 'end' : 'middle' });

      /* sunrise / sunset markers */
      [PAD.l, sunset, end].forEach(function (x) {
        s.appendChild(svg('line', { x1: x, y1: labelY + 4, x2: x, y2: barY + barH + 6, stroke: '#5A5648', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      });
      txt(PAD.l, labelY, 'sunrise', { s: 14, c: '#5A5648', a: 'start' });
      txt(sunset, labelY, 'sunset', { s: 14, c: '#5A5648' });
      txt(end, labelY, 'sunrise', { s: 14, c: '#5A5648', a: 'end' });
    }

    function select() {
      var row = null;
      D.SUNCHASE.forEach(function (r) { if (r.km === km && r.u === air) row = r; });
      if (!row) return;
      draw(row);
      out.day.textContent = Math.round(row.dayH);
      out.night.textContent = Math.round(row.nightH);
      out.sun.textContent = row.sunPct;
      out.prop.textContent = row.propKw;
      out.store.textContent = fmt(row.storageKwh, 0);
      out.wind.textContent = row.wind;
    }

    select();
  }

  /* ---------- why not park under the sun: by latitude ----- */

  function sunkeepRows() {
    var wrap = $('#sunkeep');
    if (!wrap || !D.SUNKEEP) return;
    var lo = 1, hi = 0;
    D.SUNKEEP.forEach(function (r) { hi = Math.max(hi, Math.log10(r.propKw)); });
    function width(kw) { return Math.max(1.5, 100 * (Math.log10(Math.max(kw, 10)) - lo) / (hi - lo)); }
    function kw(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' MW' : v + ' kW'; }
    D.SUNKEEP.forEach(function (r) {
      var row = el('div', 'sk');
      row.appendChild(el('span', 'sk__lat', r.lat + '°'));
      var bars = el('div', 'sk__bars');
      var need = el('div', 'sk__bar sk__bar--need'); need.style.width = width(r.propKw) + '%';
      var have = el('div', 'sk__bar sk__bar--have'); have.style.width = width(r.solarKw) + '%';
      bars.appendChild(need); bars.appendChild(have);
      row.appendChild(bars);
      var v = el('span', 'sk__v');
      v.appendChild(el('b', null, kw(r.propKw) + ' to hold'));
      v.appendChild(document.createTextNode(kw(r.solarKw) + ' of sun'));
      row.appendChild(v);
      wrap.appendChild(row);
    });
    var key = el('div', 'sk__key');
    var k1 = el('span', null, 'to hold still'); k1.insertBefore(el('i', 'sk__bar--need'), k1.firstChild);
    var k2 = el('span', null, 'from the array'); k2.insertBefore(el('i', 'sk__bar--have'), k2.firstChild);
    key.appendChild(k1); key.appendChild(k2);
    wrap.parentNode.insertBefore(key, wrap.nextSibling);
  }

  /* ---------- experience + crew --------------------------- */

  function buildExperience() {
    var wrap = $('#experience');
    if (!wrap) return;
    D.EXPERIENCE.forEach(function (x) {
      var a = el('article', 'xp');
      var h = el('div', 'xp__h');
      h.appendChild(el('p', 'xp__k', x.k));
      h.appendChild(el('p', 'xp__v num', x.v));
      a.appendChild(h);
      a.appendChild(el('p', 'xp__d', x.d));
      wrap.appendChild(a);
    });
  }

  function buildCrewDetail() {
    var wrap = $('#crewDetail');
    if (!wrap) return;
    D.CREW_DETAIL.forEach(function (c) {
      var a = el('article', 'cw' + (c.days === 30 ? ' cw--aloft' : ''));
      var h = el('div', 'cw__h');
      h.appendChild(el('h4', 'cw__r', c.role));
      h.appendChild(el('p', 'cw__s num', c.station));
      var bar = el('div', 'cw__bar');
      var fill = el('div', 'cw__fill');
      fill.style.width = (c.days / 459 * 100).toFixed(1) + '%';
      if (c.days === 30) fill.style.marginLeft = (124 / 459 * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      h.appendChild(bar);
      h.appendChild(el('p', 'cw__d num', c.days + ' days on station'));
      a.appendChild(h);
      var b = el('div', 'cw__b');
      var ul = el('ul', 'cw__duties');
      c.duties.forEach(function (d) { ul.appendChild(el('li', null, d)); });
      b.appendChild(ul);
      b.appendChild(el('p', 'cw__why', c.why));
      a.appendChild(b);
      wrap.appendChild(a);
    });
  }

  /* ---------- reveal on scroll ---------------------------- */

  function reveals() {
    if (REDUCED || !('IntersectionObserver' in window)) return;
    var nodes = document.querySelectorAll('.reveal');
    if (!nodes.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(nodes, function (n) {
      var r = n.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.95) { n.classList.add('is-in'); return; }
      n.classList.add('is-armed');
      io.observe(n);
    });
  }

  /* ---------- rail readout -------------------------------- */

  function rail() {
    var readout = $('#railReadout');
    if (!readout) return;
    var marks = Array.prototype.slice.call(document.querySelectorAll('[data-rail]'));
    var last = '';
    onTick(function (vh) {
      var cur = marks[0] ? marks[0].getAttribute('data-rail') : '';
      for (var i = 0; i < marks.length; i++) {
        if (marks[i].getBoundingClientRect().top < vh * 0.45) cur = marks[i].getAttribute('data-rail');
      }
      if (cur !== last) { last = cur; readout.textContent = cur; }
    });
  }

  /* ---------- boot ---------------------------------------- */

  function PHOS_ACTS() { return (window.PHOS || {}).ACTS; }

  function boot() {
    var sky = $('#heroSky');
    if (sky) starfield(sky);
    buildHero();
    buildLedger();
    buildPhases();
    buildWindows();
    buildLaminate();
    buildAloft();
    buildScience();
    buildSampling();
    buildConstruction();
    buildExperience();
    buildCrewDetail();
    sunChart();
    sunkeepRows();
    buildCost();
    buildRisks();
    buildSources();
    /* three dimensions where WebGL is available; the 2D renderers stay as the fallback */
    var three = null;
    try { three = window.PHOS && PHOS.ACTS3D ? PHOS.ACTS3D.init(onTick, trackProgress) : null; } catch (e) { three = null; }
    if (!three || !three.cutaway) cutaway();
    liftCalc();
    descentStage(three && three.descent);
    if (!(three && three.acts) && PHOS_ACTS()) PHOS_ACTS()(onTick, trackProgress);
    rail();
    reveals();

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    frame();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
