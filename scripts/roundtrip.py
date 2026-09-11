"""Round-trip Earth->Venus->Earth search with a fixed atmospheric stay."""
import math
from datetime import date, timedelta
from porkchop import planet_state, lambert, jd_from_date, norm, DAY

MU_E = 398600.4418
R_E = 6378.0
PARK = 400.0  # km LEO parking orbit


def leo_departure_dv(c3):
    """dV from a 400 km circular LEO to a hyperbola of given C3 (km^2/s^2)."""
    rp = R_E + PARK
    v_circ = math.sqrt(MU_E / rp)
    v_hyp = math.sqrt(c3 + 2 * MU_E / rp)
    return v_hyp - v_circ


def leg(depart, arrive, p_from, p_to):
    jd1, jd2 = jd_from_date(depart), jd_from_date(arrive)
    r1, v1p = planet_state(p_from, jd1)
    r2, v2p = planet_state(p_to, jd2)
    sol = lambert(r1, r2, (jd2 - jd1) * DAY)
    if not sol:
        return None
    vd, va = sol
    vinf_d = norm([vd[k] - v1p[k] for k in range(3)])
    vinf_a = norm([va[k] - v2p[k] for k in range(3)])
    return vinf_d, vinf_a


def best_leg(dep_range, tof_range, p_from, p_to, cap_d=9.0, cap_a=9.0):
    best = None
    for dd in dep_range:
        for tof in tof_range:
            res = leg(dd, dd + timedelta(days=tof), p_from, p_to)
            if not res:
                continue
            vd, va = res
            if vd > cap_d or va > cap_a:
                continue
            score = vd ** 2 + 0.35 * va ** 2
            if best is None or score < best[0]:
                best = (score, dd, tof, vd, va)
    return best


def daterange(a, b, step=2):
    out = []
    d = a
    while d <= b:
        out.append(d)
        d += timedelta(days=step)
    return out


OUTBOUND_WINDOWS = [
    (date(2038, 11, 1), date(2039, 8, 1)),
    (date(2040, 9, 1), date(2041, 4, 1)),
    (date(2042, 3, 1), date(2042, 11, 1)),
    (date(2044, 1, 1), date(2044, 6, 1)),
    (date(2045, 8, 1), date(2046, 1, 1)),
    (date(2047, 2, 1), date(2047, 8, 1)),
]

for lo, hi in OUTBOUND_WINDOWS:
    # crew leg: keep transit short
    ob = best_leg(daterange(lo, hi, 2), range(100, 145, 3), 'earth', 'venus')
    if not ob:
        print(f"{lo}: no outbound")
        continue
    _, dep, tof, vinf_d, vinf_a = ob
    arr = dep + timedelta(days=tof)
    c3 = vinf_d ** 2
    print(f"\n=== OUTBOUND dep {dep}  arr {arr}  TOF {tof}d  C3 {c3:.2f}  "
          f"Vinf_arr {vinf_a:.2f} km/s  dV(LEO->TVI) {leo_departure_dv(c3):.3f} km/s")
    for stay in (30, 45, 60, 90, 120):
        vd_start = arr + timedelta(days=stay)
        rb = best_leg(daterange(vd_start, vd_start + timedelta(days=300), 3),
                      range(110, 320, 5), 'venus', 'earth')
        if not rb:
            print(f"   stay {stay:>3}d: none")
            continue
        _, rdep, rtof, rvd, rva = rb
        rarr = rdep + timedelta(days=rtof)
        total = (rarr - dep).days
        loiter = (rdep - arr).days
        print(f"   stay>={stay:>3}d: Venus dep {rdep} (loiter {loiter}d) TOF {rtof}d "
              f"Earth arr {rarr} | Vinf_dep {rvd:.2f} Vinf_Earth {rva:.2f} | TOTAL {total}d")
