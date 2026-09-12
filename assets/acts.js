/* ============================================================
   PROJECT PHOSPHORUS — the three acts
   Act 01  assembly in Earth orbit
   Act 02  departure, cruise, arrival
   Both are scroll-driven canvases sharing one rAF loop with
   the rest of the page. Registered on PHOS.ACTS and booted
   from mission.js.
   ============================================================ */
(function () {
  'use strict';

  var PHOS = (window.PHOS = window.PHOS || {});
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* progress of t inside [a,b], eased */
  function seg(t, a, b) { return clamp((t - a) / (b - a || 1), 0, 1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* deterministic star field so it does not shimmer between frames */
  function makeStars(n, seed) {
    var s = seed, out = [];
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < n; i++) out.push({ x: rnd(), y: rnd(), r: rnd() * 1.1 + 0.2, a: rnd() * 0.5 + 0.12 });
    return out;
  }

  function paintStars(c, stars, w, h, drift) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var y = ((s.y * h - (drift || 0) * (0.3 + s.r)) % h + h) % h;
      c.globalAlpha = s.a;
      c.fillStyle = s.r > 0.9 ? '#F2E8D0' : '#9A93A8';
      c.beginPath();
      c.arc(s.x * w, y, s.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* a canvas that resizes itself and redraws on demand */
  function surface(canvas, render) {
    var c = canvas.getContext('2d');
    var w = 0, h = 0, last = -999;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return false;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    function draw(p, force) {
      if (!w || !h) { if (!size()) return; force = true; }
      if (!force && Math.abs(p - last) < 0.0015) return;
      last = p;
      c.clearRect(0, 0, w, h);
      render(c, w, h, p);
    }
    window.addEventListener('resize', function () { size(); draw(last, true); }, { passive: true });
    size();
    return draw;
  }

  /* ============================================================
     ACT 01 — assembly in Earth orbit
     Five deliveries rise from Earth and lock onto a spine.
     ============================================================ */

  var STARS_A = makeStars(150, 91177);

  /* each part: when it starts and ends, where it ends up relative to the
     stack center (in stack units), and how it is drawn */
  var PARTS = [
    { a: 0.02, b: 0.18, dx: 0, dy: 0, kind: 'spine', label: 'Spine' },
    { a: 0.16, b: 0.34, dx: 0, dy: -0.62, kind: 'hab', label: 'Hesperus — the ride there and back' },
    { a: 0.32, b: 0.50, dx: 0, dy: -0.62, kind: 'wings', label: 'Solar wings' },
    { a: 0.46, b: 0.64, dx: 0, dy: 0.16, kind: 'tanks', label: 'Propellant' },
    { a: 0.60, b: 0.80, dx: 0, dy: 0.86, kind: 'shell', label: 'Phosphorus — folded, in its shell' },
    { a: 0.74, b: 0.92, dx: 0, dy: 1.30, kind: 'vesper', label: 'Vesper — the ride home from the clouds' }
  ];

  function drawPart(c, kind, x, y, u, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.lineWidth = Math.max(1.2, u * 0.028);
    c.lineJoin = 'round';

    if (kind === 'spine') {
      c.strokeStyle = '#6E6880';
      c.beginPath();
      c.moveTo(x, y - u * 0.92); c.lineTo(x, y + u * 1.5);
      c.stroke();
      for (var i = -3; i <= 5; i++) {
        c.beginPath();
        c.moveTo(x - u * 0.07, y + i * u * 0.26);
        c.lineTo(x + u * 0.07, y + i * u * 0.26);
        c.stroke();
      }
    } else if (kind === 'hab') {
      c.fillStyle = 'rgba(95,208,196,0.14)';
      c.strokeStyle = '#5FD0C4';
      var hw = u * 0.20, hh = u * 0.40;
      c.beginPath();
      if (c.roundRect) c.roundRect(x - hw, y - hh, hw * 2, hh * 2, u * 0.09);
      else c.rect(x - hw, y - hh, hw * 2, hh * 2);
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(242,232,208,0.5)';
      for (var k = -1; k <= 1; k++) {
        c.beginPath();
        c.arc(x, y + k * u * 0.2, u * 0.055, 0, Math.PI * 2);
        c.stroke();
      }
    } else if (kind === 'wings') {
      c.fillStyle = 'rgba(232,179,58,0.18)';
      c.strokeStyle = '#E8B33A';
      [-1, 1].forEach(function (s) {
        var x0 = x + s * u * 0.22, ww = u * 0.52, hh = u * 0.17;
        c.beginPath();
        c.rect(s > 0 ? x0 : x0 - ww, y - hh, ww, hh * 2);
        c.fill(); c.stroke();
        c.beginPath();
        for (var g = 1; g < 4; g++) {
          var gx = (s > 0 ? x0 : x0 - ww) + (ww * g / 4);
          c.moveTo(gx, y - hh); c.lineTo(gx, y + hh);
        }
        c.stroke();
      });
    } else if (kind === 'tanks') {
      c.fillStyle = 'rgba(242,232,208,0.10)';
      c.strokeStyle = '#C9BFA8';
      [-1, 1].forEach(function (s) {
        c.beginPath();
        c.ellipse ? c.ellipse(x + s * u * 0.17, y, u * 0.125, u * 0.21, 0, 0, Math.PI * 2)
                  : c.rect(x + s * u * 0.05, y - u * 0.2, u * 0.24, u * 0.4);
        c.fill(); c.stroke();
      });
    } else if (kind === 'shell') {
      /* the airship, folded inside its aeroshell: a blunt cone */
      c.fillStyle = 'rgba(255,122,69,0.13)';
      c.strokeStyle = '#FF7A45';
      c.beginPath();
      c.moveTo(x - u * 0.34, y - u * 0.16);
      c.lineTo(x + u * 0.34, y - u * 0.16);
      c.lineTo(x + u * 0.20, y + u * 0.22);
      c.lineTo(x - u * 0.20, y + u * 0.22);
      c.closePath();
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(242,232,208,0.35)';
      c.beginPath();
      c.moveTo(x - u * 0.26, y - u * 0.02); c.lineTo(x + u * 0.26, y - u * 0.02);
      c.stroke();
    } else if (kind === 'vesper') {
      c.fillStyle = 'rgba(232,179,58,0.12)';
      c.strokeStyle = '#E8B33A';
      c.beginPath();
      c.moveTo(x, y - u * 0.26);
      c.lineTo(x + u * 0.11, y - u * 0.02);
      c.lineTo(x + u * 0.11, y + u * 0.22);
      c.lineTo(x - u * 0.11, y + u * 0.22);
      c.lineTo(x - u * 0.11, y - u * 0.02);
      c.closePath();
      c.fill(); c.stroke();
    }
    c.restore();
  }

  function renderAssembly(c, w, h, p) {
    /* ground: deep orbital night, Earth limb glowing along the bottom */
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07060E');
    g.addColorStop(0.62, '#0B0916');
    g.addColorStop(1, '#12172B');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    paintStars(c, STARS_A, w, h, p * 40);

    /* Earth limb */
    var er = Math.max(w, h) * 1.45;
    var ecx = w * 0.5, ecy = h + er * 0.80 - p * h * 0.16;
    var eg = c.createRadialGradient(ecx, ecy, er * 0.90, ecx, ecy, er);
    eg.addColorStop(0, '#16325A');
    eg.addColorStop(0.82, '#1E4E86');
    eg.addColorStop(1, 'rgba(95,208,196,0)');
    c.fillStyle = eg;
    c.beginPath(); c.arc(ecx, ecy, er, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(95,208,196,0.55)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(ecx, ecy, er, Math.PI * 1.16, Math.PI * 1.84); c.stroke();

    /* the stack */
    var u = Math.min(w * 0.24, h * 0.30);
    var cx = w * 0.5, cy = h * 0.44;

    for (var i = 0; i < PARTS.length; i++) {
      var part = PARTS[i];
      var t = seg(p, part.a, part.b);
      if (t <= 0) continue;
      var e = easeOut(t);
      var tx = cx + part.dx * u;
      var ty = cy + part.dy * u;
      /* rise from Earth, fade in as it arrives */
      var fromY = h + u * 0.8;
      var y = lerp(fromY, ty, e);
      var x = lerp(cx + (i % 2 ? 1 : -1) * u * 1.5, tx, e);
      var alpha = clamp(t * 2.2, 0, 1);

      /* thruster plume while it is still moving */
      if (t < 0.98) {
        c.save();
        c.globalAlpha = (1 - t) * 0.55;
        var pg = c.createLinearGradient(x, y + u * 0.2, x, y + u * 0.7);
        pg.addColorStop(0, 'rgba(255,122,69,0.9)');
        pg.addColorStop(1, 'rgba(255,122,69,0)');
        c.fillStyle = pg;
        c.beginPath();
        c.moveTo(x - u * 0.05, y + u * 0.2);
        c.lineTo(x + u * 0.05, y + u * 0.2);
        c.lineTo(x, y + u * 0.7);
        c.closePath(); c.fill();
        c.restore();
      }
      drawPart(c, part.kind, x, y, u, alpha);
    }

    /* the finished stack gets a soft halo */
    if (p > 0.9) {
      c.save();
      c.globalAlpha = (p - 0.9) * 6;
      c.strokeStyle = 'rgba(242,232,208,0.16)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse ? c.ellipse(cx, cy + u * 0.3, u * 0.95, u * 1.5, 0, 0, Math.PI * 2) : c.rect(cx - u, cy - u, u * 2, u * 2.6);
      c.stroke();
      c.restore();
    }
  }

  /* ============================================================
     ACT 02 — departure, cruise, arrival
     One camera, three shots, cross-faded.
     ============================================================ */

  var STARS_B = makeStars(190, 550231);

  function shotDeparture(c, w, h, t, alpha) {
    c.save();
    c.globalAlpha = alpha;
    /* Earth sits low-left with its limb in view, then shrinks away as the ship climbs */
    var e = ease(t);
    var r = h * lerp(0.70, 0.16, e);
    var cx = w * lerp(0.30, 0.20, e);
    var cy = h * lerp(1.08, 0.90, e);
    var g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
    g.addColorStop(0, '#2C6BA8');
    g.addColorStop(0.55, '#17416F');
    g.addColorStop(1, '#0B1E38');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(95,208,196,' + (0.55 * (1 - t * 0.4)) + ')';
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();

    /* the burn: from the top of the limb, curling up and away to the right */
    var a0 = Math.PI * 1.50;
    var span = Math.PI * 0.42 * e;
    var pts = [];
    for (var k = 0; k <= 48; k++) {
      var f = k / 48;
      var ang = a0 + span * f;
      var rr = r * (1.03 + 0.9 * f * e);
      pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
    }
    c.strokeStyle = 'rgba(255,122,69,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    for (var i = 0; i < pts.length; i++) i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]);
    c.stroke();
    var end = pts[pts.length - 1];
    var hg = c.createRadialGradient(end[0], end[1], 0, end[0], end[1], 18);
    hg.addColorStop(0, 'rgba(255,200,120,0.9)');
    hg.addColorStop(1, 'rgba(255,122,69,0)');
    c.fillStyle = hg;
    c.beginPath(); c.arc(end[0], end[1], 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F2E8D0';
    c.beginPath(); c.arc(end[0], end[1], 5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function shotCruise(c, w, h, t, alpha, traj) {
    c.save();
    c.globalAlpha = alpha;
    var S = Math.min(w, h) * 0.33;      /* px per AU */
    var cx = w * 0.5, cy = h * 0.5;
    function P(pt) { return [cx + pt[0] * S, cy - pt[1] * S]; }
    function ring(pts, stroke, width) {
      c.strokeStyle = stroke; c.lineWidth = width;
      c.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var q = P(pts[i]);
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      }
      c.closePath(); c.stroke();
    }

    /* sun */
    var sg = c.createRadialGradient(cx, cy, 0, cx, cy, S * 0.34);
    sg.addColorStop(0, 'rgba(242,232,208,0.95)');
    sg.addColorStop(0.18, 'rgba(232,179,58,0.5)');
    sg.addColorStop(1, 'rgba(232,179,58,0)');
    c.fillStyle = sg;
    c.beginPath(); c.arc(cx, cy, S * 0.34, 0, Math.PI * 2); c.fill();

    if (traj) {
      ring(traj.orbitEarth, 'rgba(95,208,196,0.22)', 1.3);
      ring(traj.orbitVenus, 'rgba(232,179,58,0.22)', 1.3);

      /* the real transfer arc, drawn as the ship flies it */
      var arc = traj.outbound;
      var n = Math.max(1, Math.floor(arc.length * t));
      c.strokeStyle = '#5FD0C4';
      c.lineWidth = 3;
      c.beginPath();
      for (var i = 0; i <= n && i < arc.length; i++) {
        var q = P(arc[i]);
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      }
      c.stroke();

      var day = Math.round(t * 124);
      var e = P(traj.earthTrack[clamp(Math.round(day / 2), 0, traj.earthTrack.length - 1)]);
      var v = P(traj.venusTrack[clamp(Math.round(day / 2), 0, traj.venusTrack.length - 1)]);
      var s = P(arc[clamp(n, 0, arc.length - 1)]);

      c.fillStyle = '#5FD0C4';
      c.beginPath(); c.arc(e[0], e[1], 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#E8B33A';
      c.beginPath(); c.arc(v[0], v[1], 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#F2E8D0';
      c.beginPath(); c.arc(s[0], s[1], 4.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(242,232,208,0.45)';
      c.lineWidth = 1;
      c.beginPath(); c.arc(s[0], s[1], 11, 0, Math.PI * 2); c.stroke();

      c.font = '500 12px "IBM Plex Mono", monospace';
      c.fillStyle = '#5FD0C4';
      c.fillText('EARTH', e[0] + 12, e[1] - 10);
      c.fillStyle = '#E8B33A';
      c.fillText('VENUS', v[0] + 13, v[1] - 11);
    }
    c.restore();
  }

  function shotArrival(c, w, h, t, alpha) {
    c.save();
    c.globalAlpha = alpha;
    /* Venus swells from a bright dot into a horizon across the lower frame,
       so the braking pass and the split stay on screen */
    var e = ease(t);
    var r = Math.max(w, h) * lerp(0.10, 0.62, e);
    var cx = w * lerp(0.66, 0.54, e);
    var cy = h * lerp(0.46, 0.92, e) + r * lerp(0.0, 0.32, e);
    var g = c.createRadialGradient(cx - r * 0.32, cy - r * 0.36, r * 0.04, cx, cy, r);
    g.addColorStop(0, '#F6ECD2');
    g.addColorStop(0.45, '#E3C079');
    g.addColorStop(0.80, '#C08F43');
    g.addColorStop(1, '#7A5620');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();

    /* cloud banding */
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    c.globalAlpha = alpha * 0.16;
    for (var b = -6; b <= 6; b++) {
      c.fillStyle = b % 2 ? '#FFF6DF' : '#A8762F';
      c.beginPath();
      if (c.ellipse) c.ellipse(cx, cy + b * r * 0.15, r * 1.05, r * 0.055, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    /* aerocapture pass skimming the limb */
    var pass = seg(t, 0.18, 0.92);
    if (pass > 0) {
      c.strokeStyle = 'rgba(255,122,69,0.9)';
      c.lineWidth = 3;
      c.beginPath();
      var a0 = Math.PI * 1.36, a1 = Math.PI * 1.98;
      for (var k = 0; k <= 50; k++) {
        var f = k / 50;
        if (f > pass) break;
        var ang = lerp(a0, a1, f);
        var dip = Math.sin(f * Math.PI);
        var rr = r * (1.22 - 0.16 * dip);
        var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();

      /* glow where it bites deepest */
      var fa = clamp(pass, 0, 1);
      var ang2 = lerp(a0, a1, fa);
      var rr2 = r * (1.22 - 0.16 * Math.sin(fa * Math.PI));
      var gx = cx + Math.cos(ang2) * rr2, gy = cy + Math.sin(ang2) * rr2;
      var hg = c.createRadialGradient(gx, gy, 0, gx, gy, 26);
      hg.addColorStop(0, 'rgba(255,200,120,0.95)');
      hg.addColorStop(1, 'rgba(255,122,69,0)');
      c.fillStyle = hg;
      c.beginPath(); c.arc(gx, gy, 26, 0, Math.PI * 2); c.fill();

      /* the split: orbiter holds, the shell drops away */
      if (t > 0.74) {
        var sp = seg(t, 0.74, 1);
        c.fillStyle = '#5FD0C4';
        c.beginPath();
        c.arc(gx + 22 * sp, gy - 30 * sp, 5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#FF7A45';
        c.beginPath();
        c.arc(gx - 14 * sp, gy + 34 * sp, 5, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  function renderJourney(c, w, h, p) {
    c.fillStyle = '#07060E';
    c.fillRect(0, 0, w, h);
    paintStars(c, STARS_B, w, h, p * 90);

    var aDep = 1 - seg(p, 0.24, 0.33);
    var aCru = seg(p, 0.24, 0.33) * (1 - seg(p, 0.66, 0.75));
    var aArr = seg(p, 0.66, 0.75);

    if (aDep > 0.01) shotDeparture(c, w, h, seg(p, 0, 0.33), aDep);
    if (aCru > 0.01) shotCruise(c, w, h, seg(p, 0.30, 0.72), aCru, PHOS.TRAJ);
    if (aArr > 0.01) shotArrival(c, w, h, seg(p, 0.70, 1), aArr);
  }

  /* ============================================================
     boot
     ============================================================ */

  /* Speed through the trip, and what it is measured against. LEO at 7.67
     km/s, the 3.5 km/s burn, Earth's pull bleeding it down to the 2.66 km/s
     departure v-infinity, the heliocentric cruise from the real arc, then
     Venus' pull taking the 4.71 km/s arrival v-infinity up to 11.29 at the
     entry interface, and the aerobraking pass leaving Hesperus at 7.15 in
     a 300 km orbit. */
  var cruiseV = null;
  PHOS.TRIP_SPEED = function (p) {
    if (p < 0.33) {
      var t = seg(p, 0, 0.33);
      if (t < 0.28) return { v: 7.67, frame: 'vs Earth' };
      if (t < 0.42) return { v: lerp(7.67, 11.17, seg(t, 0.28, 0.42)), frame: 'vs Earth' };
      return { v: lerp(11.17, 2.66, easeOut(seg(t, 0.42, 1))), frame: 'vs Earth' };
    }
    if (p < 0.66) {
      var T = PHOS.TRAJ;
      if (!cruiseV && T && T.outbound) {
        cruiseV = [];
        for (var i = 0; i + 1 < T.outbound.length; i++) {
          var dx = T.outbound[i + 1][0] - T.outbound[i][0], dy = T.outbound[i + 1][1] - T.outbound[i][1];
          cruiseV.push(Math.sqrt(dx * dx + dy * dy) * 1731.46 / 2);
        }
        if (cruiseV.length > 1) cruiseV[cruiseV.length - 1] = cruiseV[cruiseV.length - 2];
      }
      var u = seg(p, 0.33, 0.66);
      var v = cruiseV && cruiseV.length ? cruiseV[Math.min(cruiseV.length - 1, Math.round(u * (cruiseV.length - 1)))] : lerp(26.8, 37.8, u);
      return { v: v, frame: 'vs the Sun' };
    }
    var a = seg(p, 0.66, 1);
    if (a < 0.5) return { v: lerp(4.71, 11.29, easeIn(seg(a, 0, 0.5))), frame: 'vs Venus' };
    if (a < 0.8) return { v: lerp(11.29, 7.15, ease(seg(a, 0.5, 0.8))), frame: 'vs Venus' };
    return { v: 7.15, frame: 'in orbit' };
  };
  function easeIn(t) { return t * t * t; }

  PHOS.ACTS = function (onTick, trackProgress) {
    var a = document.getElementById('assemblyCanvas');
    var b = document.getElementById('journeyCanvas');

    if (a) {
      var drawA = surface(a, renderAssembly);
      var trackA = a.closest('.stage').querySelector('.stage__track');
      drawA(REDUCED ? 1 : 0, true);
      onTick(function () { drawA(REDUCED ? 1 : trackProgress(trackA)); });
    }

    if (b) {
      var drawB = surface(b, renderJourney);
      var trackB = b.closest('.stage').querySelector('.stage__track');
      var out = {
        day: document.getElementById('jDay'),
        speed: document.getElementById('jSpeed'),
        frame: document.getElementById('jFrame'),
        phase: document.getElementById('jPhase'),
        note: document.getElementById('jNote')
      };
      var PHASES = [
        [0.00, 'Leaving Earth', 'One burn, and you are on your way.'],
        [0.33, 'Four months out', 'Sunlight gets stronger the whole way in.'],
        [0.66, 'Venus ahead', 'The atmosphere does the braking, not the engines.'],
        [0.88, 'Splitting up', 'Two stay in orbit. Two head for the clouds.']
      ];
      drawB(REDUCED ? 0.45 : 0, true);
      var lastPhase = -1;
      onTick(function () {
        var p = REDUCED ? 0.45 : trackProgress(trackB);
        drawB(p);
        if (!out.day) return;
        var day = Math.round(p * 124);
        out.day.firstChild.nodeValue = String(day);
        if (out.speed) { var sp = PHOS.TRIP_SPEED(p); out.speed.textContent = sp.v.toFixed(1); out.frame.textContent = sp.frame; }
        var idx = 0;
        for (var i = 0; i < PHASES.length; i++) if (p >= PHASES[i][0]) idx = i;
        if (idx !== lastPhase) {
          lastPhase = idx;
          out.phase.textContent = PHASES[idx][1];
          out.note.textContent = PHASES[idx][2];
        }
      });
    }
  };
})();
