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
     THE SHIP — a labeled cutaway in three dimensions
     ============================================================ */

  function cutaway3d(host) {
    var THREE = window.THREE;
    if (!THREE || !PHOS.MODELS) return false;
    host.innerHTML = '';
    host.classList.add('cut3d');
    var canvas = document.createElement('canvas');
    var overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'cut3d__lines');
    host.appendChild(canvas); host.appendChild(overlay);
    var v = makeView(canvas, { fov: 30, near: 1, far: 4000, alpha: true, watch: host });
    if (!v) { host.classList.remove('cut3d'); host.innerHTML = ''; return false; }
    var scene = new THREE.Scene();
    lights(THREE, scene, [1, 1.2, 0.8], 1.1);
    var fill = new THREE.DirectionalLight(0x5FD0C4, 0.3); fill.position.set(-1, -0.5, -0.6); scene.add(fill);
    var ship = model(THREE, 'phosphorus_airship');
    ship.traverse(function (o) {
      if (!o.isMesh) return;
      if (o.userData.material === 'hull') { o.material.transparent = true; o.material.opacity = 0.26; o.material.depthWrite = false; }
    });
    scene.add(ship);

    var CALLS = [
      { at: [-38, 4, 8],    side: 'l', t: 'Helium lift cells',        v: '46 000 m³ · 66.8 t lift', c: '#E8B33A' },
      { at: [-30, -6, 6],   side: 'l', t: 'Ballonets',                v: 'buoyancy and thermal trim', c: '#C9BFA8' },
      { at: [-7, -22.5, 2.6], side: 'l', t: 'Habitat module',         v: '2 crew · 30 days · 1 atm', c: '#5FD0C4' },
      { at: [8, 17, 0],     side: 'r', t: 'Thin-film photovoltaics',  v: '~1 000 m² · 2 601 W/m²', c: '#E8B33A' },
      { at: [26, -7, 14],   side: 'r', t: 'Breathable-air volume',    v: '31 500 m³ · 16.8 t · ambient', c: '#5FD0C4' },
      { at: [9, -28, 1.8],  side: 'r', t: 'Vesper ascent vehicle',    v: '~8.0 km/s to Venus orbit', c: '#FF7A45' }
    ];
    var labels = CALLS.map(function (c, i) {
      var el = document.createElement('div');
      el.className = 'cut3d__label cut3d__label--' + c.side;
      el.innerHTML = '<b>' + c.t + '</b><span style="color:' + c.c + '">' + c.v + '</span>';
      host.appendChild(el);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', c.c); line.setAttribute('stroke-width', '1.2'); line.setAttribute('opacity', '0.55');
      overlay.appendChild(line);
      var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3.5'); dot.setAttribute('fill', c.c);
      overlay.appendChild(dot);
      return { el: el, line: line, dot: dot, at: new THREE.Vector3(c.at[0], c.at[1], c.at[2]), side: c.side, slot: i % 3 };
    });
    var scaleNote = document.createElement('p');
    scaleNote.className = 'cut3d__scale';
    scaleNote.textContent = '129 m — longer than a Boeing 747 (70.6 m) · drag to turn';
    host.appendChild(scaleNote);

    var theta = 0.62, phi = 1.32, radius = 205, dragging = false, lx = 0, ly = 0, idle = 0;
    var target = new THREE.Vector3(0, -6, 0), tmp = new THREE.Vector3();
    function render() {
      var w = v.w(), h = v.h();
      if (!w || !h) return;
      var r = radius * (w < 640 ? 1.9 : w < 900 ? 1.35 : 1);
      v.camera.position.set(target.x + r * Math.sin(phi) * Math.cos(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.sin(theta));
      v.camera.lookAt(target);
      v.render(scene);
      /* project the anchors and lay the labels out in two columns */
      labels.forEach(function (L) {
        tmp.copy(L.at).project(v.camera);
        var sx = (tmp.x + 1) / 2 * w, sy = (1 - tmp.y) / 2 * h;
        var lw = L.el.offsetWidth, lh = L.el.offsetHeight;
        var slotY = 12 + L.slot * (h - 24 - lh) / 2;
        var lxp = L.side === 'l' ? 8 : w - lw - 8;
        L.el.style.transform = 'translate(' + lxp.toFixed(1) + 'px,' + slotY.toFixed(1) + 'px)';
        var ex = L.side === 'l' ? lxp + lw + 6 : lxp - 6;
        var ey = slotY + lh / 2;
        L.line.setAttribute('x1', sx); L.line.setAttribute('y1', sy);
        L.line.setAttribute('x2', ex); L.line.setAttribute('y2', ey);
        L.dot.setAttribute('cx', sx); L.dot.setAttribute('cy', sy);
      });
    }
    canvas.addEventListener('pointerdown', function (e) { dragging = true; idle = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      theta -= (e.clientX - lx) * 0.008;
      phi = clamp(phi - (e.clientY - ly) * 0.006, 0.4, 1.5);
      lx = e.clientX; ly = e.clientY;
      render();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, function () { dragging = false; }); });
    function loop() {
      if (v.visible() && !dragging && !REDUCED) { idle++; if (idle > 60) { theta += 0.0018; render(); } }
      requestAnimationFrame(loop);
    }
    v.onResize = render;
    render();
    requestAnimationFrame(loop);
    return true;
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

      var out = { acts: false, descent: null, cutaway: false, compare: null, build: null };
      var a = document.getElementById('assemblyCanvas');
      var b = document.getElementById('journeyCanvas');
      var d = document.getElementById('descentCanvas');
      var s = document.getElementById('shipSvg');

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
      if (s) out.cutaway = cutaway3d(s);
      var bc = document.getElementById('buildCanvas');
      if (bc) {
        var cb2 = swapCanvas(bc);
        out.build = build3d(cb2, { step: document.getElementById('bStep'), key: document.getElementById('bKey'), val: document.getElementById('bVal'), unit: document.getElementById('bUnit') });
        if (out.build) bc.hidden = true; else cb2.parentNode.removeChild(cb2);
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
