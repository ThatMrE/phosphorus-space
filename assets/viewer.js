/* ============================================================
   PROJECT PHOSPHORUS — the fleet in three dimensions
   Builds each vehicle from the OBJ text in assets/models.js
   (generated from the plan's dimensions), renders it with the
   vendored three.js, and lets you turn it by hand.
   ============================================================ */
(function () {
  'use strict';

  var PHOS = window.PHOS || {};
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VEHICLES = [
    { key: 'phosphorus_airship',       label: 'The cloud ship',   name: 'Phosphorus',
      human: 'Longer than a 747. That dot by the gondola is a person.',
      cutaway: true },
    { key: 'hesperus_transit_habitat', label: 'The ride there',   name: 'Hesperus',
      human: 'About the room of a modest house, for four people and fifteen months.' },
    { key: 'vesper_ascent_vehicle',    label: 'The ride back up', name: 'Vesper',
      human: 'Twenty meters tall. It has to leave from a balloon.' },
    { key: 'assembled_stack',          label: 'Leaving Earth',    name: 'The stack',
      human: 'Everything that crosses to Venus, bolted together in orbit.' }
  ];

  function parseOBJ(text) {
    var verts = [], groups = [], cur = null;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (L.charCodeAt(0) === 118 && L.charCodeAt(1) === 32) {        /* 'v ' */
        var p = L.split(/\s+/);
        verts.push(+p[1], +p[2], +p[3]);
      } else if (L.charCodeAt(0) === 102 && L.charCodeAt(1) === 32) { /* 'f ' */
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

  function buildObject(THREE, parsed) {
    var root = new THREE.Group();
    var pos = new Float32Array(parsed.verts);
    var mats = PHOS.MODEL_MATERIALS || {};
    parsed.groups.forEach(function (g) {
      if (!g.faces.length) return;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(g.faces);
      geo.computeVertexNormals();
      var m = mats[g.material] || { rgb: [0.8, 0.8, 0.8], alpha: 1 };
      var mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(m.rgb[0], m.rgb[1], m.rgb[2]),
        roughness: 0.62, metalness: 0.08,
        transparent: m.alpha < 1, opacity: m.alpha,
        side: THREE.DoubleSide,
        depthWrite: m.alpha >= 1
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.name = g.name;
      mesh.userData.material = g.material;
      root.add(mesh);
    });
    return root;
  }

  function init() {
    var host = document.getElementById('fleet3d');
    if (!host || !PHOS.MODELS) return;
    var THREE = window.THREE;
    var canvas = host.querySelector('canvas');
    var pick = host.querySelector('.f3d__pick');
    var name = host.querySelector('.f3d__name');
    var human = host.querySelector('.f3d__human');
    var dims = host.querySelector('.f3d__dims');
    var cutBtn = host.querySelector('.f3d__cut');
    var fallback = host.querySelector('.f3d__fallback');

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
      if (fallback) fallback.hidden = false;
      canvas.hidden = true;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xF2E8D0, 0x12101F, 0.85));
    var key = new THREE.DirectionalLight(0xFFF3D6, 0.9);
    key.position.set(1, 1.2, 0.8);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x5FD0C4, 0.25);
    fill.position.set(-1, -0.4, -0.6);
    scene.add(fill);

    /* a faint ground disc under each model so scale reads */
    var groundGeo = new THREE.CircleGeometry(1, 64);
    var ground = new THREE.Mesh(groundGeo, new THREE.MeshBasicMaterial({
      color: 0x5FD0C4, transparent: true, opacity: 0.06, side: THREE.DoubleSide
    }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    var current = null, radius = 100, theta = 0.85, phi = 1.12, cut = true, active = 0;
    var dragging = false, lx = 0, ly = 0, idle = 0;

    function fit(obj) {
      /* center the model, stand it on y=0, and back the camera off to suit its size */
      var box = new THREE.Box3().setFromObject(obj);
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      obj.position.set(-center.x, -box.min.y, -center.z);
      radius = Math.max(size.x, size.y, size.z) * 1.35;
      ground.scale.set(radius * 0.55, radius * 0.55, 1);
      camera.lookTarget = new THREE.Vector3(0, size.y * 0.5, 0);
      return size;
    }

    function show(i) {
      active = i;
      var v = VEHICLES[i];
      if (current) scene.remove(current);
      current = buildObject(THREE, parseOBJ(PHOS.MODELS[v.key]));
      scene.add(current);
      var size = fit(current);
      applyCut();
      name.textContent = v.name;
      human.textContent = v.human;
      dims.textContent = size.x.toFixed(0) + ' × ' + size.y.toFixed(0) + ' × ' + size.z.toFixed(0) + ' m';
      Array.prototype.forEach.call(pick.children, function (b, j) {
        b.classList.toggle('is-on', j === i);
        b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      cutBtn.hidden = !v.cutaway;
      var dl = host.querySelector('.f3d__dl');
      if (dl) { dl.href = 'models/' + v.key + '.obj'; dl.download = v.key + '.obj'; }
      render();
    }

    function applyCut() {
      if (!current) return;
      current.traverse(function (o) {
        if (!o.isMesh) return;
        if (o.userData.material === 'hull') {
          o.material.transparent = true;
          o.material.opacity = cut ? 0.28 : 1;
          o.material.depthWrite = !cut;
        }
        if (['helium', 'air', 'ballonet'].indexOf(o.userData.material) >= 0) o.visible = cut;
      });
      cutBtn.setAttribute('aria-pressed', cut ? 'true' : 'false');
      cutBtn.textContent = cut ? 'Cutaway on' : 'Cutaway off';
    }

    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function render() {
      var t = camera.lookTarget || new THREE.Vector3();
      camera.position.set(
        t.x + radius * Math.sin(phi) * Math.cos(theta),
        t.y + radius * Math.cos(phi),
        t.z + radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(t);
      renderer.render(scene, camera);
    }

    /* drag to turn */
    function down(e) { dragging = true; idle = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); }
    function move(e) {
      if (!dragging) return;
      theta -= (e.clientX - lx) * 0.008;
      phi = Math.min(Math.max(phi - (e.clientY - ly) * 0.006, 0.25), 1.55);
      lx = e.clientX; ly = e.clientY;
      render();
    }
    function up() { dragging = false; }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);

    host.querySelector('.f3d__in').addEventListener('click', function () { radius *= 0.8; render(); });
    host.querySelector('.f3d__out').addEventListener('click', function () { radius *= 1.25; render(); });
    cutBtn.addEventListener('click', function () { cut = !cut; applyCut(); render(); });

    VEHICLES.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'f3d__btn';
      b.textContent = v.label;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { show(i); });
      pick.appendChild(b);
    });

    /* slow turn while nobody is touching it */
    var visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(host);
    } else visible = true;
    function loop() {
      if (visible && !dragging && !REDUCED) {
        idle++;
        if (idle > 90) { theta += 0.0025; render(); }
      }
      requestAnimationFrame(loop);
    }

    window.addEventListener('resize', function () { size(); render(); }, { passive: true });
    size();
    show(0);
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
