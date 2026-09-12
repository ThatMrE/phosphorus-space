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
  function seg(t, a, b) { return clamp((t - a) / (b - a || 1), 0, 1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
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

  function compareStage(viz) {
    var steps = $('#compareSteps');
    var stage = $('#compare');
    if (!steps || !stage || !D.LEDGER) return;
    var track = $('.stage__track', stage);
    var canvas = $('#compareCanvas');

    function fill(template, nums, decimals, k) {
      return template.replace(/\{(\d)\}/g, function (_, i) {
        var n = nums[+i] * k;
        return decimals ? n.toFixed(decimals) : fmt(Math.round(n), 0);
      });
    }

    var cards = D.LEDGER.map(function (row) {
      var step = el('div', 'stage__step');
      var card = el('article', 'stage__card cmp');
      card.setAttribute('data-win', row.win);
      card.appendChild(el('p', 'cmp__metric', row.metric));
      var vals = el('div', 'cmp__vals');
      var out = {};
      [['v', 'Venus', row.venus, row.vt, row.vn, row.vd], ['m', 'Mars', row.mars, row.mt, row.mn, row.md]].forEach(function (side) {
        var cell = el('div', 'cmp__val cmp__val--' + side[0]);
        cell.appendChild(el('span', 'cmp__who', side[1]));
        var n = el('b', 'cmp__n', side[2]);
        cell.appendChild(n);
        vals.appendChild(cell);
        out[side[0]] = { node: n, t: side[3], n: side[4], d: side[5] };
      });
      card.appendChild(vals);
      card.appendChild(el('p', 'cmp__note', row.note));
      step.appendChild(card);
      steps.appendChild(step);
      return { card: card, out: out, row: row };
    });

    /* count the numbers up when a card takes the stage */
    var active = -1, tween = null;
    function activate(i) {
      cards.forEach(function (c, j) {
        c.card.classList.toggle('is-active', j === i);
        /* anything already scrolled past shows its final numbers, no count */
        if (j < i && !c.card.classList.contains('is-done')) {
          c.card.classList.add('is-done');
          ['v', 'm'].forEach(function (side) { var o = c.out[side]; if (o.n) o.node.textContent = fill(o.t, o.n, o.d, 1); });
        }
      });
      var c = cards[i];
      if (c.card.classList.contains('is-done')) { if (viz) viz.setStep(i, c.row); return; }
      c.card.classList.add('is-done');
      if (tween) cancelAnimationFrame(tween);
      var t0 = performance.now(), dur = REDUCED ? 0 : 900;
      (function frame(now) {
        var k = dur ? Math.min(1, (now - t0) / dur) : 1;
        k = 1 - Math.pow(1 - k, 3);
        ['v', 'm'].forEach(function (side) {
          var o = c.out[side];
          if (o.n) o.node.textContent = fill(o.t, o.n, o.d, k);
        });
        if (k < 1) tween = requestAnimationFrame(frame);
      })(t0);
      if (viz) viz.setStep(i, c.row);
    }

    /* the 2D fallback: two shaded discs, so the cards still have company */
    var ctx2 = null;
    if (!viz && canvas) {
      ctx2 = canvas.getContext('2d');
      var draw2 = function () {
        var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        canvas.width = w * dpr; canvas.height = h * dpr; ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2.clearRect(0, 0, w, h);
        var narrow = w < 760, r = narrow ? Math.min(w, h) * 0.16 : Math.min(w, h) * 0.2;
        [[narrow ? w * 0.3 : w * 0.66, h * 0.5, '#E3C878', '#8A6A2A', 'Venus'],
         [narrow ? w * 0.7 : w * 0.88, h * 0.5, '#C9673A', '#5A2A18', 'Mars']].forEach(function (pl) {
          var g = ctx2.createRadialGradient(pl[0] - r * 0.4, pl[1] - r * 0.4, r * 0.1, pl[0], pl[1], r);
          g.addColorStop(0, pl[2]); g.addColorStop(1, pl[3]);
          ctx2.fillStyle = g; ctx2.beginPath(); ctx2.arc(pl[0], pl[1], r, 0, Math.PI * 2); ctx2.fill();
          ctx2.fillStyle = '#F2E8D0'; ctx2.font = '600 16px Archivo, sans-serif'; ctx2.textAlign = 'center';
          ctx2.fillText(pl[4], pl[0], pl[1] + r + 26);
        });
      };
      draw2();
      window.addEventListener('resize', draw2, { passive: true });
    }

    onTick(function (vh) {
      /* the active card is the one nearest the middle of the screen */
      var best = -1, bestD = Infinity;
      for (var i = 0; i < cards.length; i++) {
        var r = cards[i].card.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        var d = Math.abs((r.top + r.bottom) / 2 - vh * (window.innerWidth < 760 ? 0.62 : 0.55));
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0) { var p = trackProgress(track); best = p <= 0 ? 0 : cards.length - 1; }
      if (best !== active) { active = best; activate(best); }
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

  /* ---------- launch-window table ------------------------- */

  /* ---------- airship cutaway ----------------------------- */

  /* ---------- lift calculator ----------------------------- */

  /* ---------- how it floats: the two decided altitudes ------ */

  function floatTable() {
    var wrap = $('#floats');
    if (!wrap) return;
    var V_HE = 46000, V_AIR = 31500, STRUCT = 20.6;
    [[51, 'By day', 'props on, nose into the wind'], [55, 'At night', 'props off, coasting']].forEach(function (row) {
      var s = sample(row[0]);
      var he = V_HE * s.liftHe / 1000, air = V_AIR * s.liftAir / 1000, net = he + air - STRUCT;
      var col = el('div', 'floats__col');
      var h = el('p', 'floats__h');
      h.appendChild(el('b', null, row[1]));
      h.appendChild(el('span', 'num', row[0] + ' km · ' + row[2]));
      col.appendChild(h);
      [['Outside', fmt(s.tC, 0), '°C'], ['Pressure', s.atm.toFixed(2), 'atm'], ['Helium cells', he.toFixed(1), 't'], ['Air volume', air.toFixed(1), 't'], ['Useful payload after structure', net.toFixed(1), 't']].forEach(function (c, i) {
        var cell = el('div', 'floats__cell' + (i === 4 ? ' floats__cell--hero' : ''));
        cell.appendChild(el('dt', null, c[0]));
        var dd = el('dd'); dd.appendChild(el('span', null, c[1])); dd.appendChild(el('span', null, c[2])); cell.appendChild(dd);
        col.appendChild(cell);
      });
      wrap.appendChild(col);
    });
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

  function buildRisks() {
    var wrap = $('#risks');
    if (!wrap) return;
    var open = null;
    D.RISKS.forEach(function (r, i) {
      var a = el('article', 'risk');
      a.setAttribute('data-sev', r.severity);
      var btn = el('button', 'risk__toggle');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'risk-' + r.rank);
      btn.appendChild(el('span', 'risk__rank num', String(r.rank).padStart(2, '0')));
      btn.appendChild(el('span', 'risk__n', r.name));
      btn.appendChild(el('span', 'risk__sev', r.severity));
      btn.appendChild(el('span', 'risk__chev', '+'));
      a.appendChild(btn);
      var body = el('div', 'risk__body'); body.id = 'risk-' + r.rank;
      var inner = el('div', 'risk__inner');
      inner.appendChild(el('p', 'risk__what', r.what));
      var fix = el('p', 'risk__fix');
      fix.appendChild(el('b', null, 'What we do about it'));
      fix.appendChild(document.createTextNode(r.fix));
      inner.appendChild(fix);
      body.appendChild(inner);
      a.appendChild(body);
      wrap.appendChild(a);
      function set(on) {
        a.classList.toggle('is-open', on);
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        btn.lastChild.textContent = on ? '−' : '+';
      }
      btn.addEventListener('click', function () {
        var on = !a.classList.contains('is-open');
        if (open && open !== set) open(false);
        set(on);
        open = on ? set : null;
      });
      if (i === 0) { set(true); open = set; }
    });
  }

  /* ---------- what it costs, Venus against Mars ----------- */

  function buildCostVs() {
    var wrap = $('#costVs');
    if (!wrap || !D.COST_VS) return;
    [['venus', 'Venus', 'Project Phosphorus'], ['mars', 'Mars', 'published estimates']].forEach(function (side) {
      var col = el('div', 'costvs__col costvs__col--' + side[0]);
      var h = el('p', 'costvs__who');
      h.appendChild(el('b', null, side[1]));
      h.appendChild(document.createTextNode(' · ' + side[2]));
      col.appendChild(h);
      D.COST_VS[side[0]].forEach(function (r) {
        var row = el('div', 'costvs__row');
        row.appendChild(el('p', 'costvs__k', r.k));
        var v = el('p', 'costvs__v num');
        v.appendChild(document.createTextNode('$' + (r.v >= 1000 ? (r.v / 1000).toFixed(0) + ' tn' : fmt(r.v, r.v < 100 ? 1 : 0) + ' ' + r.unit)));
        row.appendChild(v);
        row.appendChild(el('p', 'costvs__d', r.d));
        col.appendChild(row);
      });
      wrap.appendChild(col);
    });
    var bars = $('#costVsBars');
    if (bars) {
      var mx = 1000;
      D.COST_VS.bars.forEach(function (r) {
        var row = el('div', 'compare__row' + (r.venus ? ' compare__row--venus' : ''));
        row.appendChild(el('p', 'compare__label', r.label));
        var tr = el('div', 'compare__track');
        var f = el('div', 'compare__fill');
        f.style.width = '0%';
        f.setAttribute('data-w', (r.usd / mx * 100).toFixed(2) + '%');
        tr.appendChild(f);
        row.appendChild(tr);
        row.appendChild(el('p', 'compare__val', '$' + fmt(r.usd, r.usd < 100 ? 1 : 0) + ' bn'));
        bars.appendChild(row);
      });
      var fired = false;
      onTick(function (vh) {
        if (fired) return;
        if (bars.getBoundingClientRect().top < vh * 0.9) {
          fired = true;
          Array.prototype.forEach.call(bars.querySelectorAll('.compare__fill'), function (n, i) {
            setTimeout(function () { n.style.width = n.getAttribute('data-w'); }, REDUCED ? 0 : i * 70);
          });
        }
      });
    }
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

  function buildScience(viz) {
    stageSteps('learn', D.SCIENCE, function (q) {
      var extra = el('div', 'qcard');
      var c1 = el('div', 'qcard__col qcard__col--crew');
      c1.appendChild(el('p', 'qcard__k', 'What the crew does'));
      c1.appendChild(el('p', 'qcard__v', q.crew));
      var c2 = el('div', 'qcard__col');
      c2.appendChild(el('p', 'qcard__k', 'What a probe gets'));
      c2.appendChild(el('p', 'qcard__v', q.probe));
      extra.appendChild(c1); extra.appendChild(c2);
      return stepCard({ step: String(q.n).padStart(2, '0'), where: q.tag, head: q.name, body: q.known, extra: extra, cls: 'stage__card--aqua' });
    }, viz);
  }

  function buildSampling(viz) {
    stageSteps('samples', D.SAMPLING, function (st) {
      var band = st.km >= 50 && st.km <= 54;
      return stepCard({ step: st.km + ' km', where: st.dur, head: st.name, body: st.gets,
        extra: el('p', 'bcard__kit', st.kit), cls: band ? 'stage__card--aqua' : '' });
    }, viz);
  }

  /* ---------- construction -------------------------------- */

  /* one card per row; the card for floor(p * n) is active and the 3D view gets p */
  function stageSteps(stageId, rows, make, viz) {
    var stage = $('#' + stageId);
    if (!stage || !rows) return;
    var steps = $('.stage__steps', stage), track = $('.stage__track', stage);
    var cards = rows.map(function (r, i) {
      var step = el('div', 'stage__step');
      var c = make(r, i);
      step.appendChild(c);
      steps.appendChild(step);
      return c;
    });
    var active = -1;
    onTick(function () {
      var p = trackProgress(track);
      var i = Math.min(cards.length - 1, Math.floor(p * cards.length));
      if (i !== active) {
        active = i;
        cards.forEach(function (c, j) { c.classList.toggle('is-active', j === i); });
      }
      if (viz) viz.update(p);
    });
  }

  function stepCard(o) {
    var c = el('article', 'stage__card bcard' + (o.cls ? ' ' + o.cls : ''));
    var top = el('p', 'bcard__step');
    top.appendChild(el('span', null, o.step));
    if (o.where) top.appendChild(el('span', 'bcard__where', o.where));
    c.appendChild(top);
    if (o.head) c.appendChild(el('h3', null, o.head));
    if (o.body) c.appendChild(el('p', null, o.body));
    if (o.extra) c.appendChild(o.extra);
    if (o.num) {
      var fig = el('p', 'bcard__fig');
      fig.appendChild(el('b', 'num', o.num));
      fig.appendChild(el('span', null, o.numlab || ''));
      c.appendChild(fig);
    }
    return c;
  }

  function buildConstruction(viz) {
    stageSteps('build', D.BUILD, function (b) { return stepCard(b); }, viz);
  }

  /* ---------- the program: a timeline that runs as you scroll --- */

  function yearOf(iso) {
    var p = iso.split('-');
    return +p[0] + ((+p[1] - 1) * 30.4 + (+p[2] || 1)) / 365.25;
  }

  function programStage() {
    var stage = $('#program');
    if (!stage || !D.PHASES) return;
    var canvas = $('#programCanvas'), ctx = canvas.getContext('2d');
    var hud = { year: $('#pYear'), spent: $('#pSpent'), next: $('#pNext') };
    var phases = D.PHASES.map(function (ph, i) {
      var yy = ph.years.split('—').map(function (s) { return +s.trim(); });
      return { ph: ph, y0: yy[0], y1: yy[1] + 0.999, cost: D.COSTS.phases[i].usd, note: D.COSTS.phases[i].note, n: i };
    });
    var windows = D.WINDOWS.map(function (w) {
      var m = /step (\d)/i.exec(w.use || '');
      return { w: w, best: yearOf(w.best), arrive: yearOf(w.arrive), open: yearOf(w.open), close: yearOf(w.close), step: m ? +m[1] : -1, crew: /PEOPLE/.test(w.use || '') };
    });
    var Y0 = 2026, Y1 = 2056;
    var costTotal = D.COSTS.total;

    /* the cards */
    var rows = phases.map(function (P) {
      var items = el('div', 'pitems');
      P.ph.items.forEach(function (it) {
        var row = el('div', 'pitem');
        var h = el('p', 'pitem__n'); h.appendChild(el('b', null, it.name)); h.appendChild(el('span', null, it.who + (it.when ? ' · ' + it.when : '')));
        row.appendChild(h);
        row.appendChild(el('p', 'pitem__d', it.what));
        items.appendChild(row);
      });
      return { step: P.ph.tag, where: P.ph.years + (P.ph.window ? ' · ' + P.ph.window : ''), head: P.ph.name, body: P.ph.thesis, extra: items,
               num: '$' + P.cost.toFixed(1) + ' bn', numlab: P.note, cls: P.ph.status === 'flagship' ? 'stage__card--ember' : P.ph.status === 'funded' ? 'stage__card--aqua' : '' };
    });
    var NC = rows.length;

    /* the drawing */
    var W = 0, H = 0, dpr = 1;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    var COL = { line: 'rgba(242,232,208,0.16)', dim: 'rgba(242,232,208,0.35)', cream: '#F2E8D0', sulfur: '#E8B33A', ember: '#FF7A45', aqua: '#5FD0C4', void2: '#0F0D1A' };
    function draw(p) {
      if (!W || !H) size();
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var wide = W >= 760;
      var i = Math.min(NC - 1, Math.floor(p * NC)), local = p * NC - i;
      var year = lerp(phases[i].y0, phases[i].y1, local);
      var x0 = wide ? W * 0.56 : 20, x1 = W - (wide ? 36 : 20);
      var top = wide ? H * 0.16 : H * 0.6, bot = wide ? H * 0.72 : H * 0.96;
      var yA = top + (bot - top) * 0.55;
      function X(y) { return x0 + (x1 - x0) * (y - Y0) / (Y1 - Y0); }
      var mono = '11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.font = mono; ctx.textBaseline = 'middle';
      /* axis */
      ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, yA); ctx.lineTo(x1, yA); ctx.stroke();
      for (var y = Y0; y <= Y1; y++) {
        var big = y % 5 === 0;
        ctx.beginPath(); ctx.moveTo(X(y), yA); ctx.lineTo(X(y), yA + (big ? 8 : 4)); ctx.stroke();
        if (big) { ctx.fillStyle = COL.dim; ctx.textAlign = 'center'; ctx.fillText(String(y), X(y), yA + 20); }
      }
      /* the steps: one lane each above the axis */
      var laneH = wide ? 13 : 10;
      phases.forEach(function (P, j) {
        var on = j === i, past = year >= P.y0;
        var yy = yA - 26 - (phases.length - 1 - j) * (laneH + 5);
        var c = P.ph.status === 'flagship' ? COL.ember : P.ph.status === 'funded' ? COL.aqua : COL.sulfur;
        ctx.globalAlpha = on ? 1 : (past ? 0.45 : 0.18);
        ctx.fillStyle = c;
        var xa = X(P.y0), xb = X(Math.min(P.y1, on ? Math.max(year, P.y0 + 0.2) : P.y1));
        if (!on && !past) xb = X(P.y1);
        ctx.fillRect(xa, yy - laneH / 2, Math.max(2, xb - xa), laneH);
        ctx.globalAlpha = on ? 1 : 0.5;
        ctx.fillStyle = on ? COL.cream : COL.dim; ctx.textAlign = 'right';
        ctx.fillText(P.ph.tag, xa - 6, yy);
        ctx.globalAlpha = 1;
      });
      /* windows: an arc from leaving Earth to arriving, above the axis */
      windows.forEach(function (Wn) {
        var used = Wn.step >= 0, mine = i < phases.length && Wn.step === i;
        var passed = year >= Wn.best - 0.05;
        var xa = X(Wn.best), xb = X(Wn.arrive), hh = 10 + Wn.w.tof / 9;
        var c = Wn.crew ? COL.ember : used ? COL.sulfur : COL.cream;
        ctx.globalAlpha = mine ? 1 : passed ? (used ? 0.8 : 0.35) : 0.14;
        ctx.strokeStyle = c; ctx.lineWidth = mine ? 2 : 1.2;
        ctx.beginPath(); ctx.moveTo(xa, yA); ctx.quadraticCurveTo((xa + xb) / 2, yA - hh * 2, xb, yA); ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(xa, yA, mine ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
        if (mine) {
          ctx.textAlign = 'center'; ctx.fillStyle = mine ? COL.cream : COL.dim;
          ctx.fillText(prettyDate(Wn.w.best).replace(/ \d{4}$/, ''), xa, yA - hh * 1.2 - 12 - (windows.indexOf(Wn) % 2) * 14);
        }
        ctx.globalAlpha = 1;
      });
      /* the bill: what has been spent by this year, as a rising area under the axis */
      var cH = bot - yA - 30, base = bot;
      function spentBy(yr) {
        var s = 0;
        phases.forEach(function (P) { s += P.cost * clamp((yr - P.y0) / (P.y1 - P.y0), 0, 1); });
        return s;
      }
      var reveal = year;
      ctx.beginPath(); ctx.moveTo(X(Y0), base);
      for (var yr = Y0; yr <= Math.min(reveal, Y1); yr += 0.1) ctx.lineTo(X(yr), base - cH * spentBy(yr) / costTotal);
      var endY = Math.min(reveal, Y1);
      ctx.lineTo(X(endY), base); ctx.closePath();
      ctx.fillStyle = 'rgba(232,179,58,0.22)'; ctx.fill();
      ctx.strokeStyle = COL.sulfur; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var yr2 = Y0; yr2 <= endY; yr2 += 0.1) { var px = X(yr2), py = base - cH * spentBy(yr2) / costTotal; yr2 === Y0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      var spent = spentBy(year);
      ctx.fillStyle = COL.sulfur; ctx.textAlign = 'left';
      ctx.fillText('$' + spent.toFixed(1) + ' bn', Math.min(X(endY) + 6, x1 - 60), base - cH * spent / costTotal - 8);
      ctx.fillStyle = COL.dim; ctx.textAlign = 'left';
      ctx.fillText('spent, cumulative', x0, base + 12);
      /* cursor */
      {
        ctx.strokeStyle = 'rgba(242,232,208,0.5)'; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(X(year), top); ctx.lineTo(X(year), bot); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COL.cream; ctx.textAlign = 'center'; ctx.font = '600 13px Archivo, system-ui, sans-serif';
        ctx.fillText(String(Math.floor(year)), X(year), top - 10);
        ctx.font = mono;
      }
      /* HUD */
      if (hud.year) {
        hud.year.textContent = String(Math.floor(year));
        hud.spent.innerHTML = '$' + spent.toFixed(1) + '<small> bn</small>';
        var nx = null;
        for (var k = 0; k < windows.length; k++) if (windows[k].best >= year) { nx = windows[k]; break; }
        hud.next.textContent = nx ? prettyDate(nx.w.best) + (nx.w.use ? ' · ' + nx.w.use.replace(/^STEP 4 — PEOPLE$/, 'Step 4 — People') : ' · spare') : '—';
      }
    }
    var last = -1;
    stageSteps('program', rows, function (r) { return stepCard(r); }, { update: function (p) { if (Math.abs(p - last) < 0.0005) return; last = p; draw(p); } });
    window.addEventListener('resize', function () { size(); draw(last < 0 ? 0 : last); }, { passive: true });
    size(); draw(0);
  }

  /* ---------- the bill, step by step ---------------------- */

  function buildBill() {
    var wrap = $('#billBars');
    if (!wrap || !D.COSTS) return;
    var max = Math.max.apply(null, D.COSTS.phases.map(function (c) { return c.usd; }));
    D.COSTS.phases.forEach(function (c, i) {
      var st = D.PHASES[i] ? D.PHASES[i].status : '';
      var b = el('div', 'pbar' + (st === 'flagship' ? ' pbar--crew' : st === 'funded' ? ' pbar--funded' : ''));
      var top = el('p', 'pbar__top'); top.appendChild(el('span', null, c.name)); top.appendChild(el('b', null, '$' + c.usd.toFixed(1) + ' bn'));
      b.appendChild(top);
      var tr = el('div', 'pbar__track'); var f = el('div', 'pbar__fill');
      f.style.width = '0%'; f.setAttribute('data-w', (c.usd / max * 100).toFixed(1) + '%');
      tr.appendChild(f); b.appendChild(tr);
      b.appendChild(el('p', 'pbar__note', c.note));
      wrap.appendChild(b);
    });
    var fired = false;
    onTick(function (vh) {
      if (fired) return;
      if (wrap.getBoundingClientRect().top < vh * 0.9) {
        fired = true;
        Array.prototype.forEach.call(wrap.querySelectorAll('.pbar__fill'), function (n, i) {
          setTimeout(function () { n.style.width = n.getAttribute('data-w'); }, REDUCED ? 0 : i * 70);
        });
      }
    });
  }

  /* ---------- the fleet, exploded ------------------------- */

  function buildFleet(viz) {
    var specs = D.FLEET || [];
    stageSteps('fleet', D.FLEET3D, function (V) {
      var sheet = specs.filter(function (f) { return f.name === V.name; })[0];
      var extra = el('div', 'parts');
      V.parts.forEach(function (P) {
        var li = el('p', 'part');
        li.appendChild(el('b', null, P.label));
        if (P.note) li.appendChild(el('span', null, P.note));
        extra.appendChild(li);
      });
      if (sheet) {
        var sp = el('div', 'fspecs');
        sheet.specs.forEach(function (row) {
          var r = el('p', 'fspec'); r.appendChild(el('span', null, row[0])); r.appendChild(el('b', null, row[1])); sp.appendChild(r);
        });
        extra.appendChild(sp);
      }
      var dl = el('a', 'fdl', 'Download the model (.obj)');
      dl.href = 'models/' + V.key + '.obj'; dl.setAttribute('download', V.key + '.obj');
      extra.appendChild(dl);
      return stepCard({ step: V.name, where: V.role, head: V.human, body: sheet ? sheet.line : '', extra: extra,
        num: sheet ? sheet.mass : '', numlab: sheet ? 'crew of ' + sheet.crew : '' });
    }, viz);
  }

  /* ---------- thirty days, lap by lap --------------------- */

  function buildStay(viz) {
    stageSteps('stay', D.STAY, function (c) { return stepCard(c); }, viz);
  }

  /* ---------- walking on sunshine: a trip outside --------- */

  function buildWalk(viz) {
    stageSteps('walk', D.WALK, function (w) { return stepCard(w); }, viz);
  }

  /* ---------- chasing the sun: one day and one night ------ */

  function sunChart() {
    var host = $('#lapSvg');
    if (!host || !D.SUNCHASE) return;
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
      'aria-label': 'One day and one night aboard the airship: the altitude flown, the battery state, and the length of daylight and darkness'
    });
    host.appendChild(s);

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

  /* ---------- experience + crew --------------------------- */

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
    buildLaminate();
    sunChart();
    buildRisks();
    buildCostVs();
    buildSources();
    /* three dimensions where WebGL is available; the 2D renderers stay as the fallback */
    var three = null;
    try { three = window.PHOS && PHOS.ACTS3D ? PHOS.ACTS3D.init(onTick, trackProgress) : null; } catch (e) { three = null; }
    floatTable();
    descentStage(three && three.descent);
    compareStage(three && three.compare);
    buildConstruction(three && three.build);
    buildWalk(three && three.walk);
    buildFleet(three && three.fleet);
    buildStay(three && three.stay);
    programStage();
    buildBill();
    buildScience(three && three.learn);
    buildSampling(three && three.samples);
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
