"""Earth->Venus transfer opportunity search, 2030-2050.

Planet states from JPL "Approximate Positions of the Planets" Keplerian
elements + rates (valid 1800-2050, accuracy ~ arcminutes -> good to a day or
two on window dates). Lambert solved with universal variables (Bate/Mueller
/ Vallado formulation). Patched conic: C3 = |v_dep - v_Earth|^2,
Vinf_arr = |v_arr - v_Venus|.
"""
import math
from datetime import date, timedelta

MU_SUN = 1.32712440018e11  # km^3/s^2
AU = 1.495978707e8         # km
DAY = 86400.0

# a(au), e, I(deg), L(deg), longperi(deg), longnode(deg) at J2000 + rates/century
ELEMENTS = {
    'earth': (
        (1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0),
        (0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0),
    ),
    'venus': (
        (0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255),
        (0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418),
    ),
}


def jd_from_date(d):
    a = (14 - d.month) // 12
    y = d.year + 4800 - a
    m = d.month + 12 * a - 3
    jdn = d.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    return jdn - 0.5  # 00:00 UT


def kepler_E(M, e):
    E = M + e * math.sin(M)
    for _ in range(80):
        dE = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
        E -= dE
        if abs(dE) < 1e-13:
            break
    return E


def planet_state(name, jd):
    """Heliocentric position (km) and velocity (km/s), J2000 ecliptic."""
    (a0, e0, i0, L0, wb0, om0), (da, de, di, dL, dwb, dom) = ELEMENTS[name]
    T = (jd - 2451545.0) / 36525.0
    a = (a0 + da * T) * AU
    e = e0 + de * T
    inc = math.radians(i0 + di * T)
    L = math.radians(L0 + dL * T)
    wb = math.radians(wb0 + dwb * T)
    om = math.radians(om0 + dom * T)
    w = wb - om
    M = (L - wb) % (2 * math.pi)
    E = kepler_E(M, e)
    # perifocal
    xp = a * (math.cos(E) - e)
    yp = a * math.sqrt(1 - e * e) * math.sin(E)
    n = math.sqrt(MU_SUN / a ** 3)
    Edot = n / (1 - e * math.cos(E))
    vxp = -a * math.sin(E) * Edot
    vyp = a * math.sqrt(1 - e * e) * math.cos(E) * Edot

    cw, sw = math.cos(w), math.sin(w)
    co, so = math.cos(om), math.sin(om)
    ci, si = math.cos(inc), math.sin(inc)
    R = [
        [co * cw - so * sw * ci, -co * sw - so * cw * ci, so * si],
        [so * cw + co * sw * ci, -so * sw + co * cw * ci, -co * si],
        [sw * si, cw * si, ci],
    ]
    r = [R[k][0] * xp + R[k][1] * yp for k in range(3)]
    v = [R[k][0] * vxp + R[k][1] * vyp for k in range(3)]
    return r, v


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(dot(a, a))


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def stumpff_C(z):
    if z > 1e-6:
        return (1 - math.cos(math.sqrt(z))) / z
    if z < -1e-6:
        return (math.cosh(math.sqrt(-z)) - 1) / (-z)
    return 0.5 - z / 24.0 + z * z / 720.0


def stumpff_S(z):
    if z > 1e-6:
        s = math.sqrt(z)
        return (s - math.sin(s)) / (s ** 3)
    if z < -1e-6:
        s = math.sqrt(-z)
        return (math.sinh(s) - s) / (s ** 3)
    return 1 / 6.0 - z / 120.0 + z * z / 5040.0


