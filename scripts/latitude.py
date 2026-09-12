"""Does a higher latitude help the airship stay in the sun?

Extends sunchase.py with three things it leaves out:

  1. sun height: Venus tilts 2.64 deg, so at latitude L the noon sun sits
     (90 - L) deg above the horizon, give or take the season, and the sun's
     ground track slows as cos(L);
  2. light through the cloud: the ship floats under ~15 km of cloud. For a
     thick scattering layer the flux that gets down scales as
     mu0 * H(mu0), H ~ 1 + 2 mu0 (Chandrasekhar, conservative scattering),
     not as a clear-sky cosine — grazing sun is scattered back to space;
  3. the polar vortex: the zonal wind goes to zero at the pole only on
     paper. The vortex eye sits ~2.5 deg off the pole and wanders, and
     turns once every ~4 Earth days at the float level, so the air over
     the pole itself still moves.

For each latitude it asks: what is the largest share of the stay that can
be spent in daylight while the solar array still pays for the propellers
and the habitat? Output is the PHOS.LATITUDE block for data.js (--js).
"""
import math
import sys
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from sunchase import (R_VENUS, SOLAR_DAY, HAB_LOAD_KW, ARRAY_M2, FLUX_NOON,
                      CELL_EFF, BAND, NIGHT_KM, prop_kw, zonal_wind)

OBLIQUITY = 2.64          # deg
VORTEX_PERIOD_D = 4.0     # solid-body turn of the polar vortex at 52 km
VORTEX_OFFSET = 2.5       # deg between vortex eye and the geographic pole
ARRAY_KW_PEAK = ARRAY_M2 * FLUX_NOON * CELL_EFF / 1000.0   # 210 kW, equator noon


def sun_ground(alt_km, lat):
    return 2 * math.pi * (R_VENUS + alt_km) * 1000 * math.cos(math.radians(lat)) / (SOLAR_DAY * 86400)


def wind(lat, alt_km):
    """Zonal super-rotation, floored by the polar vortex's own turning."""
    v_eq = next(b for b in BAND if b[0] == alt_km)[1]
    zonal = zonal_wind(lat, v_eq)
    r_km = ((90 - lat) + VORTEX_OFFSET) * math.pi / 180 * (R_VENUS + alt_km)
    vortex = 2 * math.pi * r_km * 1000 / (VORTEX_PERIOD_D * 86400) * (v_eq / 75.0)
    return max(zonal, vortex) if lat > 50 else zonal


def mu0(lat, hour_angle, decl=0.0):
    L, d, H = map(math.radians, (lat, decl, hour_angle))
    return math.sin(L) * math.sin(d) + math.cos(L) * math.cos(d) * math.cos(H)


def light(m):
    """Flux under the cloud relative to an overhead sun."""
    if m <= 0:
        return 0.0
    return m * (1 + 2 * m) / 3.0


def day_light(lat, decl=0.0, n=180):
    """Mean of light() across the sunlit half, dawn to dusk."""
    tot = 0.0
    for i in range(n):
        tot += light(mu0(lat, -90 + 180 * (i + 0.5) / n, decl))
    return tot / n


def lap(lat, u, decl=0.0, day_km=52):
    """One sun-chasing lap at this latitude: fly upwind at u m/s by day
    at day_km, coast the night at NIGHT_KM. Returns the day share and
    the lap-average power in and out."""
    rho = next(b for b in BAND if b[0] == day_km)[2]
    w_day, w_night = wind(lat, day_km), wind(lat, NIGHT_KM)
    s = sun_ground(day_km, lat)
    half = math.pi * (R_VENUS + day_km) * 1000 * math.cos(math.radians(lat))
    rel = (w_day - u) + s                    # closing speed on the sun, day
    if rel <= 0:                             # holding station under the sun
        day_h, night_h, share = float('inf'), 0.0, 1.0
        arr = ARRAY_KW_PEAK * light(mu0(lat, 0, decl))
    else:
        day_h = half / rel / 3600
        night_h = half / (w_night + s) / 3600
        share = day_h / (day_h + night_h)
        arr = ARRAY_KW_PEAK * day_light(lat, decl) * share
    need = HAB_LOAD_KW + prop_kw(rho, u) * share
    return {'share': share, 'dayH': day_h, 'nightH': night_h, 'arrayKw': arr,
            'needKw': need, 'propKw': prop_kw(rho, u), 'wind': w_day}


