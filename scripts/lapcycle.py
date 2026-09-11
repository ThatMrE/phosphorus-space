"""Lap period, night length and energy storage across the float band.

The airship does not fly; it is carried by the super-rotating atmosphere.
How long a "day" lasts aboard is therefore set by float altitude, because
wind speed varies with altitude. Venus' own retrograde rotation runs the
same way as the wind, so the two rates add and the solar cycle is slightly
shorter than the lap measured against the surface.
"""
import math

R_VENUS = 6051.8          # km
SOLAR_DAY = 116.75        # Earth days, Venus' own sun-relative rotation
HAB_LOAD_KW = 8.0         # assumed average habitat electrical load

# (altitude km, zonal wind m/s) across the usable float band
BAND = [(50, 60), (51, 67), (52, 75), (53, 82), (54, 90), (55, 95)]


def lap(alt_km, wind_ms):
    circumference_km = 2 * math.pi * (R_VENUS + alt_km)
    # period relative to the surface
    t_surface = circumference_km * 1000 / wind_ms / 86400.0
    # wind and planetary rotation are both westward, so the rates add
    t_sun = 1.0 / (1.0 / SOLAR_DAY + 1.0 / t_surface)
    return circumference_km, t_surface, t_sun


if __name__ == '__main__':
    print(f"{'alt':>5} {'wind':>6} {'circumference':>15} {'lap/surface':>12} "
          f"{'lap/Sun':>9} {'night':>8} {'storage':>10}")
    for alt, wind in BAND:
        c, ts, tsun = lap(alt, wind)
        night_h = tsun * 24 / 2
        print(f"{alt:>3} km {wind:>4} m/s {c:>12,.0f} km {ts:>10.2f} d "
              f"{tsun:>7.2f} d {night_h:>6.1f} h {HAB_LOAD_KW * night_h:>8,.0f} kWh")

    lo = lap(*BAND[0])[2] * 24 / 2
    hi = lap(*BAND[-1])[2] * 24 / 2
    print(f"\nnight across the band: {hi:.0f} – {lo:.0f} hours")
    print(f"laps in a 30-day stay: {30 / lap(*BAND[0])[2]:.1f} – {30 / lap(*BAND[-1])[2]:.1f}")
    print("\nThe crew chooses the length of their day by choosing altitude:")
    print("  low  -> more lift, slower lap, longer night, more battery")
    print("  high -> less lift, faster lap, shorter night, less battery")
