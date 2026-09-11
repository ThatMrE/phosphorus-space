import math
from datetime import date, timedelta
import porkchop as pk
from porkchop import planet_state, lambert, jd_from_date, norm, DAY
from roundtrip import leo_departure_dv, daterange

# add Mars
pk.ELEMENTS['mars'] = (
    (1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891),
    (0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343),
)

MU = {'earth': 398600.4418, 'venus': 324858.6, 'mars': 42828.37}
RAD = {'earth': 6378.0, 'venus': 6051.8, 'mars': 3389.5}
PARK = {'earth': 400.0, 'venus': 300.0, 'mars': 300.0}


def esc_dv(body, vinf):
    rp = RAD[body] + PARK[body]
    return math.sqrt(vinf ** 2 + 2 * MU[body] / rp) - math.sqrt(MU[body] / rp)


def entry_v(body, vinf, alt):
    rp = RAD[body] + alt
    return math.sqrt(vinf ** 2 + 2 * MU[body] / rp)


def leg(d1, d2, pf, pt):
    jd1, jd2 = jd_from_date(d1), jd_from_date(d2)
    r1, v1p = planet_state(pf, jd1)
    r2, v2p = planet_state(pt, jd2)
    s = lambert(r1, r2, (jd2 - jd1) * DAY)
    if not s:
        return None
    vd, va = s
    return (norm([vd[k] - v1p[k] for k in range(3)]),
            norm([va[k] - v2p[k] for k in range(3)]))


def best(dep_rng, tofs, pf, pt, cap_d=12.0, cap_a=12.0, w=0.35):
    b = None
    for dd in dep_rng:
        for t in tofs:
            r = leg(dd, dd + timedelta(days=t), pf, pt)
            if not r:
                continue
            vd, va = r
            if vd > cap_d or va > cap_a:
                continue
            s = vd ** 2 + w * va ** 2
            if b is None or s < b[0]:
                b = (s, dd, t, vd, va)
    return b


print("#### VENUS REFERENCE MISSION — 2042 opportunity, return-leg trade")
dep = date(2042, 7, 27)
ob = leg(dep, date(2042, 11, 28), 'earth', 'venus')
print(f"Outbound {dep} -> 2042-11-28 (124d): C3={ob[0]**2:.2f}, dV_TVI={leo_departure_dv(ob[0]**2):.3f} km/s, "
      f"Venus Vinf={ob[1]:.2f}, entry V @125km={entry_v('venus', ob[1], 125):.2f} km/s")
arr = date(2042, 11, 28)
for cap in (9.5, 8.0, 7.0, 6.0, 5.5):
    b = best(daterange(arr + timedelta(days=28), arr + timedelta(days=500), 3),
             range(110, 460, 5), 'venus', 'earth', cap_d=9.0, cap_a=cap, w=0.0)
    if not b:
        print(f"  Earth Vinf cap {cap}: none")
        continue
    _, rd, t, vd, va = b
    ra = rd + timedelta(days=t)
    print(f"  cap {cap:>4}: Venus dep {rd} (stay {(rd-arr).days}d) TOF {t}d Earth arr {ra} "
          f"| dV_TEI={esc_dv('venus', vd):.2f} km/s | Earth Vinf {va:.2f} -> entry "
          f"{entry_v('earth', va, 125):.2f} km/s | TOTAL {(ra-dep).days}d")

print("\n#### MARS SHORT-STAY (opposition class) 2039-2046, same method")
for lo, hi in [(date(2039, 1, 1), date(2039, 12, 31)),
               (date(2041, 3, 1), date(2042, 3, 1)),
               (date(2043, 5, 1), date(2044, 5, 1)),
               (date(2045, 7, 1), date(2046, 7, 1))]:
    ob = best(daterange(lo, hi, 4), range(150, 340, 10), 'earth', 'mars', cap_d=6.5, cap_a=8.0)
    if not ob:
        print(f"{lo}: none")
        continue
    _, d, t, vd, va = ob
    a = d + timedelta(days=t)
    for stay in (30, 60):
        rb = best(daterange(a + timedelta(days=stay), a + timedelta(days=stay + 400), 5),
                  range(150, 460, 10), 'mars', 'earth', cap_d=9.0, cap_a=12.0)
        if not rb:
            continue
        _, rd, rt, rvd, rva = rb
        ra = rd + timedelta(days=rt)
        print(f"  dep {d} arr {a} ({t}d) C3={vd**2:.1f} dV_TMI={leo_departure_dv(vd**2):.2f} "
              f"| stay>={stay}d -> Mars dep {rd} ({(rd-a).days}d) TOF {rt}d Earth arr {ra} "
              f"| Earth Vinf {rva:.2f} | TOTAL {(ra-d).days}d")
        break

print("\n#### MARS CONJUNCTION CLASS (long stay) 2041")
ob = best(daterange(date(2041, 5, 1), date(2042, 2, 1), 4), range(180, 340, 10), 'earth', 'mars', cap_d=6.0)
_, d, t, vd, va = ob
a = d + timedelta(days=t)
rb = best(daterange(a + timedelta(days=400), a + timedelta(days=650), 5), range(180, 340, 10), 'mars', 'earth', cap_d=6.0)
_, rd, rt, rvd, rva = rb
ra = rd + timedelta(days=rt)
print(f"  dep {d} arr {a} ({t}d) C3={vd**2:.1f} | Mars dep {rd} (surface {(rd-a).days}d) "
      f"TOF {rt}d Earth arr {ra} | TOTAL {(ra-d).days}d")

print("\n#### BUOYANCY / ATMOSPHERE")
R = 8.31446
M_V = 0.965 * 44.010 + 0.035 * 28.014
M_AIR = 0.2095 * 31.998 + 0.7808 * 28.014 + 0.0097 * 39.948
print(f"  mean molar mass: Venus atm {M_V*1000:.2f} g/mol | breathable air {M_AIR*1000:.2f} g/mol")
for alt, T, P in [(45, 385.0, 1.979e5), (50, 348.0, 1.066e5), (52, 333.0, 8.28e4),
                  (55, 300.0, 5.31e4), (60, 263.0, 2.36e4), (65, 243.0, 9.85e3)]:
    rho_amb = P * M_V / 1000 / (R * T)
    rho_air = P * M_AIR / 1000 / (R * T)
    rho_he = P * 0.0040026 / (R * T)
    print(f"  {alt:>3} km  T={T:>5.1f}K ({T-273.15:>6.1f}C)  P={P/1.01325e5:>5.3f} atm  "
          f"rho={rho_amb:>5.3f}  lift(air)={rho_amb-rho_air:>5.3f}  lift(He)={rho_amb-rho_he:>5.3f} kg/m3")

print("\n#### ENVELOPE SIZING at 50 km (gross lift required vs volume)")
for m in (20e3, 40e3, 70e3, 100e3):
    for gas, sl in (('air', 0.541), ('He', 1.499)):
        V = m / sl
        # prolate spheroid, fineness 3.8
        L = (6 * V * 3.8 ** 2 / math.pi) ** (1 / 3)
        print(f"  {m/1000:>5.0f} t on {gas:>3}: V={V:>9,.0f} m3  L={L:>6.1f} m  d={L/3.8:>5.1f} m")
