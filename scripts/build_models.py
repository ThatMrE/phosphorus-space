"""Generate 3D models of the fleet from the plan's own dimensions.

Outputs
  models/*.obj + models/*.mtl   design files (meters, Y up) for Blender etc.
  assets/models.js              the same geometry as JS strings for the viewer

Everything is built from primitives sized to the numbers in assets/data.js:
the 129 m x 34 m hull, the ~180 m^3 transit habitat, a two-stage ascent
vehicle sized for ~40 t of LOX/methane, and the assembled orbital stack.
No external assets are used. Run from anywhere; paths are relative to this file.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
OUT_MODELS = os.path.join(ROOT, 'models')
OUT_JS = os.path.join(ROOT, 'assets', 'models.js')

# Material palette shared by the .mtl files and the web viewer.
MATERIALS = {
    'hull':     {'rgb': (0.90, 0.86, 0.76), 'alpha': 1.00, 'note': 'PTFE-faced envelope'},
    'helium':   {'rgb': (0.91, 0.70, 0.23), 'alpha': 0.55, 'note': 'sealed helium lift cells'},
    'air':      {'rgb': (0.37, 0.82, 0.77), 'alpha': 0.35, 'note': 'ambient-pressure breathable-air volume'},
    'ballonet': {'rgb': (0.95, 0.91, 0.82), 'alpha': 0.40, 'note': 'trim ballonets'},
    'solar':    {'rgb': (0.16, 0.20, 0.36), 'alpha': 1.00, 'note': 'thin-film photovoltaics'},
    'gondola':  {'rgb': (0.20, 0.18, 0.30), 'alpha': 1.00, 'note': 'crew module'},
    'crew':     {'rgb': (0.37, 0.82, 0.77), 'alpha': 1.00, 'note': 'pressurized crew volume'},
    'tank':     {'rgb': (0.78, 0.75, 0.66), 'alpha': 1.00, 'note': 'propellant tank'},
    'truss':    {'rgb': (0.43, 0.41, 0.50), 'alpha': 1.00, 'note': 'structure'},
    'engine':   {'rgb': (0.30, 0.28, 0.32), 'alpha': 1.00, 'note': 'engine bell'},
    'shell':    {'rgb': (1.00, 0.48, 0.27), 'alpha': 1.00, 'note': 'entry aeroshell'},
    'vesper':   {'rgb': (0.91, 0.70, 0.23), 'alpha': 1.00, 'note': 'ascent vehicle'},
    'human':    {'rgb': (0.95, 0.91, 0.82), 'alpha': 1.00, 'note': '1.8 m person, for scale'},
    'line':     {'rgb': (0.60, 0.58, 0.66), 'alpha': 1.00, 'note': 'suspension'},
}


class Mesh:
    """A tiny OBJ builder: vertices in meters, triangles only, grouped by material."""

    def __init__(self, name):
        self.name = name
        self.v = []
        self.groups = []          # (group, material, [faces])
        self._cur = None

    def group(self, gname, material):
        self._cur = (gname, material, [])
        self.groups.append(self._cur)

    def add(self, verts, faces):
        base = len(self.v)
        self.v.extend(verts)
        self._cur[2].extend([(a + base, b + base, c + base) for a, b, c in faces])

    # ---- primitives -------------------------------------------------

    def ellipsoid(self, c, r, nu=40, nv=20, rot=None):
        cx, cy, cz = c
        rx, ry, rz = r
        verts, faces = [], []
        for i in range(nv + 1):
            phi = math.pi * i / nv
            for j in range(nu):
                th = 2 * math.pi * j / nu
                x = rx * math.sin(phi) * math.cos(th)
                y = ry * math.cos(phi)
                z = rz * math.sin(phi) * math.sin(th)
                if rot:
                    x, y, z = rot(x, y, z)
                verts.append((cx + x, cy + y, cz + z))
        for i in range(nv):
            for j in range(nu):
                a = i * nu + j
                b = i * nu + (j + 1) % nu
                c2 = (i + 1) * nu + j
                d = (i + 1) * nu + (j + 1) % nu
                if i != 0:
                    faces.append((a, c2, b))
                if i != nv - 1:
                    faces.append((b, c2, d))
        self.add(verts, faces)

    def cylinder(self, p0, p1, r0, r1=None, n=32, caps=True):
        """Frustum from p0 to p1 with radii r0 -> r1 (any orientation)."""
        if r1 is None:
            r1 = r0
        ax = [p1[k] - p0[k] for k in range(3)]
        L = math.sqrt(sum(a * a for a in ax)) or 1e-9
        ax = [a / L for a in ax]
        ref = (0, 1, 0) if abs(ax[1]) < 0.9 else (1, 0, 0)
        u = cross(ax, ref); un = norm(u); u = [x / un for x in u]
        w = cross(ax, u)
        verts, faces = [], []
        for k, (p, r) in enumerate(((p0, r0), (p1, r1))):
            for j in range(n):
                th = 2 * math.pi * j / n
                verts.append(tuple(p[i] + r * (u[i] * math.cos(th) + w[i] * math.sin(th)) for i in range(3)))
        for j in range(n):
            a, b = j, (j + 1) % n
            c2, d = n + j, n + (j + 1) % n
            faces.append((a, b, c2))
            faces.append((b, d, c2))
        if caps:
            base = len(verts)
            verts.append(tuple(p0)); verts.append(tuple(p1))
            for j in range(n):
                faces.append((base, (j + 1) % n, j))
                faces.append((base + 1, n + j, n + (j + 1) % n))
        self.add(verts, faces)

    def box(self, c, s):
        cx, cy, cz = c
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        verts = [(cx + sx * hx, cy + sy * hy, cz + sz * hz)
                 for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        # index: x*4 + y*2 + z  with (-1->0, 1->1)
        def I(x, y, z): return (x * 4 + y * 2 + z)
        faces = []
        def quad(a, b, c2, d): faces.extend([(a, b, c2), (a, c2, d)])
        quad(I(0,0,0), I(0,1,0), I(0,1,1), I(0,0,1))   # -x
        quad(I(1,0,0), I(1,0,1), I(1,1,1), I(1,1,0))   # +x
        quad(I(0,0,0), I(0,0,1), I(1,0,1), I(1,0,0))   # -y
        quad(I(0,1,0), I(1,1,0), I(1,1,1), I(0,1,1))   # +y
        quad(I(0,0,0), I(1,0,0), I(1,1,0), I(0,1,0))   # -z
        quad(I(0,0,1), I(0,1,1), I(1,1,1), I(1,0,1))   # +z
        self.add(verts, faces)

    def bounds(self):
        xs = [p[0] for p in self.v]; ys = [p[1] for p in self.v]; zs = [p[2] for p in self.v]
        return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))

    # ---- output ------------------------------------------------------

    def obj(self):
        out = ['# %s — generated by scripts/build_models.py from the Project Phosphorus plan' % self.name,
               '# units: meters, Y up', 'mtllib %s.mtl' % self.name, 'o %s' % self.name]
        for x, y, z in self.v:
            out.append('v %.4f %.4f %.4f' % (x, y, z))
        for g, m, faces in self.groups:
            out.append('g %s' % g)
            out.append('usemtl %s' % m)
            for a, b, c in faces:
                out.append('f %d %d %d' % (a + 1, b + 1, c + 1))
        return '\n'.join(out) + '\n'


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def norm(a):
    return math.sqrt(sum(x * x for x in a)) or 1e-9


def mtl_text():
    out = ['# Project Phosphorus materials']
    for name, m in MATERIALS.items():
        r, g, b = m['rgb']
        out += ['newmtl %s' % name, 'Kd %.3f %.3f %.3f' % (r, g, b), 'Ka %.3f %.3f %.3f' % (r * 0.3, g * 0.3, b * 0.3),
                'Ks 0.10 0.10 0.10', 'Ns 18', 'd %.2f' % m['alpha'], '# %s' % m['note'], '']
    return '\n'.join(out)


# ======================================================================
# The vehicles
# ======================================================================

def human(m, at=(0, 0, 0)):
    """A 1.8 m person: legs, torso, head. Feet at y=at[1]."""
    x, y, z = at
    m.group('person', 'human')
    m.cylinder((x - 0.12, y, z), (x - 0.12, y + 0.85, z), 0.09, n=10)
    m.cylinder((x + 0.12, y, z), (x + 0.12, y + 0.85, z), 0.09, n=10)
    m.cylinder((x, y + 0.85, z), (x, y + 1.50, z), 0.20, n=12)
    m.ellipsoid((x, y + 1.66, z), (0.11, 0.13, 0.11), nu=12, nv=8)


def airship(cutaway=True):
    """Phosphorus: 129 m x 34 m envelope, long axis along X, floating."""
    m = Mesh('phosphorus_airship')
    a, b = 64.5, 17.0          # semi-axes from 129 m x 34 m

    m.group('envelope', 'hull')
    m.ellipsoid((0, 0, 0), (b, b, b), nu=56, nv=28,
                rot=lambda x, y, z: (x * a / b, y, z))   # stretch a sphere into the hull

    # solar crown: a thin patch of the hull's own upper surface.
    # Prolate spheroid, long axis X:  x = a cos u,  y = b sin u cos v,  z = b sin u sin v
    # u runs along the axis, v around it; v = 0 is the top of the hull.
    m.group('solar_crown', 'solar')
    crown, faces = [], []
    nu, nv = 44, 10
    for i in range(nv + 1):
        v = math.radians(-34 + 68 * i / nv)          # ±34° around the crown
        for j in range(nu + 1):
            u = math.pi * (0.20 + 0.60 * j / nu)      # central 60% of the length
            k = 1.006                                # sit just proud of the skin
            crown.append((a * k * math.cos(u),
                          b * k * math.sin(u) * math.cos(v),
                          b * k * math.sin(u) * math.sin(v)))
    for i in range(nv):
        for j in range(nu):
            q = i * (nu + 1) + j
            faces.append((q, q + 1, q + nu + 1))
            faces.append((q + 1, q + nu + 2, q + nu + 1))
    m.add(crown, faces)

    if cutaway:
        m.group('helium_cells', 'helium')
        for fx in (-0.58, -0.195, 0.195, 0.58):
            m.ellipsoid((a * fx, b * 0.22, 0), (a * 0.17, b * 0.48, b * 0.62), nu=32, nv=16)
        m.group('breathable_air_volume', 'air')
        m.ellipsoid((0, -b * 0.42, 0), (a * 0.74, b * 0.50, b * 0.86), nu=40, nv=16)
        m.group('ballonets', 'ballonet')
        for fx in (-0.46, 0.46):
            m.ellipsoid((a * fx, -b * 0.32, 0), (a * 0.095, b * 0.19, b * 0.4), nu=20, nv=10)

    # gondola under the hull: crew module + lab + Vesper cradle
    gy = -b - 5.5
    m.group('gondola', 'gondola')
    m.box((0, gy, 0), (26, 6.5, 6.5))
    m.group('crew_module', 'crew')
    m.box((-7, gy, 0), (10, 5.2, 5.2))
    m.group('suspension', 'line')
    for fx in (-0.30, -0.10, 0.10, 0.30):
        m.cylinder((fx * 26, gy + 3.25, 0), (fx * a * 1.1, -b * 0.95, 0), 0.10, n=6, caps=False)

    # propulsors at each end
    m.group('propulsors', 'truss')
    for sx in (-1, 1):
        m.cylinder((sx * (a + 0.5), 0, 0), (sx * (a + 2.5), 0, 0), 4.5, n=28)

    # Vesper hangs aft of the gondola
    vesper(m, at=(9, gy - 12.5, 0), prefix='vesper_')
    human(m, at=(-16, gy - 3.25, 4.5))
    return m


def vesper(m=None, at=(0, 0, 0), prefix=''):
    """Two-stage LOX/methane ascent vehicle, Ø3.5 m, standing on Y."""
    own = m is None
    if own:
        m = Mesh('vesper_ascent_vehicle')
    x, y, z = at
    r = 1.75
    m.group(prefix + 'stage_1', 'vesper')
    m.cylinder((x, y, z), (x, y + 11, z), r, n=32)
    m.group(prefix + 'stage_2', 'vesper')
    m.cylinder((x, y + 11.2, z), (x, y + 17, z), r * 0.92, n=32)
    m.group(prefix + 'capsule', 'crew')
    m.cylinder((x, y + 17, z), (x, y + 20.2, z), r * 0.92, r * 0.25, n=32)
    m.group(prefix + 'engines', 'engine')
    for k in range(4):
        th = math.pi / 4 + k * math.pi / 2
        ex, ez = x + 0.9 * math.cos(th), z + 0.9 * math.sin(th)
        m.cylinder((ex, y, ez), (ex, y - 1.6, ez), 0.35, 0.62, n=16)
    if own:
        human(m, at=(x + 4, y - 1.6, z))
    return m


def hesperus(m=None, at=(0, 0, 0), prefix=''):
    """Transit habitat: ~180 m^3 cylinder Ø4.5 x 11.3 m plus wings, tanks, node."""
    own = m is None
    if own:
        m = Mesh('hesperus_transit_habitat')
    x, y, z = at
    R = 2.25
    m.group(prefix + 'habitat', 'crew')
    m.cylinder((x, y, z), (x, y + 11.3, z), R, n=40)
    m.group(prefix + 'storm_shelter', 'tank')
    m.cylinder((x, y + 4.2, z), (x, y + 7.1, z), R * 1.12, n=40)
    m.group(prefix + 'docking_node', 'truss')
    m.cylinder((x, y + 11.3, z), (x, y + 13.0, z), 1.1, n=24)
    m.group(prefix + 'solar_wings', 'solar')
    for sx in (-1, 1):
        m.box((x + sx * (R + 7.2), y + 8.6, z), (13.0, 0.12, 4.2))
        m.cylinder((x + sx * R, y + 8.6, z), (x + sx * (R + 0.7), y + 8.6, z), 0.25, n=8)
    m.group(prefix + 'propellant', 'tank')
    for sz in (-1, 1):
        m.cylinder((x, y - 0.6, z + sz * 3.4), (x, y - 7.2, z + sz * 3.4), 1.55, n=28)
    m.group(prefix + 'truss', 'truss')
    m.cylinder((x, y, z), (x, y - 8.0, z), 0.9, n=12)
    m.group(prefix + 'engine', 'engine')
    m.cylinder((x, y - 8.0, z), (x, y - 10.4, z), 0.9, 1.7, n=24)
    if own:
        human(m, at=(x + 5, y - 10.4, z))
    return m


def stack():
    """The assembled stack as it leaves Earth orbit: Hesperus on top of a spine,
    the folded airship in its aeroshell, Vesper at the bottom."""
    m = Mesh('assembled_stack')
    m.group('spine', 'truss')
    m.cylinder((0, -30, 0), (0, 14, 0), 0.75, n=12)
    hesperus(m, at=(0, 2, 0), prefix='hesperus_')
    m.group('aeroshell', 'shell')
    m.cylinder((0, -14.5, 0), (0, -23.5, 0), 6.4, 3.2, n=40)     # blunt cone, airship folded inside
    m.cylinder((0, -14.5, 0), (0, -13.6, 0), 6.4, 6.0, n=40)
    m.group('shell_backplate', 'gondola')
    m.cylinder((0, -13.6, 0), (0, -12.9, 0), 6.0, 5.4, n=40)
    vesper(m, at=(0, -46, 0), prefix='vesper_')
    m.group('vesper_mount', 'truss')
    m.cylinder((0, -30, 0), (0, -26, 0), 1.8, 0.75, n=12)
    human(m, at=(9, -47.6, 0))
    return m


def write(mesh):
    os.makedirs(OUT_MODELS, exist_ok=True)
    with open(os.path.join(OUT_MODELS, mesh.name + '.obj'), 'w') as f:
        f.write(mesh.obj())
    with open(os.path.join(OUT_MODELS, mesh.name + '.mtl'), 'w') as f:
        f.write(mtl_text())
    lo, hi = mesh.bounds()
    return {'name': mesh.name, 'verts': len(mesh.v),
            'tris': sum(len(g[2]) for g in mesh.groups),
            'size_m': [round(hi[k] - lo[k], 1) for k in range(3)]}


if __name__ == '__main__':
    meshes = [airship(), hesperus(), vesper(), stack()]
    manifest = [write(mm) for mm in meshes]
    for row in manifest:
        print('%-28s %6d verts %7d tris  %s m' % (row['name'], row['verts'], row['tris'], row['size_m']))

    # the same geometry for the web viewer, no fetch required
    with open(OUT_JS, 'w') as f:
        f.write('/* Generated by scripts/build_models.py — do not edit by hand.\n')
        f.write('   OBJ text for each vehicle, meters, Y up. The .obj/.mtl design\n')
        f.write('   files in models/ are produced by the same run. */\n\n')
        f.write('var PHOS = (window.PHOS = window.PHOS || {});\n')
        f.write('PHOS.MODEL_MATERIALS = ' + json.dumps(
            {k: {'rgb': v['rgb'], 'alpha': v['alpha']} for k, v in MATERIALS.items()}) + ';\n')
        f.write('PHOS.MODELS = {\n')
        for mm in meshes:
            f.write('  %s: %s,\n' % (json.dumps(mm.name), json.dumps(mm.obj())))
        f.write('};\n')
    print('wrote', os.path.relpath(OUT_JS, ROOT), '(%.0f KB)' % (os.path.getsize(OUT_JS) / 1024))
