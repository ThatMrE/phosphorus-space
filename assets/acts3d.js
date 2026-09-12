/* ============================================================
   PROJECT PHOSPHORUS — the acts in three dimensions
   Scroll-driven WebGL scenes built from the generated models in
   assets/models.js and the vendored three.js. If WebGL is not
   available, init() returns null and the 2D renderers in acts.js
   and mission.js take over unchanged.
   ============================================================ */
(function () {
  'use strict';

  var PHOS = window.PHOS || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, a, b) { return clamp((t - a) / (b - a || 1), 0, 1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t * t; }
  function bell(t, c, w) { var d = (t - c) / w; return Math.exp(-d * d * 2.2); }

  /* ---------- OBJ text -> three.js ------------------------- */

  function parseOBJ(text) {
    var verts = [], groups = [], cur = null;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (L.charCodeAt(0) === 118 && L.charCodeAt(1) === 32) {
        var p = L.split(/\s+/);
        verts.push(+p[1], +p[2], +p[3]);
      } else if (L.charCodeAt(0) === 102 && L.charCodeAt(1) === 32) {
        var q = L.split(/\s+/);
        var idx = [];
        for (var k = 1; k < q.length; k++) if (q[k]) idx.push(parseInt(q[k], 10) - 1);
        for (var t = 1; t + 1 < idx.length; t++) cur.faces.push(idx[0], idx[t], idx[t + 1]);
      } else if (L.indexOf('g ') === 0) {
        cur = { name: L.slice(2).trim(), material: 'hull', faces: [] };
        groups.push(cur);
      } else if (L.indexOf('usemtl ') === 0 && cur) {
        cur.material = L.slice(7).trim();
      }
    }
    return { verts: verts, groups: groups };
  }

  function material(THREE, key) {
    var mats = PHOS.MODEL_MATERIALS || {};
    var m = mats[key] || { rgb: [0.8, 0.8, 0.8], alpha: 1 };
    var steel = key === 'steel';
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(m.rgb[0], m.rgb[1], m.rgb[2]),
      roughness: steel ? 0.38 : 0.62, metalness: steel ? 0.65 : 0.08,
      transparent: m.alpha < 1, opacity: m.alpha,
      side: THREE.DoubleSide, depthWrite: m.alpha >= 1
    });
  }

  /* Build a Group of meshes, one per OBJ group. `keep(name)` filters groups. */
  function buildObject(THREE, parsed, keep) {
    var root = new THREE.Group();
    var pos = new Float32Array(parsed.verts);
    parsed.groups.forEach(function (g) {
      if (!g.faces.length || (keep && !keep(g.name))) return;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(g.faces);
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, material(THREE, g.material));
      mesh.name = g.name;
      mesh.userData.material = g.material;
      root.add(mesh);
    });
    return root;
  }

  var parsedCache = {};
  function model(THREE, key, keep) {
    if (!PHOS.MODELS || !PHOS.MODELS[key]) return new THREE.Group();
    if (!parsedCache[key]) parsedCache[key] = parseOBJ(PHOS.MODELS[key]);
    return buildObject(THREE, parsedCache[key], keep);
  }

  /* set opacity on every mesh in a group */
  function fade(obj, alpha) {
    obj.traverse(function (o) {
      if (!o.isMesh) return;
      var base = o.userData.baseAlpha;
      if (base === undefined) base = o.userData.baseAlpha = o.material.opacity;
      o.material.transparent = true;
      o.material.opacity = base * alpha;
      o.material.depthWrite = alpha > 0.5 && base >= 1;
      o.visible = alpha > 0.01;
    });
  }

  /* ---------- procedural textures -------------------------- */

  function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, o) { var s = 0, a = 0.5, f = 1; for (var i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.02; a *= 0.5; } return s; }

  function texture(THREE, w, h, px) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h);
    var d = img.data;
    for (var y = 0; y < h; y++) {
      var v = y / (h - 1);
      var lat = (0.5 - v) * Math.PI;
      for (var x = 0; x < w; x++) {
        var lon = (x / w) * Math.PI * 2;
        var rgba = px(lon, lat, v);
        var i = (y * w + x) * 4;
        d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3] === undefined ? 255 : rgba[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function earthTexture(THREE) {
    return texture(THREE, 512, 256, function (lon, lat) {
      var cx = 3 + 3 * Math.cos(lon), cy = 3 * Math.sin(lon) + lat * 4.2;
      var n = fbm(cx * 1.3, cy * 1.3, 6);
      var ice = Math.abs(lat) > 1.25 + 0.12 * vnoise(cx * 4, cy * 4);
      if (ice) return [230, 236, 240];
      if (n > 0.53) {
        var g = fbm(cx * 3 + 7, cy * 3, 3);
        var dry = Math.abs(lat) < 0.55 && g > 0.5;
        return dry ? [150, 128, 78] : [58 + g * 40, 96 + g * 50, 46];
      }
      var deep = n < 0.42;
      return deep ? [14, 44, 96] : [26, 72, 130];
    });
  }

  function cloudTexture(THREE) {
    return texture(THREE, 512, 256, function (lon, lat) {
      var cx = 5 + 5 * Math.cos(lon), cy = 5 * Math.sin(lon) + lat * 3;
      var n = fbm(cx * 1.4, cy * 1.4, 5);
      var a = clamp((n - 0.5) * 3.2, 0, 1) * 255;
      return [255, 255, 255, a];
    });
  }

  function venusTexture(THREE) {
    return texture(THREE, 512, 256, function (lon, lat) {
      var cx = 4 + 4 * Math.cos(lon), cy = 4 * Math.sin(lon);
      var band = fbm(cx * 0.6, lat * 5 + cx * 0.15, 4);
      var streak = fbm(cx * 2.2 + lat * 3, lat * 14, 4);
      var k = 0.86 + 0.18 * band + 0.10 * (streak - 0.5);
      var dark = 1 - 0.10 * clamp((streak - 0.62) * 6, 0, 1);
      return [214 * k * dark, 182 * k * dark, 106 * k];
    });
  }

  function marsTexture(THREE) {
    return texture(THREE, 512, 256, function (lon, lat) {
      var cx = 4 + 4 * Math.cos(lon), cy = 4 * Math.sin(lon) + lat * 3;
      var n = fbm(cx * 1.6, cy * 1.6, 5);
      var cap = Math.abs(lat) > 1.32 - 0.08 * vnoise(cx * 5, cy * 5);
      if (cap) return [236, 230, 224];
      var dark = clamp((n - 0.55) * 4, 0, 1);            /* the dark basalt plains */
      var k = 0.86 + 0.28 * (n - 0.5);
      return [lerp(200, 96, dark) * k, lerp(112, 58, dark) * k, lerp(64, 40, dark) * k];
    });
  }

  function glowTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = null;
  function glow(THREE, color, size) {
    if (!glowTex) glowTex = glowTexture(THREE);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: color, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.set(size, size, 1);
    return s;
  }

  /* a soft additive blob: stretched sphere, used for plumes and plasma */
  function blob(THREE, color, opacity) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    return m;
  }

  /* ---------- scene furniture ------------------------------ */

  function starfield(THREE, n, radius, seed) {
    var pos = new Float32Array(n * 3);
    var s = seed || 7;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = 0; i < n; i++) {
      var u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos[i * 3] = radius * r * Math.cos(th);
      pos[i * 3 + 1] = radius * u;
      pos[i * 3 + 2] = radius * r * Math.sin(th);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xF2E8D0, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8
    }));
  }

  function planet(THREE, o) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(o.radius, 96, 64), new THREE.MeshStandardMaterial({
      map: o.map, roughness: 0.9, metalness: 0
    }));
    g.add(body);
    if (o.clouds) {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(o.radius * 1.008, 96, 64), new THREE.MeshStandardMaterial({
        map: o.clouds, transparent: true, opacity: 0.9, roughness: 1, depthWrite: false
      })));
    }
    (o.haze || []).forEach(function (h) {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(o.radius * h[0], 96, 64), new THREE.MeshBasicMaterial({
        color: h[2], transparent: true, opacity: h[1], side: THREE.FrontSide, depthWrite: false
      })));
    });
    /* rim: a back-facing shell, additive, reads as the atmosphere's limb */
    g.add(new THREE.Mesh(new THREE.SphereGeometry(o.radius * (o.rimScale || 1.045), 96, 64), new THREE.MeshBasicMaterial({
      color: o.rim, transparent: true, opacity: o.rimOpacity || 0.35, side: THREE.BackSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
    return g;
  }

  function lights(THREE, scene, dir, strength) {
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x0A0912, 0.35));
    var sun = new THREE.DirectionalLight(0xFFF3D6, strength || 1.25);
    sun.position.set(dir[0], dir[1], dir[2]);
    scene.add(sun);
    return sun;
  }

  /* ---------- a renderer bound to one canvas --------------- */

  function makeView(canvas, o) {
    var THREE = window.THREE;
    if (!THREE) return null;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: !!o.alpha, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (o.alpha) renderer.setClearColor(0x000000, 0); else renderer.setClearColor(0x07060E, 1);
    var camera = new THREE.PerspectiveCamera(o.fov || 40, 1, o.near || 0.5, o.far || 60000);
    var w = 0, h = 0, visible = true;
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      if (!w || !h) return false;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      return true;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var was = visible;
        visible = es[0].isIntersecting;
        if (visible && !was && view.onVisible) view.onVisible();
      }, { threshold: 0 }).observe(o.watch || canvas);
    }
    var view = {
      THREE: THREE, renderer: renderer, camera: camera, size: size,
      w: function () { return w; }, h: function () { return h; },
      visible: function () { return visible; },
      render: function (scene, cam) {
        if (!w || !h) { if (!size()) return; }
        renderer.render(scene, cam || camera);
      }
    };
    window.addEventListener('resize', function () { size(); if (view.onResize) view.onResize(); }, { passive: true });
    size();
    return view;
  }

  /* ============================================================
     ACT 01 — Starship launches, and the stack comes together
     ============================================================ */

  var PARTS = [
    { key: 'spine',  a: 0.10, b: 0.26, label: 'The spine', groups: ['spine'] },
    { key: 'hab',    a: 0.24, b: 0.40, label: 'Hesperus — the ride there and back',
      groups: ['hesperus_habitat', 'hesperus_storm_shelter', 'hesperus_docking_node', 'hesperus_truss', 'hesperus_engine'] },
    { key: 'wings',  a: 0.38, b: 0.52, label: 'Solar wings', groups: ['hesperus_solar_wings'] },
    { key: 'tanks',  a: 0.50, b: 0.64, label: 'Propellant for the burn home', groups: ['hesperus_propellant'] },
    { key: 'shell',  a: 0.62, b: 0.78, label: 'Phosphorus — folded, in its shell', groups: ['aeroshell', 'shell_backplate'] },
    { key: 'vesper', a: 0.76, b: 0.92, label: 'Vesper — the ride home from the clouds',
      groups: ['vesper_stage_1', 'vesper_stage_2', 'vesper_capsule', 'vesper_engines', 'vesper_mount'] }
  ];

  function actAssembly(canvas, onTick, trackProgress, caption) {
    var v = makeView(canvas, { fov: 38, near: 1, far: 80000, watch: canvas.closest('.stage') });
    if (!v) return false;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 900, 30000, 91177));
    lights(THREE, scene, [0.8, 0.7, 1.0], 1.3);

    var earth = planet(THREE, {
      radius: 2600, map: earthTexture(THREE), clouds: cloudTexture(THREE),
      rim: 0x5FD0C4, rimOpacity: 0.32, rimScale: 1.04
    });
    earth.rotation.z = 0.4;
    scene.add(earth);

    /* the stack, split into the pieces that go up separately */
    var assembly = new THREE.Group();
    var stackParsed = parsedCache.assembled_stack || (parsedCache.assembled_stack = parseOBJ(PHOS.MODELS.assembled_stack));
    var parts = {};
    PARTS.forEach(function (p) {
      var g = buildObject(THREE, stackParsed, function (name) { return p.groups.indexOf(name) >= 0; });
      g.visible = false;
      parts[p.key] = g;
      assembly.add(g);
    });
    assembly.position.set(0, 17, 0);
    assembly.rotation.set(0, 0.35, -0.22);
    scene.add(assembly);

    /* one full launch vehicle for the lift-off, one ship for the deliveries */
    var boosterGroups = ['booster', 'hot_stage_ring', 'grid_fins', 'booster_engines'];
    var launcher = model(THREE, 'starship', function (n) { return n !== 'person'; });
    var booster = new THREE.Group(), shipOnLauncher = new THREE.Group();
    launcher.children.slice().forEach(function (m) {
      (boosterGroups.indexOf(m.name) >= 0 ? booster : shipOnLauncher).add(m);
    });
    launcher.add(booster); launcher.add(shipOnLauncher);
    var plumeL = blob(THREE, 0xFFB65A, 0.85); plumeL.position.y = -60; plumeL.scale.set(9, 60, 9);
    var flareL = glow(THREE, 0xFF7A45, 90); flareL.position.y = -6;
    booster.add(plumeL); booster.add(flareL);
    launcher.visible = false;
    scene.add(launcher);

    var ship = model(THREE, 'starship', function (n) { return boosterGroups.indexOf(n) < 0 && n !== 'person'; });
    ship.position.y = 0;
    /* the ship model stands on its booster at y=72.8; drop it to its own base */
    ship.children.forEach(function (m) { m.position.y = -72.8; });
    var plumeS = blob(THREE, 0x8FE3D8, 0.6); plumeS.position.y = -12; plumeS.scale.set(3, 12, 3);
    var flareS = glow(THREE, 0x5FD0C4, 28); flareS.position.y = -3;
    ship.add(plumeS); ship.add(flareS);
    ship.visible = false;
    scene.add(ship);

    var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
    var lookTarget = new THREE.Vector3(-14, -4, 0);
    var last = -1, lastLabel = '';
    /* staging positions are in camera space, so they frame the same way
       wherever the camera has orbited to */
    var EARTH = new THREE.Vector3(-1100, -3650, -3500);
    var HOLD = new THREE.Vector3(104, -26, -330);  /* where the ship parks with a delivery */
    function cam2world(local, out) {
      var ax = clamp(v.camera.aspect / 1.6, 0.26, 1);   /* narrow screens: keep the staging in frame */
      return (out || tmp).set(local.x * ax, local.y, local.z).applyMatrix4(v.camera.matrixWorld);
    }

    function place(obj, from, to, t, up) {
      tmp.copy(from).lerp(to, t);
      obj.position.copy(tmp);
      tmp2.copy(to).sub(from).normalize();
      /* the ship's long axis is +Y; point it along the direction of travel */
      var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp2);
      obj.quaternion.copy(q);
      obj.position.addScaledVector(tmp2, -26);   /* the model's origin is its base; center it on the path */
    }

    var L0 = new THREE.Vector3(-330, -420, -760), L1 = new THREE.Vector3(-110, -70, -560), L2 = new THREE.Vector3(70, 460, -460);
    var D0 = new THREE.Vector3(-460, -420, -980), D1 = new THREE.Vector3(470, -320, -1000);
    var w0 = new THREE.Vector3(), w1 = new THREE.Vector3(), w2 = new THREE.Vector3();

    function frame(p) {
      /* camera first: a slow orbit, pulling back at the end to take in the whole stack */
      var theta = lerp(0.45, -0.35, p), phi = 1.22;
      var radius = lerp(178, 300, seg(p, 0.9, 1));
      v.camera.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi) + lookTarget.y, radius * Math.sin(phi) * Math.sin(theta));
      v.camera.lookAt(lookTarget);
      v.camera.updateMatrixWorld();
      assembly.rotation.y = 0.35 + p * 0.6;
      assembly.updateMatrixWorld();
      cam2world(EARTH, earth.position);
      earth.rotation.y = p * 0.3;

      /* lift-off from the limb, 0 – 0.14 */
      var tl = seg(p, 0.0, 0.14);
      launcher.visible = tl > 0 && tl < 1;
      if (launcher.visible) {
        var s1 = seg(tl, 0, 0.62), s2 = seg(tl, 0.55, 1);
        cam2world(L0, w0); cam2world(L1, w1); cam2world(L2, w2);
        tmp.copy(w0).lerp(w1, easeOut(s1)); tmp.lerp(tmp2.copy(w1).lerp(w2, easeIn(s2)), s2);
        launcher.position.copy(tmp);
        launcher.quaternion.copy(v.camera.quaternion);
        launcher.rotateZ(lerp(-0.42, -0.7, tl));
        var sep = seg(tl, 0.58, 0.72);
        booster.position.set(-sep * 60, -sep * 240, sep * 30);
        booster.rotation.z = sep * 0.9;
        plumeL.scale.set(9, 60 * (1 - sep) + 4, 9);
        plumeL.visible = sep < 0.98; flareL.visible = plumeL.visible;
        fade(booster, 1 - seg(tl, 0.8, 1));
      }

      /* deliveries */
      var label = '';
      var holdWorld = cam2world(HOLD, w2).clone();
      var holdLocal = assembly.worldToLocal(tmp3.copy(holdWorld)).clone();
      cam2world(D0, w0); cam2world(D1, w1);
      PARTS.forEach(function (pt) {
        var t = seg(p, pt.a, pt.b);
        var g = parts[pt.key];
        var started = t > 0;
        g.visible = started;
        if (!started) return;
        var come = easeOut(seg(t, 0, 0.36));
        var move = ease(seg(t, 0.36, 0.72));
        var go = easeIn(seg(t, 0.72, 1));
        g.position.copy(holdLocal).multiplyScalar(1 - move);
        if (t < 1) label = pt.label;
        if (t < 1 && t > 0) {
          ship.visible = true;
          if (go <= 0) place(ship, w0, holdWorld, come);
          else place(ship, holdWorld, w1, go);
          var thrust = go > 0 ? 1 : (1 - come);
          plumeS.scale.set(3, 4 + 10 * thrust, 3); plumeS.material.opacity = 0.15 + 0.5 * thrust;
          flareS.material.opacity = 0.2 + 0.8 * thrust;
        }
      });
      var anyShip = PARTS.some(function (pt) { var t = seg(p, pt.a, pt.b); return t > 0 && t < 1; });
      ship.visible = anyShip;

      var capKey = label || (p < 0.16 ? 'launch' : 'done');
      if (caption && capKey !== lastLabel) {
        lastLabel = capKey;
        caption.textContent = label || (p < 0.16 ? 'Starship — six flights to orbit' : 'Six pieces fully assembled. Hesperus is ready to fly.');
        caption.classList.toggle('is-final', !label && p >= 0.16);
      }
      v.render(scene);
    }

    var track = canvas.closest('.stage').querySelector('.stage__track');
    frame(REDUCED ? 1 : 0);
    onTick(function () {
      var p = REDUCED ? 1 : trackProgress(track);
      if (!v.visible() && last >= 0) return;
      if (Math.abs(p - last) < 0.0008) return;
      last = p;
      frame(p);
    });
    v.onResize = function () { frame(last < 0 ? 0 : last); };
    v.onVisible = function () { last = REDUCED ? 1 : trackProgress(track); frame(last); };
    return true;
  }

  /* ============================================================
     ACT 02 — the burn out, the cruise, and the aerobraking pass
     ============================================================ */

  function actJourney(canvas, onTick, trackProgress, hud) {
    var v = makeView(canvas, { fov: 40, near: 0.5, far: 80000, watch: canvas.closest('.stage') });
    if (!v) return false;
    var THREE = v.THREE;
    var stackKeep = function (n) { return n !== 'person'; };

    /* ---- shot A: leaving Earth ---- */
    var A = new THREE.Scene();
    A.add(starfield(THREE, 900, 30000, 4471));
    lights(THREE, A, [0.9, 0.5, 0.9], 1.3);
    var earthA = planet(THREE, { radius: 2600, map: earthTexture(THREE), clouds: cloudTexture(THREE), rim: 0x5FD0C4, rimOpacity: 0.32, rimScale: 1.04 });
    earthA.position.set(-2300, -2500, -1500);
    A.add(earthA);
    var stackA = model(THREE, 'assembled_stack', stackKeep);
    var stackAg = new THREE.Group(); stackAg.add(stackA); stackA.position.y = 17;
    stackAg.rotation.set(0, 0.5, -0.9);      /* aft toward the lower left, prograde up-right */
    A.add(stackAg);
    var burnA = blob(THREE, 0xFFB65A, 0.8); burnA.position.set(0, -50 + 17, 0); burnA.scale.set(0.01, 0.01, 0.01);
    var burnFlare = glow(THREE, 0xFF7A45, 1); burnFlare.position.set(0, -49 + 17, 0);
    stackA.add(burnA); stackA.add(burnFlare);
    var camA = new THREE.PerspectiveCamera(40, 1, 0.5, 80000);

    /* ---- shot B: the cruise, heliocentric ---- */
    var B = new THREE.Scene();
    B.add(starfield(THREE, 1200, 30000, 8123));
    B.add(new THREE.AmbientLight(0xF2E8D0, 0.45));
    var sunLight = new THREE.PointLight(0xFFF3D6, 1.6, 0, 0); B.add(sunLight);
    var S = 120; /* units per AU */
    var sun = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), new THREE.MeshBasicMaterial({ color: 0xFFE7A8 }));
    B.add(sun); B.add(glow(THREE, 0xE8B33A, 70));
    var T = PHOS.TRAJ || {};
    function ring(points, color, opacity, dashed) {
      var pts = points.map(function (q) { return new THREE.Vector3(q[0] * S, 0, -q[1] * S); });
      var geo = new THREE.BufferGeometry().setFromPoints(pts);
      var mat = dashed
        ? new THREE.LineDashedMaterial({ color: color, transparent: true, opacity: opacity, dashSize: 3, gapSize: 3 })
        : new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity });
      var line = new THREE.Line(geo, mat);
      if (dashed) line.computeLineDistances();
      return line;
    }
    if (T.orbitEarth) B.add(ring(T.orbitEarth.concat([T.orbitEarth[0]]), 0x5FD0C4, 0.35));
    if (T.orbitVenus) B.add(ring(T.orbitVenus.concat([T.orbitVenus[0]]), 0xE8B33A, 0.35));
    var arcAll = T.outbound ? ring(T.outbound, 0xF2E8D0, 0.25, true) : null;
    if (arcAll) B.add(arcAll);
    var trailGeo = new THREE.BufferGeometry();
    var trailPos = new Float32Array((T.outbound ? T.outbound.length : 2) * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    var trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xFF7A45, transparent: true, opacity: 0.95 }));
    B.add(trail);
    var earthB = planet(THREE, { radius: 3.2, map: earthTexture(THREE), clouds: cloudTexture(THREE), rim: 0x5FD0C4, rimOpacity: 0.4, rimScale: 1.12 });
    var venusB = planet(THREE, { radius: 3.0, map: venusTexture(THREE), rim: 0xE8B33A, rimOpacity: 0.4, rimScale: 1.12 });
    B.add(earthB); B.add(venusB);
    var shipB = model(THREE, 'assembled_stack', stackKeep);
    shipB.scale.set(0.07, 0.07, 0.07);
    shipB.rotation.z = -Math.PI / 2;
    var shipBg = new THREE.Group(); shipBg.add(shipB); shipBg.add(glow(THREE, 0xFF7A45, 9));
    B.add(shipBg);
    var camB = new THREE.PerspectiveCamera(36, 1, 0.5, 80000);

    /* ---- shot C: arrival, split, and the aerobraking pass ---- */
    var C = new THREE.Scene();
    C.add(starfield(THREE, 900, 30000, 6011));
    lights(THREE, C, [-0.6, 0.9, 0.8], 0.95);
    var VR = 2600;
    var venusC = planet(THREE, {
      radius: VR, map: venusTexture(THREE), rim: 0xE8B33A, rimOpacity: 0.45, rimScale: 1.05,
      haze: [[1.014, 0.2, 0xE8CE92], [1.03, 0.09, 0xF2E8D0]]
    });
    venusC.position.set(0, -VR - 160, 0);
    C.add(venusC);
    var hesp = model(THREE, 'hesperus_transit_habitat', function (n) { return n !== 'person'; });
    var hespG = new THREE.Group(); hespG.add(hesp);
    hesp.rotation.z = Math.PI / 2;            /* habitat long axis along -X: it flies blunt-end first */
    hesp.position.x = 5;
    var hSheath = blob(THREE, 0xFF7A45, 0.0); hSheath.position.set(9, 0, 0); hSheath.scale.set(14, 9, 9);
    var hTrail = blob(THREE, 0xFF7A45, 0.0); hTrail.position.set(-16, 0, 0); hTrail.scale.set(14, 2, 2);
    hTrail.material.blending = THREE.NormalBlending;
    var hFlare = glow(THREE, 0xFF7A45, 1); hFlare.position.set(10, 0, 0);
    hespG.add(hSheath); hespG.add(hTrail); hespG.add(hFlare);
    C.add(hespG);
    var ev = model(THREE, 'entry_vehicle', function (n) { return n !== 'person'; });
    var evG = new THREE.Group(); evG.add(ev);
    ev.rotation.z = Math.PI / 2;               /* heat shield forward (-X) */
    var eSheath = blob(THREE, 0xFF7A45, 0.0); eSheath.position.set(4, 0, 0); eSheath.scale.set(10, 8, 8);
    var eTrail = blob(THREE, 0xFF7A45, 0.0); eTrail.position.set(-16, 0, 0); eTrail.scale.set(12, 1.8, 1.8);
    eTrail.material.blending = THREE.NormalBlending;
    evG.add(eSheath); evG.add(eTrail);
    C.add(evG);
    var camC = new THREE.PerspectiveCamera(44, 1, 0.5, 80000);
    var t0 = performance.now();

    var fadeEl = canvas.parentNode.querySelector('.act__fade');
    var lastP = -1, lastPhase = -1;
    var PHASES = [
      [0.00, 'Leaving Earth',  ''],
      [0.33, 'Four months out', ''],
      [0.66, 'Venus ahead',    'The atmosphere does the braking, not the engines.'],
      [0.74, 'Splitting up',   'Two stay with Hesperus. Two go in direct.'],
      [0.80, 'Aerobraking',    '11.3 km/s in, 7.2 km/s out. No propellant spent.'],
      [0.93, 'Captured',       'Hesperus is in orbit. The airship is going in.']
    ];

    function shotA(t) {
      var burn = seg(t, 0.28, 0.42) * (1 - seg(t, 0.86, 1));
      burnA.scale.set(4 * burn + 0.01, 30 * burn + 0.01, 4 * burn + 0.01);
      burnFlare.scale.set(60 * burn + 0.01, 60 * burn + 0.01, 1);
      var away = easeIn(seg(t, 0.36, 1));
      stackAg.position.set(280 * away, 40 * away, -900 * away);
      stackAg.rotation.y = 0.5 + t * 0.3;
      camA.position.set(20, 30, 200);
      camA.lookAt(80 * away, 10 * away, -260 * away);
      camA.aspect = v.camera.aspect; camA.updateProjectionMatrix();
      v.render(A, camA);
    }

    function shotB(t) {
      if (!T.outbound) { v.render(B, camB); return; }
      var n = T.outbound.length, i = Math.round(t * (n - 1));
      var q = T.outbound[i];
      shipBg.position.set(q[0] * S, 0, -q[1] * S);
      var e = T.earthTrack ? T.earthTrack[Math.min(i, T.earthTrack.length - 1)] : q;
      var w = T.venusTrack ? T.venusTrack[Math.min(i, T.venusTrack.length - 1)] : q;
      earthB.position.set(e[0] * S, 0, -e[1] * S);
      venusB.position.set(w[0] * S, 0, -w[1] * S);
      for (var k = 0; k < n; k++) {
        var j = Math.min(k, i);
        trailPos[k * 3] = T.outbound[j][0] * S; trailPos[k * 3 + 1] = 0; trailPos[k * 3 + 2] = -T.outbound[j][1] * S;
      }
      trailGeo.attributes.position.needsUpdate = true;
      var az = lerp(-0.9, -0.2, t), el = 0.95, r = 300;
      camB.position.set(r * Math.cos(el) * Math.cos(az), r * Math.sin(el), r * Math.cos(el) * Math.sin(az));
      camB.lookAt(shipBg.position.x * 0.45, 0, shipBg.position.z * 0.45);
      camB.aspect = v.camera.aspect; camB.updateProjectionMatrix();
      earthB.rotation.y = t * 8; venusB.rotation.y = t * 2;
      v.render(B, camB);
    }

    function shotC(t) {
      /* Hesperus on a shallow arc that dips into the upper air at t≈0.62 */
      var x = lerp(-1500, 1300, t);
      var y = -110 + 0.00026 * x * x;
      hespG.position.set(x, y, 0);
      var dydx = 0.00052 * x;
      hespG.rotation.z = Math.atan(dydx);
      var heat = bell(t, 0.62, 0.11);
      var now = (performance.now() - t0) / 1000;
      var flick = 0.85 + 0.15 * Math.sin(now * 37) * Math.sin(now * 11);
      hSheath.material.opacity = 0.42 * heat * flick;
      hTrail.material.opacity = 0.4 * heat * flick;
      hTrail.scale.set(14 + 24 * heat, 2 + 0.8 * heat, 2 + 0.8 * heat);
      hTrail.position.x = -(14 + 20 * heat);
      hFlare.scale.set(1 + 28 * heat * flick, 1 + 28 * heat * flick, 1);

      /* the entry vehicle separates at t≈0.24 and takes the steeper way in */
      var sp = seg(t, 0.24, 1);
      evG.visible = true;
      var ex = x - 30 - 60 * sp, ey = y - 6 - 150 * easeIn(sp) - 70 * sp;
      evG.position.set(ex, ey, 6 + 10 * sp);
      evG.rotation.z = hespG.rotation.z - 0.35 * sp;
      var eheat = bell(t, 0.66, 0.13) * (sp > 0 ? 1 : 0);
      eSheath.material.opacity = 0.5 * eheat * flick;
      eTrail.material.opacity = 0.4 * eheat * flick;
      eTrail.scale.set(12 + 18 * eheat, 1.8, 1.8);
      eTrail.position.x = -(12 + 14 * eheat);
      fade(ev, 1 - seg(t, 0.82, 0.98));

      /* chase camera, above and behind, Venus filling the lower frame */
      var wide = easeOut(seg(t, 0.8, 1));
      var cx = x - 150 - 200 * wide, cy = y + 60 + 260 * wide, cz = 230 - 40 * heat + 1100 * wide;
      camC.position.set(cx, cy, cz);
      camC.lookAt(x + 40, y - 20 * heat - 420 * wide, 0);
      camC.aspect = v.camera.aspect; camC.updateProjectionMatrix();
      venusC.rotation.y = t * 0.15;
      v.render(C, camC);
      return heat > 0.02;
    }

    var track = canvas.closest('.stage').querySelector('.stage__track');
    function frame(p) {
      var f = Math.max(1 - Math.abs(p - 0.33) / 0.03, 1 - Math.abs(p - 0.66) / 0.03, 0);
      if (fadeEl) fadeEl.style.opacity = f.toFixed(3);
      var live = false;
      if (p < 0.33) shotA(seg(p, 0, 0.33));
      else if (p < 0.66) shotB(seg(p, 0.33, 0.66));
      else live = shotC(seg(p, 0.66, 1));
      if (hud.day) {
        hud.day.firstChild.nodeValue = String(Math.round(p * 124));
        var idx = 0;
        for (var i = 0; i < PHASES.length; i++) if (p >= PHASES[i][0]) idx = i;
        if (idx !== lastPhase) {
          lastPhase = idx;
          hud.phase.textContent = PHASES[idx][1];
          hud.note.textContent = PHASES[idx][2];
        }
      }
      return live;
    }
    frame(REDUCED ? 0.45 : 0);
    var animating = false;
    onTick(function () {
      var p = REDUCED ? 0.45 : trackProgress(track);
      if (!v.visible()) return;
      if (!animating && Math.abs(p - lastP) < 0.0006) return;
      lastP = p;
      animating = frame(p) && !REDUCED;
    });
    v.onResize = function () { frame(lastP < 0 ? 0 : lastP); };
    v.onVisible = function () { lastP = REDUCED ? 0.45 : trackProgress(track); animating = frame(lastP) && !REDUCED; };
    return true;
  }

  /* ============================================================
     ACT 03 — the entry vehicle, the chute, and the hull inflating
     A transparent WebGL layer over the 2D atmosphere; world units are
     CSS pixels at z = 0, so it lines up with the altitude scale.
     ============================================================ */

  function descent3d(canvas) {
    var v = makeView(canvas, { fov: 40, near: 1, far: 8000, alpha: true, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0xC26A2A, 0.75));
    var sun = new THREE.DirectionalLight(0xFFF3D6, 1.1); sun.position.set(0.3, 1, 0.8); scene.add(sun);

    var ev = model(THREE, 'entry_vehicle', function (n) { return n !== 'person'; });
    var shield = null, shell = new THREE.Group();
    ev.children.slice().forEach(function (m) { if (m.name === 'heatshield') shield = m; });
    var evG = new THREE.Group(); evG.add(ev);
    var plasma = blob(THREE, 0xFF7A45, 0); plasma.position.set(0, -4, 0); plasma.scale.set(9, 6, 9);
    var plasmaTrail = blob(THREE, 0xFFB65A, 0); plasmaTrail.position.set(0, 14, 0); plasmaTrail.scale.set(5, 26, 5);
    var pflare = glow(THREE, 0xFF7A45, 1); pflare.position.set(0, -5, 0);
    evG.add(plasma); evG.add(plasmaTrail); evG.add(pflare);
    scene.add(evG);

    /* parachute: a canopy and twelve lines */
    var chute = new THREE.Group();
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xF2E8D0, side: THREE.DoubleSide, roughness: 0.9 }));
    var stripes = new THREE.Mesh(new THREE.SphereGeometry(1.002, 8, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xFF7A45, wireframe: true, transparent: true, opacity: 0.6 }));
    chute.add(canopy); chute.add(stripes);
    var linePts = [];
    for (var i = 0; i < 12; i++) {
      var th = i / 12 * Math.PI * 2;
      linePts.push(new THREE.Vector3(Math.cos(th), 0, Math.sin(th)), new THREE.Vector3(0, -2.3, 0));
    }
    chute.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0.7 })));
    chute.visible = false;
    scene.add(chute);

    var airship = model(THREE, 'phosphorus_airship', function (n) {
      return ['helium_cells', 'breathable_air_volume', 'ballonets', 'person'].indexOf(n) < 0;
    });
    var shipG = new THREE.Group(); shipG.add(airship);
    airship.rotation.y = 0.35;
    shipG.visible = false;
    scene.add(shipG);

    function fit(w, h) {
      v.camera.fov = 40;
      v.camera.position.set(0, 0, (h / 2) / Math.tan(Math.PI / 9));
      v.camera.lookAt(0, 0, 0);
      v.camera.updateProjectionMatrix();
    }
    var lastW = 0, lastH = 0, lastArgs = null;
    v.onVisible = function () { if (lastArgs) render.apply(null, lastArgs); };

    function render(alt, w, h, spec) {
      lastArgs = [alt, w, h, spec];
      if (!v.visible()) return;
      if (w !== lastW || h !== lastH) { lastW = w; lastH = h; v.size(); fit(w, h); }
      var pxPerKm = h / spec.span;
      var cx = w * spec.x - w / 2;
      var shipLen = spec.len;

      /* entry: heat shield first, plasma peaking near 82 km, chute at 74,
         the shell dropping away once the hull is out */
      var entering = alt > 62;
      evG.visible = entering;
      if (entering) {
        var k = 7.2 * Math.min(1, w / 900 + 0.35);
        var shellDrop = seg(alt, 70, 63);
        evG.position.set(cx + 40 * shellDrop, -260 * easeIn(shellDrop), 0);
        evG.scale.set(k, k, k);
        evG.rotation.z = 0.16 + 1.1 * shellDrop;
        var heat = alt > 74 ? bell(alt, 84, 11) * seg(alt, 74, 78) : 0;
        var flick = 0.8 + 0.2 * Math.sin(alt * 140);
        plasma.material.opacity = 0.8 * heat * flick;
        plasmaTrail.material.opacity = 0.45 * heat * flick;
        plasmaTrail.scale.set(5 + 3 * heat, 26 + 40 * heat, 5 + 3 * heat);
        pflare.scale.set(1 + 70 * heat, 1 + 70 * heat, 1);
        /* the shield drops away once the chute is out */
        var drop = seg(alt, 74, 71.5);
        fade(ev, 1 - seg(shellDrop, 0.4, 1));
        if (shield) { shield.position.y = -drop * 40; shield.rotation.x = drop * 0.8; fade(shield, 1 - seg(drop, 0.5, 1)); }
      }

      /* the hull is pulled out and inflated between 72 and 52 km */
      var inflate = seg(alt, 72, 52);
      var sK = (shipLen / 129) * lerp(0.06, 1, easeOut(inflate));

      /* chute from 74 km, released at 52 */
      var chuteOpen = seg(alt, 74, 72.4) * (alt > 52 ? 1 : 0);
      chute.visible = chuteOpen > 0;
      if (chute.visible) {
        var cr = Math.min(w, h) * 0.11 * chuteOpen;
        chute.scale.set(cr, cr, cr);
        chute.position.set(cx, cr * 2.6 + (inflate > 0 ? sK * 26 + (1 - easeOut(inflate)) * 70 : 34), 0);
      }
      shipG.visible = inflate > 0;
      if (shipG.visible) {
        var s = sK;
        var y = alt >= 52 ? (1 - easeOut(inflate)) * 70 : -(alt - 52) * pxPerKm;
        shipG.position.set(cx, y, 0);
        shipG.scale.set(s, s, s);
        airship.rotation.y = 0.35 + (52 - Math.min(alt, 52)) * 0.01;
      }
      v.render(scene);
    }
    return render;
  }

  /* ============================================================
     VENUS AGAINST MARS — two planets turning, one callout each
     ============================================================ */

  function compare3d(canvas) {
    var v = makeView(canvas, { fov: 44, near: 1, far: 5000, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 700, 3000, 3301));
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x0A0912, 0.3));
    var sun = new THREE.DirectionalLight(0xFFF3D6, 1.3);
    sun.position.set(-0.8, 0.5, 0.9);
    scene.add(sun);
    var host = canvas.parentNode;

    var R = 30;
    function world(kind) {
      var g = new THREE.Group();
      var isV = kind === 'venus';
      var body = planet(THREE, isV
        ? { radius: R, map: venusTexture(THREE), rim: 0xE8B33A, rimOpacity: 0.4, rimScale: 1.05 }
        : { radius: R, map: marsTexture(THREE), rim: 0xFF7A45, rimOpacity: 0.16, rimScale: 1.025 });
      g.add(body);
      var mesh = body.children[0];
      mesh.material.transparent = true;
      var fx = {};
      /* the 50 km deck / the whole thin atmosphere */
      fx.cloud = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 48), new THREE.MeshBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0, depthWrite: false }));
      fx.thin = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 64, 48), new THREE.MeshBasicMaterial({ color: 0x5FD0C4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      /* an orbit ring */
      fx.orbit = new THREE.Mesh(new THREE.TorusGeometry(R * 1.55, 0.35, 8, 96), new THREE.MeshBasicMaterial({ color: isV ? 0xE8B33A : 0xFF7A45, transparent: true, opacity: 0 }));
      fx.orbit.rotation.x = 1.25;
      /* the surface, under the clouds */
      fx.lava = new THREE.Mesh(new THREE.SphereGeometry(R * 0.975, 64, 48), new THREE.MeshStandardMaterial({ color: 0x3A1208, emissive: 0xFF7A45, emissiveIntensity: 0, roughness: 0.9 }));
      fx.lava.visible = false;
      /* the polar cap, and a spot on the ground; both turn with the planet */
      fx.pole = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 48, 12, 0, Math.PI * 2, 0, 0.42), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      fx.ground = glow(THREE, isV ? 0xFF7A45 : 0x5FD0C4, 0.01);
      fx.ground.position.set(0, R * 0.15, R * 0.99);
      fx.sun = glow(THREE, 0xFFF3D6, 0.01);
      fx.sun.position.set(-R * 0.62, R * 0.36, R * 0.72);
      mesh.add(fx.pole); mesh.add(fx.ground);
      g.add(fx.cloud); g.add(fx.thin); g.add(fx.orbit); g.add(fx.lava); g.add(fx.sun);
      scene.add(g);
      /* where each callout points, in the planet's frame; the ones on the body turn with it */
      var anchors = {
        orbit: { of: g, at: new THREE.Vector3(R * 1.55 * Math.cos(0.4), R * 1.55 * Math.sin(0.4) * Math.cos(1.25), -R * 1.55 * Math.sin(0.4) * Math.sin(1.25)) },
        body:  { of: g, at: new THREE.Vector3(0, R * 1.02, 0) },
        cloud: { of: g, at: new THREE.Vector3(-R * 0.5, R * 0.62, R * 0.72) },
        thin:  { of: g, at: new THREE.Vector3(-R * 0.55, R * 0.6, R * 0.68) },
        lava:  { of: g, at: new THREE.Vector3(0, R * 0.1, R * 0.97) },
        ground: { of: mesh, at: new THREE.Vector3(0, R * 0.15, R * 0.99) },
        pole:  { of: mesh, at: new THREE.Vector3(0, R * 1.02, 0) },
        sun:   { of: g, at: new THREE.Vector3(-R * 0.62, R * 0.36, R * 0.72) }
      };
      return { group: g, body: mesh, fx: fx, anchors: anchors, isV: isV, kind: null, mix: 0, prev: null, prevMix: 0 };
    }
    var venus = world('venus'), mars = world('mars');

    /* HTML callouts and names, laid over the canvas */
    var overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'cmp__lines');
    host.appendChild(overlay);
    function callout(cls) {
      var el = document.createElement('div');
      el.className = 'cmp__call ' + cls;
      host.appendChild(el);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', cls.indexOf('--v') > 0 ? '#E8B33A' : '#FF7A45');
      overlay.appendChild(line);
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3.5'); dot.setAttribute('fill', cls.indexOf('--v') > 0 ? '#E8B33A' : '#FF7A45');
      overlay.appendChild(dot);
      return { el: el, line: line, dot: dot };
    }
    var callV = callout('cmp__call--v'), callM = callout('cmp__call--m');
    var nameV = document.createElement('p'), nameM = document.createElement('p');
    nameV.className = 'cmp__name'; nameV.textContent = 'Venus';
    nameM.className = 'cmp__name'; nameM.textContent = 'Mars';
    host.appendChild(nameV); host.appendChild(nameM);

    var tmp = new THREE.Vector3();
    function layout() {
      var w = v.w(), h = v.h(), narrow = w < 760;
      var halfH = 300 * Math.tan(Math.PI * 22 / 180), halfW = halfH * (w / h);
      if (narrow) {
        /* phones: the pair fills its own band at the top of the screen */
        var s2 = Math.min(halfW / (R * 2.6), halfH / (R * 1.9));
        venus.group.position.set(-R * 1.25 * s2, R * 0.1, 0); venus.group.scale.setScalar(s2);
        mars.group.position.set(R * 1.25 * s2, R * 0.1, 0); mars.group.scale.setScalar(s2);
        v.camera.position.set(0, 0, 300);
        v.camera.lookAt(0, 0, 0);
      } else {
        /* the cards own the left 55% of the screen; Venus starts just right of them */
        var shift = 0.15 * halfW + R * 1.2 + R * 1.05;
        venus.group.position.set(-R * 1.2 + shift, 0, 0); venus.group.scale.setScalar(1);
        mars.group.position.set(R * 1.2 + shift, 0, 0); mars.group.scale.setScalar(1);
        v.camera.position.set(0, 4, 300);
        v.camera.lookAt(0, 0, 0);
      }
    }

    function project(of, at) {
      of.updateMatrixWorld();
      tmp.copy(at).applyMatrix4(of.matrixWorld).project(v.camera);
      return [(tmp.x + 1) / 2 * v.w(), (1 - tmp.y) / 2 * v.h(), tmp.z < 1];
    }
    function place(call, w, kind, label) {
      var a = w.anchors[kind];
      if (!a) { call.el.classList.remove('is-on'); call.line.classList.remove('is-on'); call.dot.classList.remove('is-on'); return; }
      var p = project(a.of, a.at);
      var x = p[0], y = p[1];
      /* the callout floats above and to the outside of its planet */
      var lx = x + (w.isV ? -22 : 22) * (v.w() < 760 ? 1.8 : 1), ly = y - (v.w() < 760 ? 30 : 46);
      var edge = v.w() < 760 ? 78 : 132;
      lx = Math.max(edge, Math.min(v.w() - edge, lx));
      call.el.textContent = label;
      call.el.style.transform = 'translate(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px) translate(-50%, -100%)';
      call.line.setAttribute('x1', x); call.line.setAttribute('y1', y);
      call.line.setAttribute('x2', lx); call.line.setAttribute('y2', ly);
      call.dot.setAttribute('cx', x); call.dot.setAttribute('cy', y);
      var on = !!label;
      call.el.classList.toggle('is-on', on); call.line.classList.toggle('is-on', on); call.dot.classList.toggle('is-on', on);
    }

    function apply(w, kind, k) {
      var fx = w.fx;
      /* every effect eases toward 1 for the current kind and toward 0 otherwise */
      fx.cloud.material.opacity = 0.28 * (kind === 'cloud' ? k : 0);
      fx.thin.material.opacity = 0.22 * (kind === 'thin' ? k : 0);
      fx.orbit.material.opacity = 0.85 * (kind === 'orbit' ? k : 0);
      fx.pole.material.opacity = 0.55 * (kind === 'pole' ? k : 0);
      var gk = kind === 'ground' ? k : 0;
      fx.ground.scale.set(0.01 + R * 0.7 * gk, 0.01 + R * 0.7 * gk, 1);
      var sk = kind === 'sun' ? k : 0;
      fx.sun.scale.set(0.01 + R * 1.6 * sk, 0.01 + R * 1.6 * sk, 1);
      var lk = kind === 'lava' ? k : 0;
      fx.lava.visible = lk > 0.01;
      fx.lava.material.emissiveIntensity = 0.9 * lk;
      w.body.material.opacity = 1 - 0.75 * lk;
      var bk = kind === 'body' ? k : 0;
      var pulse = 1 + 0.05 * bk * (0.5 + 0.5 * Math.sin(performance.now() / 380));
      w.body.scale.set(pulse, pulse, pulse);
    }

    var current = null, t0 = 0, spinV = 0, spinM = 0, last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (!v.visible()) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (!REDUCED) { spinV -= dt * 0.08; spinM += dt * 0.22; }   /* Venus turns backward, slowly */
      venus.body.rotation.y = spinV; mars.body.rotation.y = spinM;
      var k = REDUCED ? 1 : Math.min(1, (now - t0) / 700);
      k = 1 - Math.pow(1 - k, 3);
      var kind = current ? current.call : null;
      apply(venus, kind ? kind.v[0] : null, k);
      apply(mars, kind ? kind.m[0] : null, k);
      sun.intensity = 1.3 + 0.9 * ((kind && (kind.v[0] === 'sun')) ? k : 0);
      v.render(scene);
      place(callV, venus, kind ? kind.v[0] : null, kind ? kind.v[1] : '');
      place(callM, mars, kind ? kind.m[0] : null, kind ? kind.m[1] : '');
      var nv = project(venus.group, new THREE.Vector3(0, -R * 1.12, 0)), nm = project(mars.group, new THREE.Vector3(0, -R * 1.12, 0));
      nameV.style.transform = 'translate(' + nv[0].toFixed(1) + 'px,' + nv[1].toFixed(1) + 'px) translate(-50%, 0)';
      nameM.style.transform = 'translate(' + nm[0].toFixed(1) + 'px,' + nm[1].toFixed(1) + 'px) translate(-50%, 0)';
    }
    v.onResize = layout;
    layout();
    requestAnimationFrame(loop);
    return {
      setStep: function (i, row) { current = row; t0 = performance.now(); }
    };
  }

  /* ============================================================
     HOW IT GETS MADE — cut, fold, inflate, fill
     ============================================================ */

  function build3d(canvas, hud) {
    var v = makeView(canvas, { fov: 40, near: 0.5, far: 6000, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 500, 3000, 2207));
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x1A1420, 0.55));
    var key = new THREE.DirectionalLight(0xFFF3D6, 1.1); key.position.set(0.6, 1, 0.8); scene.add(key);
    var fill = new THREE.DirectionalLight(0x5FD0C4, 0.3); fill.position.set(-1, -0.4, -0.5); scene.add(fill);

    /* ---- the 69 gores: each one morphs from its flat cut shape onto the hull ---- */
    var A = 64.5, B = 17.0, N = 69, NU = 22, GAP = 0.965;
    /* meridian arc length, so the flat panels have the right length */
    var arc = [0];
    for (var i = 1; i <= 200; i++) {
      var u0 = Math.PI * (i - 1) / 200, u1 = Math.PI * i / 200;
      var dx = A * (Math.cos(u1) - Math.cos(u0)), dy = B * (Math.sin(u1) - Math.sin(u0));
      arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    var L = arc[200];
    function sOf(u) { var f = u / Math.PI * 200, i = Math.floor(f); return i >= 200 ? L : lerp(arc[i], arc[i + 1], f - i); }
    var gores = [], goreGroup = new THREE.Group();
    var goreMat = new THREE.MeshStandardMaterial({ color: 0xE6DCC4, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    var flatW = 2 * Math.PI * B / N;                      /* one panel's width at the equator */
    for (var g = 0; g < N; g++) {
      var flat = [], hull = [];
      var v0 = 2 * Math.PI * g / N, dv = 2 * Math.PI / N * GAP;
      var lx = (g - (N - 1) / 2) * flatW * 1.06;            /* laid side by side on the floor */
      for (var iu = 0; iu <= NU; iu++) {
        var u = Math.PI * iu / NU;
        var w = B * Math.sin(u) * dv;                      /* panel width at this station */
        for (var side = 0; side < 2; side++) {
          var vv = v0 + dv * side;
          hull.push(A * Math.cos(u), B * Math.sin(u) * Math.cos(vv), B * Math.sin(u) * Math.sin(vv));
          flat.push(sOf(u) - L / 2, -40, lx + (side ? w / 2 : -w / 2));
        }
      }
      var idx = [];
      for (var q = 0; q < NU; q++) { var k0 = q * 2; idx.push(k0, k0 + 1, k0 + 2, k0 + 1, k0 + 3, k0 + 2); }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(hull.length), 3));
      geo.setIndex(idx);
      var mesh = new THREE.Mesh(geo, goreMat);
      goreGroup.add(mesh);
      gores.push({ mesh: mesh, flat: new Float32Array(flat), hull: new Float32Array(hull), k: -1 });
    }
    scene.add(goreGroup);
    function setGores(kAll, stagger) {
      /* stagger: panels wrap one after another around the hull */
      for (var g = 0; g < N; g++) {
        var start = stagger * g / N, k = ease(seg(kAll, start, start + (1 - stagger)));
        var G = gores[g];
        if (Math.abs(k - G.k) < 0.002) continue;
        G.k = k;
        var pos = G.mesh.geometry.attributes.position.array;
        for (var i = 0; i < pos.length; i++) pos[i] = G.flat[i] + (G.hull[i] - G.flat[i]) * k;
        G.mesh.geometry.attributes.position.needsUpdate = true;
        G.mesh.geometry.computeVertexNormals();
      }
    }
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 150), new THREE.MeshBasicMaterial({ color: 0x5FD0C4, transparent: true, opacity: 0.05, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -40.2;
    scene.add(floor);

    /* ---- the finished ship, its shell, and the air that fills it ---- */
    var ship = model(THREE, 'phosphorus_airship', function (n) { return n !== 'person'; });
    var shipG = new THREE.Group(); shipG.add(ship); scene.add(shipG);
    var air = null, helium = [], envelope = null;
    ship.traverse(function (o) {
      if (!o.isMesh) return;
      if (o.userData.material === 'air') air = o;
      if (o.userData.material === 'helium') helium.push(o);
      if (o.name === 'envelope') envelope = o;
    });
    if (envelope) { envelope.material.transparent = true; }
    var shell = model(THREE, 'entry_vehicle', function (n) { return n === 'heatshield' || n === 'backshell'; });
    var shellG = new THREE.Group(); shellG.add(shell); shellG.rotation.z = -Math.PI / 2; scene.add(shellG);
    var packed = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.3, 6.2, 28), new THREE.MeshStandardMaterial({ color: 0xE6DCC4, roughness: 0.8 }));
    packed.rotation.z = -Math.PI / 2; scene.add(packed);
    var person = model(THREE, 'phosphorus_airship', function (n) { return n === 'person'; });
    scene.add(person);

    var lookAt = new THREE.Vector3(0, -4, 0), last = -1;
    function cam(radius, theta, phi, ty) {
      lookAt.y = ty;
      v.camera.position.set(lookAt.x + radius * Math.sin(phi) * Math.cos(theta), lookAt.y + radius * Math.cos(phi), lookAt.z + radius * Math.sin(phi) * Math.sin(theta));
      v.camera.lookAt(lookAt);
    }
    function setHud(step, key, val, unit) {
      if (!hud.step) return;
      hud.step.textContent = step; hud.key.textContent = key; hud.val.textContent = val; hud.unit.textContent = unit;
    }

    function frame(p) {
      var cut = seg(p, 0, 0.25), fold = seg(p, 0.25, 0.5), inflate = seg(p, 0.5, 0.75), fillT = seg(p, 0.75, 1);
      /* CUT: panels lie flat, then wrap one by one; the model takes over at the end */
      goreGroup.visible = cut < 1 || fold < 0.02;
      if (goreGroup.visible) setGores(cut, 0.6);
      goreMat.opacity = 1 - seg(fold, 0, 0.05);
      floor.material.opacity = 0.05 * (1 - cut);
      var modelIn = cut >= 1;
      shipG.visible = modelIn;
      /* FOLD: the hull deflates to a flat sheet, then rolls into its 2.5 m³ bundle inside
         the shell. INFLATE unrolls and swells at the same time. */
      var f, r;
      if (inflate > 0) { var k = ease(inflate); f = 1 - k; r = 1 - k; }
      else { f = ease(seg(fold, 0.05, 0.5)); r = ease(seg(fold, 0.5, 1)); }
      shipG.scale.set(lerp(1, 0.05, r), lerp(1, 0.04, f), lerp(1, 0.55, f) * lerp(1, 0.08, r));
      /* see inside once the helium starts flowing */
      if (envelope) { envelope.material.opacity = inflate > 0 ? 0.42 : 1; envelope.material.depthWrite = inflate <= 0; }
      packed.visible = modelIn && r > 0.6;
      packed.scale.setScalar(seg(r, 0.6, 1));
      shellG.visible = modelIn && r > 0.7;
      fade(shell, seg(r, 0.7, 1));
      shellG.position.set(-7 * seg(inflate, 0, 0.3), 0, 0);
      /* FILL: breathable air rises in the lower hull over eight years */
      if (air) {
        air.visible = modelIn && fillT > 0;
        var fk = ease(fillT);
        /* rise from the floor of the hull: scale about the ellipsoid's bottom */
        var bottom = -B * 0.42 - B * 0.50;
        air.scale.set(1, Math.max(0.02, fk), 1);
        air.position.y = bottom * (1 - Math.max(0.02, fk));
        air.material.opacity = 0.42;
      }
      helium.forEach(function (h) { h.material.opacity = 0.55 * (inflate > 0 ? seg(inflate, 0.35, 1) : (fold > 0 ? 0 : 0.55)); h.visible = h.material.opacity > 0.02; });
      person.visible = modelIn && r < 0.6;

      /* camera: floor-level for the cut, pulling in for the bundle, out again for the ship */
      var theta = 0.55 + p * 1.1, phi = lerp(1.05, 1.25, cut);
      var radius = cut < 1 ? lerp(300, 235, cut) : lerp(235, 34, r);
      if (fillT > 0) radius = 235 + 25 * fillT;
      cam(radius, theta, fold > 0 && inflate <= 0 ? lerp(1.25, 0.9, f) : phi, cut < 1 ? -8 : -4);

      if (cut < 1) {
        var welded = Math.round(N * clamp((cut - 0.02) / 0.9, 0, 1));
        setHud('Cut', 'Seam welded', (9.4 * welded / N).toFixed(1), ' km · ' + welded + ' / 69 panels');
      } else if (fold < 1 || (inflate <= 0)) {
        var vol = Math.round(lerp(77500, 2.5, ease(fold)));
        setHud('Fold', 'Volume', vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : String(vol), ' m³ · ' + (fold > 0.98 ? '30,700 : 1' : 'packing'));
      } else if (inflate < 1) {
        var he = (6.8 * ease(inflate)).toFixed(1), km = (72 - 20 * inflate).toFixed(0);
        setHud('Inflate', 'Helium in', he, ' t · ' + km + ' km');
      } else {
        var t = (33.6 * ease(fillT)).toFixed(1), day = Math.round(2912 * fillT);
        setHud('Fill', 'Breathable air', t, ' t · day ' + day.toLocaleString());
      }
      v.render(scene);
    }
    frame(0);
    v.onResize = function () { frame(last < 0 ? 0 : last); };
    v.onVisible = function () { if (last >= 0) frame(last); };
    return {
      update: function (p) {
        if (!v.visible() && last >= 0) return;
        if (Math.abs(p - last) < 0.0008) return;
        last = p; frame(p);
      }
    };
  }

  /* ============================================================
     WALKING ON SUNSHINE — out of the airlock and over the hull
     ============================================================ */

  /* a rAF loop that only does work while the view is on screen */
  function ticker(v, fn) {
    var last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (!v.visible()) { last = now; return; }
      var raw = last ? (now - last) / 1000 : 0;
      last = now;
      fn(Math.min(0.05, raw), Math.min(1, raw));
    }
    requestAnimationFrame(loop);
  }

  /* a 1.8 m figure in a yellow coverall with an air pack; feet at the origin, facing +z */
  function figure(THREE) {
    var g = new THREE.Group();
    var suit = new THREE.MeshStandardMaterial({ color: 0xE8B33A, roughness: 0.75 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x2A2430, roughness: 0.6 });
    var visor = new THREE.MeshStandardMaterial({ color: 0x5FD0C4, roughness: 0.2, metalness: 0.3, emissive: 0x1E5A55 });
    function limb(r, len, x, y, mat) {
      var geo = new THREE.CylinderGeometry(r, r * 0.9, len, 8); geo.translate(0, -len / 2, 0);
      var m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); return m;
    }
    var legs = [limb(0.09, 0.85, -0.12, 0.85, suit), limb(0.09, 0.85, 0.12, 0.85, suit)];
    var arms = [limb(0.06, 0.6, -0.3, 1.45, suit), limb(0.06, 0.6, 0.3, 1.45, suit)];
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.65, 10), suit); torso.position.y = 1.175;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), suit); head.position.y = 1.66;
    var face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), visor); face.position.set(0, 1.68, 0.12);
    var pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.18), dark); pack.position.set(0, 1.2, -0.26);
    [legs[0], legs[1], arms[0], arms[1], torso, head, face, pack].forEach(function (m) { g.add(m); });
    g.userData.legs = legs; g.userData.arms = arms;
    return g;
  }

  function walk3d(canvas, hud) {
    var v = makeView(canvas, { fov: 50, near: 0.2, far: 1500, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    var DAY = new THREE.Color(0xE6D5A6), DUSK = new THREE.Color(0x3A2F3C);
    scene.background = DAY.clone();
    scene.fog = new THREE.Fog(DAY.clone(), 40, 380);
    var hemi = new THREE.HemisphereLight(0xFFF6DC, 0xC9A968, 1.05); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xFFF3D6, 0.55); sun.position.set(0.3, 1, 0.4); scene.add(sun);

    /* the ship, with a deck of plant on the gondola roof and a hatch forward */
    var A = 64.5, B = 17.0, GY = -B - 5.5, ROOF = GY + 3.25;
    var shipG = new THREE.Group(); scene.add(shipG);
    var ship = model(THREE, 'phosphorus_airship', function (n) {
      return ['helium_cells', 'breathable_air_volume', 'ballonets', 'person'].indexOf(n) < 0;
    });
    shipG.add(ship);
    var steel = new THREE.MeshStandardMaterial({ color: 0x6E6A78, roughness: 0.6, metalness: 0.4 });
    var hatch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 2.2), steel); hatch.position.set(0, ROOF + 0.35, 0); shipG.add(hatch);
    var rail = new THREE.Mesh(new THREE.BoxGeometry(26, 0.06, 0.06), steel); rail.position.set(0, ROOF + 1.05, 3.2); shipG.add(rail);
    for (var rx = -12; rx <= 12; rx += 4) { var post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), steel); post.position.set(rx, ROOF + 0.52, 3.2); shipG.add(post); }
    var PLANTS = [
      { x: -10,  color: 0x5FD0C4, tall: 1.7 },  /* oxygen: the electrolysis stack */
      { x: -6.5, color: 0x5FB0E0, tall: 1.4 },  /* water: the droplet catcher */
      { x: 3.5,  color: 0xE8DCC0, tall: 1.2 },  /* nitrogen */
      { x: 7,    color: 0xE8B33A, tall: 1.5 }   /* lift gas, piped up to the hull */
    ];
    var plants = PLANTS.map(function (P) {
      var box = new THREE.Mesh(new THREE.BoxGeometry(2.4, P.tall, 2.0), new THREE.MeshStandardMaterial({ color: 0x8A8496, roughness: 0.55, metalness: 0.35 }));
      box.position.set(P.x, ROOF + P.tall / 2, -1.6); shipG.add(box);
      var intake = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.9), new THREE.MeshStandardMaterial({ color: 0x2A2430 }));
      intake.position.set(P.x, ROOF + P.tall + 0.12, -1.6); shipG.add(intake);
      var mark = glow(THREE, P.color, 3); mark.position.set(P.x, ROOF + P.tall + 0.9, -1.6); mark.material.opacity = 0; shipG.add(mark);
      return { mark: mark };
    });
    var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.3, 8), steel); pipe.position.set(7, ROOF + 1.5 + 1.1, -1.6); shipG.add(pipe);
    /* propellers at each end: a two-blade disc spun about the long axis */
    var props = [-1, 1].map(function (sx) {
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.25, 10.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x2A2430, roughness: 0.5 }));
      blade.position.set(sx * (A + 3.2), 0, 0); shipG.add(blade); return blade;
    });
    /* a seam line down the crown for the walk on top */
    var seam = new THREE.Mesh(new THREE.BoxGeometry(A * 1.2, 0.05, 0.12), new THREE.MeshStandardMaterial({ color: 0x2A2430 }));
    seam.position.set(0, B * 1.006 + 0.03, 0); shipG.add(seam);

    var person = figure(THREE); shipG.add(person);

    /* cloud puffs drifting past, and wind streaks over the hull */
    if (!glowTex) glowTex = glowTexture(THREE);
    var puffs = [];
    var pseed = 4409; function prnd() { pseed = (pseed * 1103515245 + 12345) & 0x7fffffff; return pseed / 0x7fffffff; }
    for (var i = 0; i < 70; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF6ECD2, transparent: true, opacity: 0.25 + prnd() * 0.3, depthWrite: false }));
      var sz = 30 + prnd() * 60;
      sp.scale.set(sz, sz * 0.6, 1);
      sp.position.set(prnd() * 520 - 260, prnd() * 220 - 120, prnd() * 520 - 260);
      sp.userData.v = 4 + prnd() * 6;
      scene.add(sp); puffs.push(sp);
    }
    var streakPts = [], streakN = 40;
    for (var k = 0; k < streakN; k++) { var sx0 = prnd() * 160 - 80, sy0 = 10 + prnd() * 18, sz0 = prnd() * 60 - 30; streakPts.push(sx0, sy0, sz0, sx0 - 3, sy0, sz0); }
    var streakGeo = new THREE.BufferGeometry(); streakGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(streakPts), 3));
    var streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 })); shipG.add(streaks);

    /* where the crew member stands for each card, and the route between spots */
    function ring(th) { var r = B * Math.sqrt(1 - (7 / A) * (7 / A)); return [7, r * Math.sin(th), r * Math.cos(th), Math.PI / 2 - th]; }
    var climb = [[2.6, ROOF, 0, 0], ring(-1.22), ring(-0.52), ring(0.35), ring(1.05), ring(Math.PI / 2)];
    var TOP = B * Math.sqrt(1 - (12 / A) * (12 / A)) * 1.006;
    var SPOTS = [
      { pos: [0, ROOF + 0.7, 0], face: 0 },
      { pos: [-2, ROOF, 2.0], face: 0 },
      { pos: [-2, ROOF, 2.7], face: 0 },
      { pos: [-2, ROOF, 2.7], face: 0 },
      { pos: [-10, ROOF, 0.9], face: Math.PI },
      { pos: [-6.5, ROOF, 0.9], face: Math.PI },
      { pos: [3.5, ROOF, 0.9], face: Math.PI },
      { pos: [7, ROOF, 0.9], face: Math.PI },
      { pos: [7, B * 0.985, 0], face: -Math.PI / 2, via: climb, window: 0.5 },
      { pos: [-12, TOP, 0], face: -Math.PI / 2 },
      { pos: [0, ROOF + 0.7, 0], face: 0, via: climb.slice().reverse(), window: 0.6 },
      { pos: [0, ROOF - 1.6, 0], face: 0, hide: true }
    ];
    /* camera shots: offset from the figure and where to look, in the figure's frame (+z is ahead) */
    var SHOTS = [
      { off: [3.2, 1.9, 4.6], look: [0, 1.2, 0] },
      { off: [-4.2, 2.2, 6.0], look: [0, 1.0, 0] },
      { off: [-1.6, 1.9, -3.0], look: [0.6, 1.4, 14] },
      { off: [-2.0, 1.3, -2.6], look: [0, 10, 22] },
      { off: [-3.6, 2.6, 6.2], look: [0.4, 0.7, -1.2] },
      { off: [-3.6, 2.6, 6.2], look: [0.4, 0.7, -1.2] },
      { off: [-3.6, 2.6, 6.2], look: [0.4, 0.7, -1.2] },
      { off: [-3.6, 2.6, 6.2], look: [0.4, 0.7, -1.2] },
      { off: [-14, 4, 16], look: [0, 1.6, 0] },
      { off: [-9, 3.6, 10], look: [3, 0.9, 0] },
      { off: [4.2, 2.4, 5.2], look: [0, 0.9, 0] },
      { abs: [-70, -26, 150], look: [0, -6, 0] }
    ];
    var N = SPOTS.length;
    var tmpA = new THREE.Vector3();
    function pathAt(i, k) {
      /* position + tilt along the route from spot i to spot i+1, k in [0,1] */
      var from = SPOTS[i], to = SPOTS[i + 1];
      var pts = [[from.pos[0], from.pos[1], from.pos[2], 0]].concat(to.via || []).concat([[to.pos[0], to.pos[1], to.pos[2], 0]]);
      var lens = [0];
      for (var q = 1; q < pts.length; q++) { var dx = pts[q][0] - pts[q - 1][0], dy = pts[q][1] - pts[q - 1][1], dz = pts[q][2] - pts[q - 1][2]; lens.push(lens[q - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz)); }
      var d = k * lens[lens.length - 1], q2 = 1;
      while (q2 < lens.length - 1 && lens[q2] < d) q2++;
      var f = (lens[q2] - lens[q2 - 1]) > 0 ? (d - lens[q2 - 1]) / (lens[q2] - lens[q2 - 1]) : 1;
      var P = pts[q2 - 1], Q = pts[q2];
      return { x: lerp(P[0], Q[0], f), y: lerp(P[1], Q[1], f), z: lerp(P[2], Q[2], f), tilt: lerp(P[3], Q[3], f),
               face: Math.atan2(Q[0] - P[0], Q[2] - P[2]) };
    }
    var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    var o0 = { p: new THREE.Vector3(), l: new THREE.Vector3() }, o1 = { p: new THREE.Vector3(), l: new THREE.Vector3() };
    var progress = 0, moving = 0, t = 0, night = 0, camInit = false, stageEl = canvas.closest('.stage');

    function setHud(step, out, time) {
      if (!hud.step) return;
      hud.step.textContent = step; hud.out.textContent = out; hud.time.textContent = time;
    }

    function place(p) {
      var i = Math.min(N - 1, Math.floor(p * N)), local = p * N - i;
      var spot = SPOTS[i], next = SPOTS[i + 1];
      var w = next ? (1 - (next.window || 0.35)) : 1;
      var k = next ? seg(local, w, 1) : 0;
      var pos, tilt, face;
      if (k > 0 && k < 1) {
        var r = pathAt(i, ease(k));
        pos = [r.x, r.y, r.z]; tilt = r.tilt; face = r.face;
        moving = 1;
      } else {
        var sp = k >= 1 ? next : spot;
        pos = sp.pos; tilt = 0; face = sp.face; moving = 0;
      }
      person.position.set(pos[0], pos[1], pos[2]);
      person.rotation.set(tilt, face, 0, 'YXZ');
      person.visible = !(k >= 1 ? next : spot).hide;
      plants.forEach(function (pl, j) { pl.mark.material.opacity = (i === 4 + j && k < 1) ? 0.8 : 0; });
      /* the wind you feel up top */
      streaks.material.opacity = 0.35 * (i === 8 ? seg(local, 0.1, 0.4) : i === 9 ? 1 - seg(local, 0.6, 1) : 0);
      night = i === N - 1 ? ease(seg(local, 0, 0.8)) : 0;
      if (stageEl) stageEl.classList.toggle('is-night', night > 0.5);
      /* camera */
      var s0 = SHOTS[i], s1 = SHOTS[Math.min(N - 1, i + 1)], m = ease(k);
      function shot(S, out) {
        if (S.abs) { out.p.set(S.abs[0], S.abs[1], S.abs[2]); out.l.set(S.look[0], S.look[1], S.look[2]); return; }
        var cs = Math.cos(face), sn = Math.sin(face);
        out.p.set(pos[0] + S.off[0] * cs + S.off[2] * sn, pos[1] + S.off[1], pos[2] - S.off[0] * sn + S.off[2] * cs);
        out.l.set(pos[0] + S.look[0] * cs + S.look[2] * sn, pos[1] + S.look[1], pos[2] - S.look[0] * sn + S.look[2] * cs);
      }
      shot(s0, o0); shot(s1, o1);
      wantPos.copy(o0.p).lerp(o1.p, m); wantLook.copy(o0.l).lerp(o1.l, m);
      /* the HUD */
      var mins = Math.round(150 * seg(p, 1 / N, 10.6 / N));
      var out = (i === N - 1 && night > 0.5) ? '27 °C · 55 km · night' : '60 °C · 1 atm';
      setHud(PHOS.WALK ? PHOS.WALK[i].step : '', out, i === 0 ? '0:00' : Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0'));
    }

    function frame(dt, rdt) {
      t += dt;
      var swing = moving ? Math.sin(t * 9) * 0.55 : 0;
      person.userData.legs[0].rotation.x = swing; person.userData.legs[1].rotation.x = -swing;
      person.userData.arms[0].rotation.x = -swing * 0.7; person.userData.arms[1].rotation.x = swing * 0.7;
      /* the ship rides the air: a slow heave, bigger while the weather card is up */
      var i = Math.min(N - 1, Math.floor(progress * N));
      var heave = i === 9 ? 1.6 : 0.35;
      shipG.position.y = Math.sin(t * 0.6) * heave;
      shipG.rotation.z = Math.sin(t * 0.45) * 0.004 * heave;
      var spin = 1 - night;
      props.forEach(function (b) { b.rotation.x += dt * 14 * spin; });
      puffs.forEach(function (sp) { sp.position.x -= sp.userData.v * dt; if (sp.position.x < -280) sp.position.x += 560; });
      var arr = streaks.geometry.attributes.position.array;
      for (var q = 0; q < arr.length; q += 6) { arr[q] -= dt * 28; arr[q + 3] -= dt * 28; if (arr[q] < -85) { arr[q] += 170; arr[q + 3] += 170; } }
      streaks.geometry.attributes.position.needsUpdate = true;
      /* sky: bright overcast by day, the void at dusk */
      scene.background.copy(DAY).lerp(DUSK, night); scene.fog.color.copy(scene.background);
      hemi.intensity = 1.05 - 0.75 * night; sun.intensity = 0.55 - 0.45 * night;
      /* camera eases toward the shot */
      var a = camInit ? 1 - Math.exp(-(rdt || dt) * 7) : 1; camInit = true;
      camPos.lerp(wantPos, a); camLook.lerp(wantLook, a);
      v.camera.position.copy(camPos).add(shipG.position);
      v.camera.lookAt(tmpA.copy(camLook).add(shipG.position));
      v.render(scene);
    }
    place(0);
    ticker(v, frame);
    return {
      update: function (p) { if (Math.abs(p - progress) < 0.0005) return; progress = p; place(p); }
    };
  }

  /* ============================================================
     WHAT WE'D LEARN — one animated icon per question
     ============================================================ */

  function learn3d(canvas) {
    var v = makeView(canvas, { fov: 40, near: 0.5, far: 400, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 400, 300, 5151));
    lights(THREE, scene, [0.8, 1, 0.9], 1.2);
    var fill = new THREE.DirectionalLight(0x5FD0C4, 0.35); fill.position.set(-1, -0.5, -0.4); scene.add(fill);
    if (!glowTex) glowTex = glowTexture(THREE);
    var R = 10, root = new THREE.Group(); scene.add(root);
    var icons = [];
    var seed = 977; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function add(g, tick) { g.visible = false; g.scale.setScalar(0.001); root.add(g); icons.push({ g: g, tick: tick, s: 0 }); }
    function std(color, extra) { var o = { color: color, roughness: 0.6, metalness: 0.05 }; for (var k in (extra || {})) o[k] = extra[k]; return new THREE.MeshStandardMaterial(o); }
    function line(pts, color, opacity) {
      var g = new THREE.BufferGeometry().setFromPoints(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
    }

    /* 01 life: a cloud droplet with something moving inside, under the reticle */
    (function () {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(6.5, 48, 32), std(0xE8B33A, { transparent: true, opacity: 0.3, roughness: 0.15, depthWrite: false })));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(6.6, 48, 32), new THREE.MeshBasicMaterial({ color: 0xF6ECD2, transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
      var cells = new THREE.Group(); g.add(cells);
      var cm = std(0x5FD0C4, { emissive: 0x1E5A55, roughness: 0.4 });
      for (var i = 0; i < 34; i++) {
        var c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), cm);
        c.scale.set(1, 1, 2.2);
        var u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 5 * Math.cbrt(rnd()), q = Math.sqrt(1 - u * u);
        c.position.set(r * q * Math.cos(th), r * u, r * q * Math.sin(th));
        c.rotation.set(rnd() * 3, rnd() * 3, 0);
        c.userData.w = 0.4 + rnd();
        cells.add(c);
      }
      var ret = new THREE.Group(); g.add(ret);
      ret.add(new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.07, 8, 96), new THREE.MeshBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0.55 })));
      ret.add(line([[-9.4, 0, 0], [-7.2, 0, 0], [7.2, 0, 0], [9.4, 0, 0], [0, -9.4, 0], [0, -7.2, 0], [0, 7.2, 0], [0, 9.4, 0]], 0xF2E8D0, 0.55));
      add(g, function (dt, t) {
        cells.rotation.y += dt * 0.18;
        cells.children.forEach(function (c) { c.rotation.z += dt * c.userData.w * 0.6; });
        ret.rotation.z = Math.sin(t * 0.3) * 0.08;
      });
    })();

    /* 02 chemistry: sunlight going into the upper cloud and half not coming out */
    (function () {
      var g = new THREE.Group();
      var sun = glow(THREE, 0xE8B33A, 9); sun.position.set(-7, 9.5, 0); g.add(sun);
      var slab = new THREE.Group(); g.add(slab);
      slab.add(new THREE.Mesh(new THREE.BoxGeometry(17, 3.2, 9), std(0xE8B33A, { transparent: true, opacity: 0.12, depthWrite: false })));
      var grit = std(0x2A2430, { roughness: 0.9 });
      for (var i = 0; i < 90; i++) {
        var m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.22 + rnd() * 0.3), grit);
        m.position.set(rnd() * 16 - 8, rnd() * 2.8 - 1.4, rnd() * 8 - 4);
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        m.userData.w = (rnd() - 0.5) * 2;
        slab.add(m);
      }
      var inPts = [], outPts = [];
      for (var k = 0; k < 7; k++) {
        var x = -6 + k * 2.2;
        inPts.push([-7, 9.5, 0], [x, 1.6, 0]);
        if (k % 2 === 0) outPts.push([x, -1.6, 0], [x + 1.8, -8.5, 0]);
      }
      var rays = line(inPts, 0xF6ECD2, 0.7), through = line(outPts, 0xF6ECD2, 0.3);
      g.add(rays); g.add(through);
      add(g, function (dt, t) {
        slab.rotation.y = Math.sin(t * 0.25) * 0.35;
        slab.children.forEach(function (m, i) { if (i) m.rotation.x += dt * m.userData.w; });
        rays.material.opacity = 0.55 + 0.25 * Math.sin(t * 2.2);
        through.material.opacity = 0.18 + 0.12 * Math.sin(t * 2.2 + 1);
      });
    })();

    /* 03 weather: the planet turns once while the sky laps it sixty times */
    (function () {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.SphereGeometry(6.2, 64, 40), std(0xC08F43, { map: venusTexture(THREE), roughness: 0.9 }));
      var sky = new THREE.Mesh(new THREE.SphereGeometry(6.5, 64, 40), new THREE.MeshStandardMaterial({ map: cloudTexture(THREE), color: 0xF2E8D0, transparent: true, opacity: 0.75, roughness: 1, depthWrite: false }));
      g.add(body); g.add(sky);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.05, 6, 120), new THREE.MeshBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0.35 }));
      ring.rotation.x = Math.PI / 2; g.add(ring);
      var fast = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), std(0x5FD0C4, { emissive: 0x2A7A72 }));
      var slow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), std(0xFF7A45, { emissive: 0x7A2E12 }));
      g.add(fast); g.add(slow);
      g.rotation.z = 0.15;
      add(g, function (dt, t) {
        body.rotation.y -= dt * 0.012; sky.rotation.y -= dt * 0.72;
        fast.position.set(8.6 * Math.cos(-t * 0.72), 0, 8.6 * Math.sin(-t * 0.72));
        slow.position.set(8.6 * Math.cos(-t * 0.012), 0, 8.6 * Math.sin(-t * 0.012));
      });
    })();

    /* 04 climate: an ocean that left */
    (function () {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(6.2, 64, 40), std(0xC08F43, { map: venusTexture(THREE), roughness: 0.9 })));
      var ocean = new THREE.Mesh(new THREE.SphereGeometry(6.3, 64, 40), std(0x2A6FB0, { transparent: true, opacity: 0.85, roughness: 0.3, depthWrite: false }));
      g.add(ocean);
      var mols = [];
      for (var i = 0; i < 48; i++) {
        var m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5FD0C4, transparent: true, opacity: 0.9 }));
        var u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
        m.userData.dir = new THREE.Vector3(q * Math.cos(th), u, q * Math.sin(th));
        m.userData.ph = rnd() * 6;
        g.add(m); mols.push(m);
      }
      add(g, function (dt, t) {
        g.rotation.y += dt * 0.08;
        var cyc = (t * 0.06) % 1;                        /* the ocean goes over ~17 s, then comes back */
        var left = cyc < 0.7 ? cyc / 0.7 : 1 - (cyc - 0.7) / 0.3;
        ocean.material.opacity = 0.85 * (1 - left);
        ocean.scale.setScalar(1 - 0.02 * left);
        mols.forEach(function (m) {
          var d = ((t * 1.4 + m.userData.ph) % 6);
          m.position.copy(m.userData.dir).multiplyScalar(6.4 + d);
          m.material.opacity = (cyc < 0.7 ? 0.9 : 0) * (1 - d / 6);
        });
      });
    })();

    /* 05 geology: a volcano that may be erupting right now, and the radar that would see it */
    (function () {
      var g = new THREE.Group();
      var cone = new THREE.Mesh(new THREE.ConeGeometry(8.5, 6.5, 40), std(0x3B2A2A, { roughness: 0.95 })); cone.position.y = -3.2; g.add(cone);
      var vent = glow(THREE, 0xFF7A45, 4); vent.position.set(0, 0.2, 0); g.add(vent);
      var plume = [];
      for (var i = 0; i < 70; i++) {
        var pm = new THREE.Mesh(new THREE.SphereGeometry(0.25 + rnd() * 0.35, 8, 6), new THREE.MeshBasicMaterial({ color: rnd() < 0.3 ? 0xFF7A45 : 0x8A7A70, transparent: true, opacity: 0.8 }));
        pm.userData.ph = rnd() * 8; pm.userData.ang = rnd() * Math.PI * 2; pm.userData.spread = 0.6 + rnd() * 2.4;
        g.add(pm); plume.push(pm);
      }
      var orbit = new THREE.Mesh(new THREE.TorusGeometry(9.5, 0.04, 6, 100), new THREE.MeshBasicMaterial({ color: 0x5FD0C4, transparent: true, opacity: 0.35 }));
      orbit.rotation.x = Math.PI / 2; orbit.position.y = 8.5; g.add(orbit);
      var sat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.3), std(0x5FD0C4, { emissive: 0x2A7A72 })); g.add(sat);
      var beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x5FD0C4, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      g.add(beam);
      add(g, function (dt, t) {
        plume.forEach(function (pm) {
          var y = (t * 2.2 + pm.userData.ph) % 8;
          var r = pm.userData.spread * (y / 8) + 0.2;
          pm.position.set(r * Math.cos(pm.userData.ang + y * 0.3), y, r * Math.sin(pm.userData.ang + y * 0.3));
          pm.material.opacity = 0.85 * (1 - y / 8);
        });
        vent.scale.setScalar(4 + Math.sin(t * 7) * 0.6);
        var a = t * 0.5;
        sat.position.set(9.5 * Math.cos(a), 8.5, 9.5 * Math.sin(a));
        beam.position.set(9.5 * Math.cos(a) * 0.5, 4.25, 9.5 * Math.sin(a) * 0.5);
        beam.lookAt(0, 0, 0); beam.rotateX(Math.PI / 2);
      });
    })();

    /* 06 living there: the loop, with someone standing in it */
    (function () {
      var g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.28, 12, 100), std(0xE6DCC4)));
      var COLORS = [0x5FD0C4, 0x5FB0E0, 0xE8DCC0, 0xE8B33A];
      COLORS.forEach(function (c, i) {
        var n = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), std(c, { emissive: c, emissiveIntensity: 0.25 }));
        var a = i * Math.PI / 2; n.position.set(7.4 * Math.cos(a), 7.4 * Math.sin(a), 0); g.add(n);
      });
      var dots = [];
      for (var i = 0; i < 28; i++) {
        var d = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), std(COLORS[i % 4], { emissive: COLORS[i % 4], emissiveIntensity: 0.5 }));
        d.userData.ph = i / 28 * Math.PI * 2; g.add(d); dots.push(d);
      }
      var who = figure(THREE); who.scale.setScalar(2.6); who.position.y = -2.4; g.add(who);
      add(g, function (dt, t) {
        dots.forEach(function (d) { var a = t * 0.55 + d.userData.ph; d.position.set(7.4 * Math.cos(a), 7.4 * Math.sin(a), 0.5 * Math.sin(a * 3)); });
        who.rotation.y = Math.sin(t * 0.4) * 0.5;
      });
    })();

    var active = 0, t = 0;
    function layout() {
      var w = v.w(), h = v.h(), narrow = w < 760;
      var halfH = 42 * Math.tan(Math.PI * 20 / 180), halfW = halfH * (w / h);
      if (narrow) {
        var s2 = Math.min(1, halfW / (R * 1.25), halfH / (R * 1.25));
        root.position.set(0, 0, 0); root.scale.setScalar(s2);
      } else {
        root.position.set(0.15 * halfW + R * 1.05, 0, 0); root.scale.setScalar(1);
      }
      v.camera.position.set(0, 0, 42); v.camera.lookAt(0, 0, 0);
    }
    layout();
    v.onResize = layout;
    ticker(v, function (dt) {
      t += dt;
      icons.forEach(function (ic, i) {
        var want = i === active ? 1 : 0;
        ic.s += (want - ic.s) * (1 - Math.exp(-dt * 6));
        var s = Math.max(0.001, ease(clamp(ic.s, 0, 1)));
        ic.g.visible = ic.s > 0.01;
        ic.g.scale.setScalar(s);
        ic.g.rotation.y = (1 - s) * 1.4;
        if (ic.g.visible) ic.tick(dt, t);
      });
      v.render(scene);
    });
    return {
      update: function (p) { active = Math.min(icons.length - 1, Math.floor(p * icons.length)); }
    };
  }

  /* ============================================================
     WHERE THE SAMPLES COME FROM — packages up, bins down
     ============================================================ */

  function samples3d(canvas, hud) {
    var v = makeView(canvas, { fov: 45, near: 0.3, far: 3000, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    var U = 100;                                   /* scene units per km: 1 unit = 10 m */
    scene.background = new THREE.Color(0xE6D5A6);
    scene.fog = new THREE.Fog(0xE6D5A6, 8, 80);
    var hemi = new THREE.HemisphereLight(0xFFF6DC, 0xC9A968, 1.0); scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xFFF3D6, 0.6); sun.position.set(0.3, 1, 0.5); scene.add(sun);
    if (!glowTex) glowTex = glowTexture(THREE);
    var seed = 31337; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function std(color, extra) { var o = { color: color, roughness: 0.6, metalness: 0.1 }; for (var k in (extra || {})) o[k] = extra[k]; return new THREE.MeshStandardMaterial(o); }

    /* the ship at a tenth scale, and the deck of cloud it lives in */
    var ship = model(THREE, 'phosphorus_airship', function (n) { return ['helium_cells', 'breathable_air_volume', 'ballonets', 'person'].indexOf(n) < 0; });
    var shipG = new THREE.Group(); shipG.add(ship); shipG.scale.setScalar(0.1); shipG.rotation.y = 0.5; scene.add(shipG);
    var puffs = [];
    for (var i = 0; i < 240; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF6ECD2, transparent: true, opacity: 0.2 + rnd() * 0.3, depthWrite: false }));
      var sz = 14 + rnd() * 34; sp.scale.set(sz, sz * 0.6, 1);
      sp.position.set(rnd() * 160 - 80, (47.5 + rnd() * 17) * U, rnd() * 160 - 80);
      sp.userData.v = 1 + rnd() * 2; scene.add(sp); puffs.push(sp);
    }
    /* haze below the cloud base: thinner, browner */
    for (var j = 0; j < 40; j++) {
      var hz = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xC79A55, transparent: true, opacity: 0.12 + rnd() * 0.12, depthWrite: false }));
      var hs = 40 + rnd() * 60; hz.scale.set(hs, hs * 0.5, 1);
      hz.position.set(rnd() * 300 - 150, (20 + rnd() * 27) * U, rnd() * 300 - 150);
      hz.userData.v = 0.5 + rnd(); scene.add(hz); puffs.push(hz);
    }
    /* the ground: dark rock lit by its own heat */
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0x2A1812, { roughness: 1, emissive: 0x3A1206, emissiveIntensity: 0.55 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var rock = std(0x1E1210, { roughness: 1 });
    for (var r = 0; r < 90; r++) {
      var rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rnd() * 2.2, 0), rock);
      rk.position.set(rnd() * 160 - 80, 0.2, rnd() * 160 - 80); rk.rotation.set(rnd() * 3, rnd() * 3, 0); scene.add(rk);
    }
    for (var l = 0; l < 14; l++) {
      var lv = glow(THREE, 0xFF7A45, 14 + rnd() * 30); lv.material.opacity = 0.16;
      lv.position.set(rnd() * 200 - 100, 0.6, rnd() * 200 - 100); scene.add(lv);
    }

    /* what goes up and what goes down */
    var tetherGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    var tether = new THREE.Line(tetherGeo, new THREE.LineBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0.8 })); scene.add(tether);
    function box(w, h, d, color) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)); }
    var up = new THREE.Group();
    var bal = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), std(0xF2E8D0, { roughness: 0.4 })); bal.position.y = 1.3; up.add(bal);
    up.add(box(0.28, 0.28, 0.28, 0x8A8496));
    up.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.14, 0), new THREE.Vector3(0, 0.8, 0)]), new THREE.LineBasicMaterial({ color: 0xF2E8D0 })));
    scene.add(up);
    var down = new THREE.Group();
    down.add(box(0.34, 0.44, 0.34, 0x8A8496));
    [0, 1, 2, 3].forEach(function (k) { var fin = box(0.05, 0.3, 0.22, 0xE8B33A); fin.position.set(k < 2 ? (k ? 0.2 : -0.2) : 0, -0.3, k < 2 ? 0 : (k === 2 ? 0.2 : -0.2)); down.add(fin); });
    scene.add(down);
    var probe = new THREE.Group();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 16), std(0xE8B33A)); cone.rotation.x = Math.PI; probe.add(cone);
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xF2E8D0, { side: THREE.DoubleSide, roughness: 0.9 })); canopy.position.y = 1.7; probe.add(canopy);
    var lp = []; for (var q = 0; q < 8; q++) { var th = q / 8 * Math.PI * 2; lp.push(new THREE.Vector3(0.75 * Math.cos(th), 1.7, 0.75 * Math.sin(th)), new THREE.Vector3(0, 0.3, 0)); }
    probe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: 0xF2E8D0, transparent: true, opacity: 0.7 })));
    scene.add(probe);
    var lander = new THREE.Group();
    lander.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 14), std(0xC9BFA8, { metalness: 0.4, roughness: 0.4 })));
    var shield = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 24), std(0x2A2430)); shield.position.y = -0.4; shield.rotation.x = Math.PI; lander.add(shield);
    var lflare = glow(THREE, 0xFF7A45, 2.2); lflare.position.y = -0.6; lflare.material.opacity = 0; lander.add(lflare);
    scene.add(lander);

    /* sky and fog by altitude */
    var SKY = [[65, 0xF4E9C9], [58, 0xEBDCAE], [52, 0xE6D5A6], [48, 0xD9BE7A], [45, 0xC79A55], [38, 0xA8703A], [30, 0x7A4A28], [15, 0x4E2A18], [0, 0x2A1410]];
    var skyCols = SKY.map(function (s) { return new THREE.Color(s[1]); });
    var skyTmp = new THREE.Color();
    function skyAt(km) {
      for (var i = 0; i < SKY.length - 1; i++) {
        if (km <= SKY[i][0] && km >= SKY[i + 1][0]) {
          var f = (SKY[i][0] - km) / (SKY[i][0] - SKY[i + 1][0]);
          return skyTmp.copy(skyCols[i]).lerp(skyCols[i + 1], f);
        }
      }
      return skyTmp.copy(km > 60 ? skyCols[0] : skyCols[SKY.length - 1]);
    }
    var PROF = PHOS.PROFILE || [];
    function atmo(km) {
      for (var i = 0; i < PROF.length - 1; i++) {
        if (km >= PROF[i].km && km <= PROF[i + 1].km) {
          var f = (km - PROF[i].km) / (PROF[i + 1].km - PROF[i].km);
          return { tC: lerp(PROF[i].tC, PROF[i + 1].tC, f), atm: Math.exp(lerp(Math.log(PROF[i].atm), Math.log(PROF[i + 1].atm), f)) };
        }
      }
      var e = PROF[PROF.length - 1]; return e ? { tC: e.tC, atm: e.atm } : { tC: 0, atm: 0 };
    }
    function setHud(km) {
      if (!hud.alt) return;
      var a = atmo(km);
      hud.alt.innerHTML = km.toFixed(1) + '<small> km</small>';
      hud.temp.innerHTML = Math.round(a.tC) + '<small> °C</small>';
      hud.pres.innerHTML = (a.atm >= 10 ? a.atm.toFixed(0) : a.atm >= 1 ? a.atm.toFixed(1) : a.atm.toFixed(2)) + '<small> atm</small>';
    }

    /* where the ship floats through each card */
    var SHIP_KM = [52, 54, 52, 50, 50, 50, 50];
    var N = 7, progress = 0, t = 0, camInit = false;
    var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    var focusKm = 52, tmp = new THREE.Vector3();
    function follow(obj, off, lookUp) {
      wantPos.set(obj.position.x + off[0], obj.position.y + off[1], obj.position.z + off[2]);
      wantLook.set(obj.position.x, obj.position.y + (lookUp || 0), obj.position.z);
    }
    function place(p) {
      var i = Math.min(N - 1, Math.floor(p * N)), local = p * N - i;
      var narrow = v.w() < 760;
      /* the ship drifts between its band altitudes over the first part of a card */
      var shipKm = lerp(i ? SHIP_KM[i - 1] : SHIP_KM[0], SHIP_KM[i], ease(seg(local, 0, 0.45)));
      shipG.position.set(0, shipKm * U, 0);
      var bottom = shipKm * U - 2.8, topY = shipKm * U + 1.8;
      up.visible = down.visible = probe.visible = lander.visible = tether.visible = false;
      var lookUp = narrow ? 2.2 : 0;
      if (i === 0) {
        var km = lerp(52, 62, ease(local));
        up.visible = tether.visible = true; up.position.set(1.5, km * U, 0);
        tether.geometry.setFromPoints([new THREE.Vector3(0, topY, 0), up.position]);
        follow(up, [4.5, 1.2, 7], lookUp * 0.6); focusKm = km;
      } else if (i === 1 || i === 3) {
        follow(shipG, [18, 3, 26], lookUp * 3); focusKm = shipKm;
      } else if (i === 2) {
        tmp.set(0, shipKm * U - 2.2, 0);
        wantPos.set(6, shipKm * U - 1.4, 9); wantLook.copy(tmp); wantLook.y += lookUp; focusKm = shipKm;
      } else if (i === 4) {
        var km4 = lerp(50, 45, ease(local));
        down.visible = tether.visible = true; down.position.set(1.2, km4 * U, 0);
        tether.geometry.setFromPoints([new THREE.Vector3(0, bottom, 0), down.position]);
        follow(down, [4.5, 1.6, 7], lookUp * 0.6); focusKm = km4;
      } else if (i === 5) {
        var km5 = lerp(50, 30, local);
        probe.visible = true; probe.position.set(2 + 2 * local, km5 * U, 0); probe.rotation.z = Math.sin(t * 1.3) * 0.08;
        follow(probe, [4, 1.5, 6.5], lookUp * 0.6 + 0.6); focusKm = km5;
      } else {
        var km6 = Math.max(0.006, lerp(30, 0, ease(seg(local, 0, 0.75))));
        var landed = seg(local, 0.72, 0.8);
        lander.visible = true; lander.position.set(6, km6 * U + 0.55, 3);
        lflare.material.opacity = km6 > 0.5 ? 0.6 : 0;
        var offHi = [4, 1.5, 6.5], offLo = [3.6, 0.9, 5.2];
        follow(lander, [lerp(offHi[0], offLo[0], landed), lerp(offHi[1], offLo[1], landed), lerp(offHi[2], offLo[2], landed)], lookUp * 0.6 + 0.4 * (1 - landed)); focusKm = km6;
      }
      var sky = skyAt(focusKm);
      scene.background.copy(sky); scene.fog.color.copy(sky);
      var inCloud = focusKm > 47.5 && focusKm < 63;
      scene.fog.near = inCloud ? 6 : 12;
      scene.fog.far = inCloud ? lerp(55, 90, seg(focusKm, 50, 62)) : (focusKm > 40 ? 160 : lerp(90, 260, seg(focusKm, 0, 30)));
      var dark = seg(focusKm, 47, 25);
      hemi.intensity = 1.0 - 0.55 * dark; sun.intensity = 0.6 - 0.45 * dark;
      setHud(focusKm < 0.05 ? 0 : focusKm);
    }
    ticker(v, function (dt, rdt) {
      t += dt;
      place(progress);
      puffs.forEach(function (sp) { sp.position.x -= sp.userData.v * dt; if (sp.position.x < -110) sp.position.x += 220; });
      /* frame-rate independent, and a jump rather than a long flight when the target is far off */
      var a = camInit ? 1 - Math.exp(-(rdt || dt) * 5) : 1; camInit = true;
      if (camPos.distanceTo(wantPos) > 120) a = 1;
      camPos.lerp(wantPos, a); camLook.lerp(wantLook, a);
      v.camera.position.copy(camPos); v.camera.lookAt(camLook);
      v.render(scene);
    });
    return { update: function (p) { progress = p; } };
  }

  /* ============================================================
     THE FLEET — each vehicle, exploded part by part as you scroll
     ============================================================ */

  function fleet3d(canvas, host) {
    var v = makeView(canvas, { fov: 38, near: 0.5, far: 6000, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 600, 2500, 8123));
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x12101F, 0.85));
    var key = new THREE.DirectionalLight(0xFFF3D6, 0.9); key.position.set(1, 1.2, 0.8); scene.add(key);
    var fill = new THREE.DirectionalLight(0x5FD0C4, 0.25); fill.position.set(-1, -0.4, -0.6); scene.add(fill);
    var overlay = document.createElement('div'); overlay.className = 'fx__labels'; host.appendChild(overlay);
    var SPECS = PHOS.FLEET3D || [];
    var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

    var vehicles = SPECS.map(function (spec) {
      var obj = model(THREE, spec.key);
      var box = new THREE.Box3().setFromObject(obj);
      var size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      var span = Math.max(size.x, size.y, size.z);
      obj.position.set(-center.x, -center.y, -center.z);
      obj.traverse(function (o) {
        if (!o.isMesh) return;
        if (o.userData.material === 'hull' && spec.seeThrough) { o.material.transparent = true; o.material.opacity = 0.3; o.material.depthWrite = false; }
      });
      var parts = spec.parts.map(function (P, i) {
        var meshes = obj.children.filter(function (m) { return P.groups.indexOf(m.name) >= 0; });
        var pb = new THREE.Box3(); meshes.forEach(function (m) { pb.expandByObject(m); });
        var pc = pb.getCenter(new THREE.Vector3());
        var dir = P.dir ? new THREE.Vector3(P.dir[0], P.dir[1], P.dir[2]) : pc.clone().sub(center);
        if (dir.length() < span * 0.03) dir.set(0.3, 0.8, 0.5);
        dir.normalize();
        var dist = span * (P.dist || 0.32);
        var el = document.createElement('div'); el.className = 'fx__label';
        el.innerHTML = '<b></b><span></span>'; el.firstChild.textContent = P.label; el.lastChild.textContent = P.note || '';
        el.style.opacity = 0; overlay.appendChild(el);
        return { meshes: meshes, at: pc, dir: dir, dist: dist, el: el, k: 0 };
      });
      obj.visible = false;
      scene.add(obj);
      return { spec: spec, obj: obj, parts: parts, span: span, size: size };
    });
    var N = vehicles.length, cards = null;
    var theta = 0.85, phi = 1.12, drag = 0, dragging = false, lx = 0, ly = 0, t = 0;
    var progress = 0, active = -1, camRadius = 100, wantRadius = 100;

    canvas.addEventListener('pointerdown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) { if (!dragging) return; drag -= (e.clientX - lx) * 0.008; phi = clamp(phi - (e.clientY - ly) * 0.006, 0.3, 1.5); lx = e.clientX; ly = e.clientY; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, function () { dragging = false; }); });

    function layout(p) {
      var i = Math.min(N - 1, Math.floor(p * N)), local = p * N - i;
      var V = vehicles[i];
      if (i !== active) {
        vehicles.forEach(function (o, j) { o.obj.visible = j === i; o.parts.forEach(function (P) { P.el.style.opacity = 0; }); });
        active = i;
        if (!cards) cards = Array.prototype.slice.call(host.closest('.stage').querySelectorAll('.stage__card'));
      }
      var kAll = ease(seg(local, 0.1, 0.72));
      fade(V.obj, seg(local, 0, 0.1));
      var n = V.parts.length;
      var list = cards && cards[i] ? cards[i].querySelectorAll('.part') : null;
      V.parts.forEach(function (P, j) {
        var k = ease(seg(local, 0.1 + 0.5 * j / n, 0.32 + 0.5 * j / n));
        P.k = k;
        P.meshes.forEach(function (m) { m.position.copy(P.dir).multiplyScalar(P.dist * k); });
        if (list && list[j]) list[j].classList.toggle('is-on', k > 0.35);
      });
      var wideModel = V.size.x > V.span * 0.8 || V.size.z > V.span * 0.8;
      wantRadius = V.span * (V.size.y > V.span * 0.8 ? 1.85 : wideModel ? 1.75 : 1.5) * (1 + 0.45 * kAll);
    }

    function frame(dt, rdt) {
      t += dt;
      if (!dragging) theta += dt * 0.07;
      camRadius += (wantRadius - camRadius) * (1 - Math.exp(-(rdt || dt) * 4));
      var w = v.w(), h = v.h(), wide = w >= 760;
      var V = vehicles[active < 0 ? 0 : active];
      var th = theta + drag;
      var target = new THREE.Vector3(0, 0, 0);
      var pos = new THREE.Vector3(camRadius * Math.sin(phi) * Math.cos(th), camRadius * Math.cos(phi), camRadius * Math.sin(phi) * Math.sin(th));
      /* slide the whole view so the model sits right of the cards on wide screens */
      var dir = target.clone().sub(pos).normalize();
      var right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      var sh = wide ? camRadius * 0.27 : 0;
      pos.addScaledVector(right, -sh); target.addScaledVector(right, -sh);
      v.camera.position.copy(pos); v.camera.lookAt(target);
      v.render(scene);
      /* project the part labels */
      if (V && V.obj.visible) {
        var items = [];
        V.parts.forEach(function (P) {
          var on = P.k > 0.35;
          P.el.style.opacity = on ? 1 : 0;
          if (!on) return;
          tmp.copy(P.at).addScaledVector(P.dir, P.dist * P.k);
          V.obj.localToWorld(tmp);
          tmp2.copy(tmp).project(v.camera);
          var lw = P.el.offsetWidth || 120, lh = P.el.offsetHeight || 30;
          items.push({ P: P, x: clamp((tmp2.x + 1) / 2 * w + 12, 8, w - lw - 8), y: (1 - tmp2.y) / 2 * h - 8, w: lw, h: lh });
        });
        /* stack labels that would land on top of each other */
        items.sort(function (a, b) { return a.y - b.y; });
        var placed = [];
        var low = 0;
        items.forEach(function (it) {
          placed.forEach(function (q) { if (it.x < q.x + q.w + 6 && q.x < it.x + it.w + 6 && it.y < q.y + q.h + 5) it.y = q.y + q.h + 5; });
          it.y = Math.max(8, it.y);
          placed.push(it);
          low = Math.max(low, it.y + it.h);
        });
        var over = Math.max(0, low - (h - 8));
        placed.forEach(function (it) { it.P.el.style.transform = 'translate(' + it.x.toFixed(1) + 'px,' + (it.y - over).toFixed(1) + 'px)'; });
      }
    }
    layout(0);
    ticker(v, frame);
    return { update: function (p) { progress = p; layout(p); } };
  }

  /* ============================================================
     THIRTY DAYS — down to the operating latitude, then lap by lap
     ============================================================ */

  function stay3d(canvas, hud) {
    var v = makeView(canvas, { fov: 40, near: 0.1, far: 5000, watch: canvas.closest('.stage') });
    if (!v) return null;
    var THREE = v.THREE, scene = new THREE.Scene();
    scene.add(starfield(THREE, 700, 3000, 6061));
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x0A0912, 0.12));
    var sun = new THREE.DirectionalLight(0xFFF3D6, 1.5); sun.position.set(1, 0.05, 0); scene.add(sun);
    var R = 60;
    var venus = planet(THREE, { radius: R, map: venusTexture(THREE), rim: 0xE8B33A, rimOpacity: 0.22, rimScale: 1.03 });
    scene.add(venus);
    var sunGlow = glow(THREE, 0xFFF3D6, 40); sunGlow.position.set(900, 40, 0); scene.add(sunGlow);
    /* the ship, big enough to see against a planet: a symbol, not to scale */
    var ship = model(THREE, 'phosphorus_airship', function (n) { return ['helium_cells', 'breathable_air_volume', 'ballonets', 'person'].indexOf(n) < 0; });
    var shipG = new THREE.Group(); shipG.add(ship); ship.scale.setScalar(3.2 / 129); scene.add(shipG);
    var dot = glow(THREE, 0xE8B33A, 5); scene.add(dot);
    var MAXP = 900;
    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
    trailGeo.setDrawRange(0, 0);
    var trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
    scene.add(trail);
    var trailDays = [], trailN = 0;

    var LAT = 10, DAY_H = 87.6, NIGHT_H = 53.9, LAP = DAY_H + NIGHT_H;
    var GROUND_DAY = 1.95, GROUND_NIGHT = 3.26;    /* degrees of longitude per hour over the ground */
    function lapState(hours) {
      var tl = hours % LAP, laps = Math.floor(hours / LAP);
      var day = tl < DAY_H;
      var lon = day ? -90 + 180 * tl / DAY_H : 90 + 180 * (tl - DAY_H) / NIGHT_H;   /* sun-relative: 0 is noon */
      var lit = laps * DAY_H + Math.min(tl, DAY_H);
      var ground = laps * (DAY_H * GROUND_DAY + NIGHT_H * GROUND_NIGHT) + (day ? tl * GROUND_DAY : DAY_H * GROUND_DAY + (tl - DAY_H) * GROUND_NIGHT);
      return { day: day, lon: lon, lit: lit, laps: laps, groundLon: 120 - ground, alt: day ? 51 : 55, tl: tl };
    }
    function onGlobe(lat, lon, alt, out) {
      var r = R + alt, la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
      return out.set(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
    }
    var DAYS = (PHOS.STAY || []).map(function (s) { return s.days; });
    var N = DAYS.length, progress = 0, t = 0, camInit = false;
    var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    var pos = new THREE.Vector3(), nxt = new THREE.Vector3(), radial = new THREE.Vector3(), tmp = new THREE.Vector3();
    var cDay = new THREE.Color(0xE8B33A), cNight = new THREE.Color(0x5FD0C4);

    function setHud(day, st) {
      if (!hud.day) return;
      hud.day.innerHTML = day.toFixed(1) + '<small> of 30</small>';
      var gl = ((st.groundLon % 360) + 540) % 360 - 180;
      hud.pos.textContent = LAT + '° N · ' + Math.abs(gl).toFixed(0) + '° ' + (gl >= 0 ? 'E' : 'W');
      hud.sun.textContent = (st.day ? 'day · ' : 'night · ') + st.alt + ' km';
      hud.lit.innerHTML = (day > 0 ? Math.round(100 * st.lit / (day * 24)) : 100) + '<small> % in the sun</small>';
    }

    function place(p) {
      var i = Math.min(N - 1, Math.floor(p * N)), local = p * N - i;
      var rng = DAYS[i] || [0, 0];
      var day = lerp(rng[0], rng[1], ease(local));
      var st = lapState(day * 24);
      var altU = st.day ? 0.9 : 2.4;
      onGlobe(LAT, st.lon, altU, pos);
      var st2 = lapState(day * 24 + 1);
      onGlobe(LAT, st2.lon, altU, nxt);
      shipG.position.copy(pos);
      radial.copy(pos).normalize();
      shipG.up.copy(radial); shipG.lookAt(nxt); shipG.rotateY(Math.PI / 2);
      dot.position.copy(pos);
      dot.material.color.copy(st.day ? cDay : cNight);
      /* the trail: rebuilt from the start whenever the day steps back */
      if (trailN && trailDays[trailN - 1] > day) { while (trailN && trailDays[trailN - 1] > day) trailN--; }
      if (!trailN || day - trailDays[trailN - 1] > 0.05) {
        var arr = trailGeo.attributes.position.array, col = trailGeo.attributes.color.array;
        var from = trailN ? trailDays[trailN - 1] : 0;
        while (trailN < MAXP && from <= day) {
          var s = lapState(from * 24);
          onGlobe(LAT, s.lon, s.day ? 0.9 : 2.4, tmp);
          arr[trailN * 3] = tmp.x; arr[trailN * 3 + 1] = tmp.y; arr[trailN * 3 + 2] = tmp.z;
          var c = s.day ? cDay : cNight; col[trailN * 3] = c.r; col[trailN * 3 + 1] = c.g; col[trailN * 3 + 2] = c.b;
          trailDays[trailN] = from; trailN++;
          if (from >= day) break;
          from = Math.min(day, from + 0.05);
        }
        trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
      }
      trailGeo.setDrawRange(0, trailN);
      /* camera: card one pulls back from the ship to the whole planet, then rides along */
      var wide = v.w() >= 760;
      var pull = i === 0 ? ease(seg(local, 0.05, 0.95)) : 1;
      var radius = lerp(5, 175, pull);
      var east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), radial).normalize();
      wantPos.copy(pos).addScaledVector(radial, radius * 0.72).addScaledVector(east, radius * 0.5).addScaledVector(new THREE.Vector3(0, 1, 0), radius * 0.32);
      wantLook.copy(pos).multiplyScalar(1 - pull * 0.85);   /* from the ship toward the planet's center */
      if (wide) {
        var d = new THREE.Vector3().subVectors(wantLook, wantPos).normalize();
        var right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
        wantPos.addScaledVector(right, -radius * 0.24 * pull); wantLook.addScaledVector(right, -radius * 0.24 * pull);
      }
      ship.visible = true;
      dot.scale.setScalar(lerp(0.01, 5, pull));
      setHud(day, st);
    }
    ticker(v, function (dt, rdt) {
      t += dt;
      var a = camInit ? 1 - Math.exp(-(rdt || dt) * 5) : 1; camInit = true;
      camPos.lerp(wantPos, a); camLook.lerp(wantLook, a);
      v.camera.position.copy(camPos); v.camera.lookAt(camLook);
      v.render(scene);
    });
    place(0);
    return { update: function (p) { progress = p; place(p); } };
  }

  /* ============================================================
     boot
     ============================================================ */

  function swapCanvas(old) {
    /* a fresh canvas for WebGL, so a failure leaves the 2D one untouched */
    var c = document.createElement('canvas');
    c.className = (old.className ? old.className + ' ' : '') + 'act3d';
    c.setAttribute('aria-label', old.getAttribute('aria-label') || '');
    old.parentNode.insertBefore(c, old);
    return c;
  }

  PHOS.G3 = { parseOBJ: parseOBJ, buildObject: buildObject, material: material };

  PHOS.ACTS3D = {
    init: function (onTick, trackProgress) {
      if (!window.THREE || !PHOS.MODELS) return null;
      var probe = document.createElement('canvas');
      var gl = null;
      try { gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'); } catch (e) { gl = null; }
      if (!gl) return null;

      var out = { acts: false, descent: null, cutaway: false, compare: null, build: null, walk: null, learn: null, samples: null, fleet: null, stay: null };
      var a = document.getElementById('assemblyCanvas');
      var b = document.getElementById('journeyCanvas');
      var d = document.getElementById('descentCanvas');

      if (a) {
        var ca = swapCanvas(a);
        var okA = actAssembly(ca, onTick, trackProgress, document.getElementById('aCaption'));
        if (okA) a.hidden = true; else ca.parentNode.removeChild(ca);
        out.acts = okA;
      }
      if (b) {
        var cb = swapCanvas(b);
        var okB = actJourney(cb, onTick, trackProgress, {
          day: document.getElementById('jDay'), phase: document.getElementById('jPhase'), note: document.getElementById('jNote')
        });
        if (okB) b.hidden = true; else cb.parentNode.removeChild(cb);
        out.acts = out.acts && okB;
      }
      if (d) {
        var cd = document.createElement('canvas');
        cd.className = 'descent__3d';
        cd.setAttribute('aria-hidden', 'true');
        d.parentNode.insertBefore(cd, d.nextSibling);
        out.descent = descent3d(cd);
        if (!out.descent) cd.parentNode.removeChild(cd);
      }
      var bc = document.getElementById('buildCanvas');
      if (bc) {
        var cb2 = swapCanvas(bc);
        out.build = build3d(cb2, { step: document.getElementById('bStep'), key: document.getElementById('bKey'), val: document.getElementById('bVal'), unit: document.getElementById('bUnit') });
        if (out.build) bc.hidden = true; else cb2.parentNode.removeChild(cb2);
      }
      var wc = document.getElementById('walkCanvas');
      if (wc) {
        var cw2 = swapCanvas(wc);
        out.walk = walk3d(cw2, { step: document.getElementById('wStep'), out: document.getElementById('wOut'), time: document.getElementById('wTime') });
        if (out.walk) wc.hidden = true; else cw2.parentNode.removeChild(cw2);
      }
      var lc = document.getElementById('learnCanvas');
      if (lc) {
        var cl2 = swapCanvas(lc);
        out.learn = learn3d(cl2);
        if (out.learn) lc.hidden = true; else cl2.parentNode.removeChild(cl2);
      }
      var sc = document.getElementById('samplesCanvas');
      if (sc) {
        var cs2 = swapCanvas(sc);
        out.samples = samples3d(cs2, { alt: document.getElementById('sAlt'), temp: document.getElementById('sTemp'), pres: document.getElementById('sPres') });
        if (out.samples) sc.hidden = true; else cs2.parentNode.removeChild(cs2);
      }
      var fc = document.getElementById('fleetCanvas');
      if (fc) {
        var cf2 = swapCanvas(fc);
        out.fleet = fleet3d(cf2, fc.parentNode);
        if (out.fleet) fc.hidden = true; else cf2.parentNode.removeChild(cf2);
      }
      var yc = document.getElementById('stayCanvas');
      if (yc) {
        var cy2 = swapCanvas(yc);
        out.stay = stay3d(cy2, { day: document.getElementById('yDay'), pos: document.getElementById('yPos'), sun: document.getElementById('ySun'), lit: document.getElementById('yLit') });
        if (out.stay) yc.hidden = true; else cy2.parentNode.removeChild(cy2);
      }
      var cmp = document.getElementById('compareCanvas');
      if (cmp) {
        var cc = swapCanvas(cmp);
        out.compare = compare3d(cc);
        if (out.compare) cmp.hidden = true; else cc.parentNode.removeChild(cc);
      }
      return out;
    }
  };
})();
