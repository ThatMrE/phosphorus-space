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
    { key: 'lucifer_return_capsule',   label: 'The way home',     name: 'Lucifer',
      human: 'Five meters across, four people, and the fastest reentry anyone has ever flown.' },
    { key: 'assembled_stack',          label: 'Leaving Earth',    name: 'The stack',
      human: 'Everything that crosses to Venus, bolted together in orbit.' },
    { key: 'starship',                 label: 'The launch',       name: 'Starship',
      human: 'The launch vehicle, booster and all. Six flights put the stack in orbit.' },
    { key: 'entry_vehicle',            label: 'The way in',       name: 'Entry vehicle',
      human: 'A 12.8-meter heat shield with a folded 129-meter ship and two people inside.' }
  ];

  function init() {
    var host = document.getElementById('fleet3d');
    if (!host || !PHOS.MODELS || !PHOS.G3) return;
    var THREE = window.THREE;
    var canvas = host.querySelector('canvas');
    var pick = host.querySelector('.f3d__pick');
    var name = host.querySelector('.f3d__name');
    var human = host.querySelector('.f3d__human');
    var dims = host.querySelector('.f3d__dims');
    var specs = host.querySelector('.f3d__specs');
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
      /* tall vehicles need more room than wide ones in a 16:10 frame, and small
         ones need to sit clear of the spec sheet at the lower left */
      var span = Math.max(size.x, size.y * 1.45, size.z);
      radius = span * (span < 15 ? 2.4 : 1.35);
      ground.scale.set(radius * 0.55, radius * 0.55, 1);
      var wide = canvas.clientWidth > 760;
      camera.lookTarget = new THREE.Vector3(wide ? -radius * 0.16 : 0, size.y * 0.5, 0);
      return size;
    }

    function show(i) {
      active = i;
      var v = VEHICLES[i];
      if (current) scene.remove(current);
      current = PHOS.G3.buildObject(THREE, PHOS.G3.parseOBJ(PHOS.MODELS[v.key]));
      scene.add(current);
      var size = fit(current);
      applyCut();
      name.textContent = v.name;
      human.textContent = v.human;
      dims.textContent = size.x.toFixed(0) + ' × ' + size.y.toFixed(0) + ' × ' + size.z.toFixed(0) + ' m';
      /* the plan's spec sheet for this vehicle, when it has one */
      if (specs) {
        specs.innerHTML = '';
        var sheet = (PHOS.FLEET || []).filter(function (f) { return f.name === v.name; })[0];
        specs.hidden = !sheet;
        if (sheet) {
          var head = document.createElement('div');
          head.className = 'f3d__spec f3d__spec--head';
          head.innerHTML = '<dt></dt><dd></dd>';
          head.firstChild.textContent = sheet.role;
          head.lastChild.textContent = sheet.mass + ' · crew ' + sheet.crew;
          specs.appendChild(head);
          sheet.specs.forEach(function (sp) {
            var row = document.createElement('div');
            row.className = 'f3d__spec';
            row.innerHTML = '<dt></dt><dd></dd>';
            row.firstChild.textContent = sp[0];
            row.lastChild.textContent = sp[1];
            specs.appendChild(row);
          });
        }
      }
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