def best(lat, decl=0.0):
    """Largest daylight share whose lap still closes on power."""
    top = None
    for u10 in range(0, 801):
        u = u10 / 10.0
        r = lap(lat, u, decl)
        if r['arrayKw'] >= r['needKw'] and (top is None or r['share'] > top['share']):
            top = dict(r, u=u)
        if u >= r['wind']:
            break
    return top


LATS = (0, 20, 40, 50, 60, 70, 75, 80, 85, 88, 90)

if __name__ == '__main__':
    rows = []
    for L in LATS:
        w = wind(L, 52)
        noon = 90 - L
        b = best(L)
        hold = lap(L, max(w - sun_ground(52, L), 0))
        rows.append({
            'lat': L, 'wind': round(w), 'noonDeg': noon,
            'noonLight': round(100 * light(mu0(L, 0))),
            'dayLight': round(100 * day_light(L)),
            'holdKw': round(hold['propKw']), 'holdArrayKw': round(hold['arrayKw']),
            'bestPct': round(100 * b['share']) if b else 0,
            'bestU': b['u'] if b else None,
            'bestArrayKw': round(b['arrayKw']) if b else 0,
            'bestNeedKw': round(b['needKw']) if b else 0,
            'chase10': lap(L, 10),
        })

    if '--js' in sys.argv:
        print('PHOS.LATITUDE = [')
        for r in rows:
            c = r['chase10']
            print("  { lat: %2d, wind: %2d, noonDeg: %2d, noonLight: %3d, dayLight: %3d, holdKw: %8d, holdArrayKw: %3d, "
                  "bestPct: %3d, bestU: %4s, bestArrayKw: %3d, bestNeedKw: %3d, chase10Pct: %3d, chase10ArrayKw: %3d, chase10NeedKw: %3d },"
                  % (r['lat'], r['wind'], r['noonDeg'], r['noonLight'], r['dayLight'], r['holdKw'], r['holdArrayKw'],
                     r['bestPct'], ('%.1f' % r['bestU']) if r['bestU'] is not None else 'null', r['bestArrayKw'], r['bestNeedKw'],
                     round(100 * c['share']), round(c['arrayKw']), round(c['needKw'])))
        print('];')
        sys.exit(0)

    print('by latitude at 52 km (night at %d km), sun on the equator (declination 0)\n' % NIGHT_KM)
    print(f"{'lat':>4} {'wind':>5} {'noon':>5} {'light':>6} {'dayavg':>7} | {'hold kW':>9} {'array':>6} | {'best sun':>8} {'u':>5} {'array':>6} {'need':>5} | {'u=10 sun':>8} {'array':>6} {'need':>5}")
    for r in rows:
        c = r['chase10']
        print(f"{r['lat']:>4} {r['wind']:>5} {r['noonDeg']:>4}° {r['noonLight']:>5}% {r['dayLight']:>6}% | "
              f"{r['holdKw']:>9,} {r['holdArrayKw']:>6} | {r['bestPct']:>7}% {str(r['bestU']):>5} {r['bestArrayKw']:>6} {r['bestNeedKw']:>5} | "
              f"{round(100*c['share']):>7}% {round(c['arrayKw']):>6} {round(c['needKw']):>5}")
    print('\nseason: the noon sun swings +/-%.1f deg over the Venus year (225 d); poleward of %.1f deg it sets for half of it.'
          % (OBLIQUITY, 90 - OBLIQUITY))
    for L in (80, 85, 90):
        hi, lo = best(L, OBLIQUITY), best(L, -OBLIQUITY)
        print('  %2d deg: midsummer best %s%%, midwinter %s%%' % (L, round(100 * hi['share']) if hi else 0, round(100 * lo['share']) if lo else 0))
