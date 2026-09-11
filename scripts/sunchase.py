"""Chasing the sun: how much of the stay can be spent in daylight.

The airship cannot hold still under the sun — the super-rotating wind at
float altitude runs 60–95 m/s and the sun's own footprint moves at 3.8 m/s,
so station-keeping means flying ~70 m/s upwind, and drag goes as the cube
of speed. What it can do is bend the cycle: fly upwind at a modest airspeed
on the day side, where the solar array has surplus power, and climb into the
fastest air at night to cross the dark side quickly.

Two outputs:
  1. the sun-chasing cycle for each day-side float altitude and airspeed
     (night is always coasted at the top of the band, 55 km);
  2. the station-keeping budget by latitude, i.e. why "just park under the
     sun" does not close anywhere the sun is worth having.

Run with --js to emit the PHOS.SUNCHASE / PHOS.SUNKEEP blocks for data.js.
"""
import math
import sys

R_VENUS = 6051.8          # km
SOLAR_DAY = 116.75        # Earth days, Venus' sun-relative rotation
HAB_LOAD_KW = 8.0         # average habitat electrical load through the night

# hull: 129 m x 34 m ellipsoid; drag on frontal area, whole ship incl. gondola
FRONTAL_M2 = math.pi * 17.0 ** 2
CD = 0.08                 # frontal-area drag coefficient, fineness ~3.8
ETA = 0.72                # electric motor + propeller
ARRAY_M2 = 1000.0         # thin-film solar on the upper hull
FLUX_NOON = 1400.0        # W/m^2 reaching 52 km near the equator (~1.4x Earth surface)
CELL_EFF = 0.15           # thin film, diffuse spectrum

# (altitude km, zonal wind m/s, density kg/m^3, helium lift t) across the float band
BAND = [(50, 60, 1.601, 66.8), (51, 67, 1.45, 61.8), (52, 75, 1.299, 54.3),
        (53, 82, 1.18, 49.0), (54, 90, 1.056, 44.1), (55, 95, 0.925, 38.6)]
NIGHT_KM = 55             # coast the night at the top of the band
AIRSPEEDS = (0, 5, 10, 15)


def sun_ground_ms(alt_km, lat_deg=0.0):
    """How fast the sub-solar point moves over the ground at this latitude."""
    return 2 * math.pi * (R_VENUS + alt_km) * 1000 / (SOLAR_DAY * 86400) * math.cos(math.radians(lat_deg))


def half_pass_hours(alt_km, ground_speed_ms):
    """Hours to cross one hemisphere, measured against the sun."""
    half = math.pi * (R_VENUS + alt_km) * 1000
    return half / (ground_speed_ms + sun_ground_ms(alt_km)) / 3600.0


def prop_kw(rho, airspeed_ms):
    return 0.5 * rho * airspeed_ms ** 3 * CD * FRONTAL_M2 / ETA / 1000.0


def cycle(day_alt, airspeed):
    km, wind, rho, lift = next(b for b in BAND if b[0] == day_alt)
    n_km, n_wind = NIGHT_KM, next(b for b in BAND if b[0] == NIGHT_KM)[1]
    day_h = half_pass_hours(km, wind - airspeed)       # upwind by day
    night_h = half_pass_hours(n_km, n_wind)            # coast at night
    return {
        'km': km, 'u': airspeed, 'wind': wind,
        'dayH': round(day_h, 1), 'nightH': round(night_h, 1),
        'lapDays': round((day_h + night_h) / 24, 2),
        'sunPct': round(100 * day_h / (day_h + night_h)),
        'propKw': round(prop_kw(rho, airspeed)),
        'storageKwh': round(HAB_LOAD_KW * night_h),
        'lift': lift
    }


def zonal_wind(lat_deg, v_eq):
    """Near-constant to 50 deg, then solid-body toward the pole
    (Venus Express cloud tracking, lower/middle cloud)."""
    if lat_deg <= 50:
        return v_eq
    return v_eq * math.cos(math.radians(lat_deg)) / math.cos(math.radians(50))


def station_keep(lat_deg, alt_km=52):
    km, wind_eq, rho, _ = next(b for b in BAND if b[0] == alt_km)
    wind = zonal_wind(lat_deg, wind_eq)
    need = max(wind - sun_ground_ms(km, lat_deg), 0)
    solar = ARRAY_M2 * FLUX_NOON * math.cos(math.radians(lat_deg)) * CELL_EFF / 1000.0
    return {'lat': lat_deg, 'wind': round(wind), 'airspeed': round(need),
            'propKw': round(prop_kw(rho, need)), 'solarKw': round(solar)}


LATS = (0, 30, 50, 60, 70, 75, 80, 85)

if __name__ == '__main__':
    rows = [cycle(alt, u) for alt, _, _, _ in BAND if alt < NIGHT_KM for u in AIRSPEEDS]
    keep = [station_keep(l) for l in LATS]

    if '--js' in sys.argv:
        print('PHOS.SUNCHASE = [')
        for r in rows:
            print("  { km: %d, u: %2d, wind: %d, dayH: %5.1f, nightH: %4.1f, lapDays: %4.2f, sunPct: %d, propKw: %3d, storageKwh: %d, lift: %.1f },"
                  % (r['km'], r['u'], r['wind'], r['dayH'], r['nightH'], r['lapDays'], r['sunPct'], r['propKw'], r['storageKwh'], r['lift']))
        print('];\n')
        print('PHOS.SUNKEEP = [')
        for k in keep:
            print("  { lat: %2d, wind: %2d, airspeed: %2d, propKw: %8d, solarKw: %3d }," % (k['lat'], k['wind'], k['airspeed'], k['propKw'], k['solarKw']))
        print('];')
        sys.exit(0)

    print('night coasted at %d km: %.1f h\n' % (NIGHT_KM, rows[0]['nightH']))
    print(f"{'day km':>6} {'air m/s':>8} {'day h':>7} {'night h':>8} {'lap d':>6} {'in sun':>7} {'props kW':>9} {'store kWh':>10}")
    for r in rows:
        print(f"{r['km']:>6} {r['u']:>8} {r['dayH']:>7.1f} {r['nightH']:>8.1f} {r['lapDays']:>6.2f} {r['sunPct']:>6d}% {r['propKw']:>9} {r['storageKwh']:>10}")
    print('\nstation-keeping under the sun at 52 km, by latitude')
    print(f"{'lat':>4} {'wind':>6} {'need m/s':>9} {'props kW':>10} {'array kW':>9}")
    for k in keep:
        print(f"{k['lat']:>4} {k['wind']:>6} {k['airspeed']:>9} {k['propKw']:>10,} {k['solarKw']:>9}")