def lambert(r1, r2, tof, prograde=True):
    """Universal-variable Lambert. tof in seconds. Returns (v1, v2) or None."""
    R1, R2 = norm(r1), norm(r2)
    c = cross(r1, r2)
    cosdnu = max(-1.0, min(1.0, dot(r1, r2) / (R1 * R2)))
    dnu = math.acos(cosdnu)
    if prograde:
        if c[2] < 0:
            dnu = 2 * math.pi - dnu
    else:
        if c[2] >= 0:
            dnu = 2 * math.pi - dnu
    A = math.sin(dnu) * math.sqrt(R1 * R2 / (1 - cosdnu)) if abs(1 - cosdnu) > 1e-12 else 0.0
    if A == 0.0:
        return None

    def F(z):
        C, S = stumpff_C(z), stumpff_S(z)
        if C <= 0:
            return None
        y = R1 + R2 + A * (z * S - 1) / math.sqrt(C)
        if y < 0:
            return None
        x = math.sqrt(y / C)
        return (x ** 3 * S + A * math.sqrt(y)) / math.sqrt(MU_SUN) - tof

    lo, hi = -4 * math.pi ** 2 + 1e-6, 4 * math.pi ** 2
    flo = F(lo)
    # bracket
    z = None
    prev_z, prev_f = None, None
    steps = 800
    for k in range(steps + 1):
        zz = lo + (hi - lo) * k / steps
        f = F(zz)
        if f is None:
            prev_z, prev_f = None, None
            continue
        if prev_f is not None and prev_f * f <= 0:
            a_, b_ = prev_z, zz
            fa = prev_f
            for _ in range(200):
                m = 0.5 * (a_ + b_)
                fm = F(m)
                if fm is None:
                    break
                if fa * fm <= 0:
                    b_ = m
                else:
                    a_, fa = m, fm
                if abs(b_ - a_) < 1e-12:
                    break
            z = 0.5 * (a_ + b_)
            break
        prev_z, prev_f = zz, f
    if z is None:
        return None
    C, S = stumpff_C(z), stumpff_S(z)
    y = R1 + R2 + A * (z * S - 1) / math.sqrt(C)
    f = 1 - y / R1
    g = A * math.sqrt(y / MU_SUN)
    gdot = 1 - y / R2
    v1 = [(r2[k] - f * r1[k]) / g for k in range(3)]
    v2 = [(gdot * r2[k] - r1[k]) / g for k in range(3)]
    return v1, v2


def scan(start_year=2030, end_year=2050, tof_lo=90, tof_hi=200, step=2):
    d0 = date(start_year, 1, 1)
    d1 = date(end_year, 12, 31)
    results = []
    d = d0
    while d <= d1:
        jd1 = jd_from_date(d)
        r1, v1p = planet_state('earth', jd1)
        best = None
        for tof in range(tof_lo, tof_hi + 1, 2):
            jd2 = jd1 + tof
            r2, v2p = planet_state('venus', jd2)
            sol = lambert(r1, r2, tof * DAY)
            if not sol:
                continue
            vd, va = sol
            c3 = sum((vd[k] - v1p[k]) ** 2 for k in range(3))
            vinf = norm([va[k] - v2p[k] for k in range(3)])
            if c3 > 40 or vinf > 8.0:
                continue
            # cost proxy: departure energy dominates; arrival handled by aerocapture
            score = c3 + 0.6 * vinf ** 2
            if best is None or score < best[0]:
                best = (score, tof, c3, vinf)
        if best:
            results.append((d, best[1], best[2], best[3], best[0]))
        d += timedelta(days=step)
    return results


def group_windows(results, gap_days=60):
    windows = []
    cur = []
    for row in results:
        if cur and (row[0] - cur[-1][0]).days > gap_days:
            windows.append(cur)
            cur = []
        cur.append(row)
    if cur:
        windows.append(cur)
    return windows


if __name__ == '__main__':
    res = scan()
    for w in group_windows(res):
        best = min(w, key=lambda r: r[4])
        d, tof, c3, vinf, _ = best
        arr = d + timedelta(days=tof)
        # window extent at a practical C3 cap
        cap = [r for r in w if r[2] <= min(20.0, c3 + 8.0)]
        if not cap:
            cap = w
        print(f"{w[0][0]} .. {w[-1][0]}  | OPEN {cap[0][0]} -> {cap[-1][0]} ({(cap[-1][0]-cap[0][0]).days}d) "
              f"| BEST dep {d} arr {arr} TOF {tof}d  C3 {c3:.2f} km2/s2  Vinf {vinf:.2f} km/s")
