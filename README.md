# Project Phosphorus

A scroll-driven mission plan for a crewed floating habitat in the clouds of Venus —
told in three acts you fly by scrolling: getting ready in Earth orbit, the trip, and the
descent into the cloud band. With 3D models of the fleet you can turn by hand.

The site argues a specific case — that the cloud deck at 50–54 km is the most
habitable place off Earth, and that a crewed visit is shorter, cheaper and gentler
on a human body than the equivalent Mars mission — and then commits to a complete
architecture: a five-phase program, a dated flagship flight, four vehicles, an
envelope laminate, a crew of four, a cost breakdown, and a risk register that says
plainly what could kill it.

It is a response to Elliot Roth's
[*We're Going the Wrong Way: Why Venus is a Better Planet than Mars*](https://thatmre.medium.com/we-re-going-the-wrong-way-ca8fb1a8691a).

> **Phosphorus** (Φωσφόρος, "light-bringer") is the Greek name for Venus as the
> morning star. It is also element 15 — and, as the site notes, the one element a
> human needs that is *not* freely available in the Venusian atmosphere.

---

## The reference mission — Phosphorus 1

| | |
|---|---|
| Earth departure | **2042-07-27** · C₃ 7.08 km²/s² · ΔV 3.50 km/s from 400 km LEO |
| Outbound | 124 days |
| Venus arrival | **2042-11-28** · V∞ 4.71 km/s · 11.29 km/s at the entry interface |
| Aloft | 30 days at 50–54 km, 2 of 4 crew |
| Venus departure | **2042-12-28** |
| Return | 305 days, swinging out to 1.32 AU |
| Earth arrival | **2043-10-29** · V∞ 8.67 km/s · **14.06 km/s entry** |
| **Total** | **459 days** |

The same solver, run against Mars over the same epochs, returns **990 days** for a
short-stay round trip and **1 020** for a conjunction-class one.

Backup opportunity: depart 2045-10-24, home 2047-01-06 — 439 days, the shortest
round trip of the decade.

---

## Everything on the page is computed, not quoted

`scripts/` contains the Python that produced every trajectory, buoyancy and
shielding number the site displays. It is dependency-free — standard library only,
no NumPy — and reproduces in a few minutes.

```bash
cd scripts
python3 porkchop.py          # Earth→Venus departure opportunities, 2030–2050
python3 roundtrip.py         # round-trip itineraries with a fixed atmospheric stay
python3 compare.py           # Venus vs Mars, buoyancy table, envelope sizing
python3 export_trajectory.py # regenerates assets/trajectory.js for the orbit plot
python3 lapcycle.py          # what the lap and night would be if the ship only drifted
python3 sunchase.py          # the sun-chasing cycle, and why parking under the sun does not close
python3 stamp_assets.py      # re-hash the asset URLs in index.html (Netlify runs this on deploy)
```

**Method.** Planet states come from JPL's *Approximate Positions of the Planets*
Keplerian elements plus rates (valid 1800–2050). Transfers are solved with a
universal-variable Lambert solver (Bate–Mueller–White / Vallado formulation),
bracketed and bisected on the Stumpff parameter *z*. Patched conic throughout:
C₃ = |**v**<sub>dep</sub> − **v**<sub>planet</sub>|², and V∞ likewise on arrival.
Departure ΔV assumes a 400 km circular parking orbit. The orbit plot in
`assets/trajectory.js` is the Lambert solution itself, propagated with an f/g
two-body propagator and sampled every two days — not a drawn curve.

**What the method does not include:** finite-burn losses, plane-change cost at
Venus's 3.39° inclination, navigation margin, or launch-period padding. Real
mission design would add several hundred m/s. The relative Venus-versus-Mars
comparison is unaffected because both were run identically.

**Atmosphere.** The profile in `assets/data.js` is VIRA-consistent. Derived
columns:

- *lift* = ρ<sub>ambient</sub> − ρ<sub>lift gas</sub> at the same T and P, with mean
  molar masses 43.45 g/mol (Venus), 28.96 (breathable air), 4.00 (helium).
- *shielding* = P / g, the mass of atmosphere overhead per unit area, in g/cm².
  Earth at sea level is 1 033 g/cm²; Venus at 50 km is **1 202**; Mars at the
  surface is 21. Note that Venus has no magnetic field, so this is column density
  only — Earth's geomagnetic cutoff is additional protection Venus does not have.

**Chasing the sun.** The airship is carried by the super-rotating atmosphere;
left to drift it would lap Venus every 4.5–7.0 days and spend 54–83 hours of
every lap in the dark (`lapcycle.py`). It cannot hold still under the sun: the
wind at 52 km is 75 m/s, the sub-solar point moves at only 3.8 m/s, and drag on
a 34 m hull goes as the cube of airspeed, so station-keeping at the equator
would take ~24 MW. What it can do is bend the cycle (`sunchase.py`): by day it
floats at 51 km and flies 10 m/s upwind on solar surplus (~73 kW), and at
sunset it climbs to 55 km and coasts across the night on the fastest air. That
gives an **88-hour day and a 54-hour night — 62% of the stay in daylight** —
and at an 8 kW habitat load, **431 kWh** of storage for every night instead of
up to 668. The latitude is decided, not tuned: 10° N (`scripts/latitude.py`), where the
daylight share is the same 59% it is anywhere up to 75° and the power margin is best.
The same script shows station-keeping by latitude: the propulsive
power and the array's output only meet at ~85°, inside the polar vortex, where
the sun never rises more than a few degrees. Wind by latitude is taken as flat
to 50° and solid-body poleward of that, after Venus Express cloud tracking.

**The air fill.** The lower hull holds 31 500 m³ of breathable air — 33.6 t of
gas, more than the airship's entire useful payload, so it can never be shipped.
It is made on station instead: O₂ by solid-oxide electrolysis of CO₂, N₂ stripped
from the 3.5% of the atmosphere that is already nitrogen. Over the 2 912 days
between the Phase 2 hull arriving (Dec 2034) and the crew departing (Jul 2042),
that is **11.5 kg/day**, processing about **240 m³ of Venus' air daily**. This is
why the program is phased the way it is: the 2034 window is not a rehearsal
that happens to come first, it is the start of a process that has to finish
before 2042 is flyable.

**Envelope packing.** At 200 g/m² and ~1.6 g/cm³ the laminate is about 125 µm
thick; over 11 100 m² of envelope that is only 1.4 m³ of solid material, ~2.5 m³
folded — an inflated-to-packed ratio of about **30 700 : 1**. The hull's widest
girth is 107 m, so at a 1.55 m usable laminate width the envelope is cut as
**69 gores** with roughly **9.4 km** of heat-fused seam.

**A cross-check worth noting.** Sizing an envelope for ~40 t of payload on
breathable-air lift at 50 km independently returns 73 900 m³ at 127 m × 33 m. NASA
Langley's published HAVOC airship is 77 500 m³ at 129 m × 34 m, and the same hull
on helium yields ~113 t gross — consistent with HAVOC's stated ~70 t payload. The
independently computed 11.29 km/s entry speed matches HAVOC's published 11.3, and
the 459-day round trip matches HAVOC's 440-day figure to within one opportunity.

**Language.** The site is written in American English, in a plain human voice,
and deliberately short — the graphics carry the argument.

**Costs are order-of-magnitude.** They are built bottom-up from analogous
programmes, not from a costed work-breakdown structure, and historical experience
says such estimates run low. The site says so on the page.

---

## Repository layout

```
index.html              the page
assets/styles.css       design tokens and components
assets/data.js          every displayed number, in one place
assets/trajectory.js    generated — heliocentric geometry for the orbit plot
assets/mission.js       scroll engine and canvas renderers
assets/acts3d.js        the three acts in WebGL: Starship launches and orbital assembly,
                        departure, cruise and the aerobraking pass, entry and inflation,
                        plus the ship skin to sky, the thirty-day stay, the sun chase
                        close up, the cloudwalk, the science icons and the sample drop
assets/acts.js          the same three acts drawn in 2D canvas — the fallback when WebGL is off
assets/models.js        generated — OBJ text for the 3D viewer
assets/vendor/          three.js r128 (MIT — license alongside)
models/*.obj, *.mtl     generated — design files, meters, Y up, open in Blender etc.
scripts/*.py            the orbital mechanics and the model generator
```

### Sections

Why Venus (with the Venus/Mars ledger) · **Act 01 — getting ready**, Starship flights and the stack
assembling in orbit · **Act 02 — the trip**, one camera from leaving Earth through
the computed transfer to the aerobraking pass at Venus · **Act 03 — going down**, the descent
through the atmosphere to the floor (each vehicle's spec sheet and model download ride
in the Act 01 cards) · the ship, skin to sky (laminate, cut, fold, inflate, fill, float) ·
life up there and the thirty-day stay lap by lap · chasing the sun, one day and one
night at 10° N · walking on sunshine · what we'd learn · where the samples come from ·
the program and launch windows · the risks · so.

### The 3D models

`scripts/build_models.py` generates every model from the plan's own dimensions —
the 129 × 34 m hull with its helium cells and breathable-air volume, the 180 m³
transit habitat with wings and tanks, a two-stage ascent vehicle sized for ~40 t of
LOX/methane, the assembled orbital stack, the launch vehicle (a 9 m stainless
ship on a 71 m booster, public dimensions only) and the direct-entry vehicle (a
12.8 m 70° sphere-cone heat shield with the packed hull and crew module inside).
A 1.8 m person stands beside each one.

The acts use the same models. Act 01 splits the stack OBJ into its six deliveries
and flies each one up on Starship; Act 02 flies the stack out of Earth orbit,
along the real Lambert arc, and through an aerobraking pass at Venus with Hesperus
and the entry vehicle on their separate paths; Act 03 lays a transparent WebGL
layer over the 2D atmosphere so the entry vehicle, chute and inflating hull line
up with the altitude scale. Earth and Venus are procedural (value-noise textures
built at load time). Every act keeps its 2D renderer as the fallback when WebGL
is unavailable.
No external assets: online model libraries were not reachable from the build
environment, and nothing that exists elsewhere is this specific vehicle anyway.

Outputs are `models/*.obj` + `.mtl` (the design files) and `assets/models.js`, the
same geometry as JS strings so the page works from `file://` without a fetch. The
viewer parses OBJ in about thirty lines and renders with vendored three.js; drag to
turn.

No build step, no dependencies, no framework. Open `index.html` directly or serve
the directory; both work.

### How the scroll works

One `requestAnimationFrame` loop drives every scroll-linked graphic. Each
scrollytelling stage is a tall track containing a `position: sticky` visual and a
stack of narrative cards pulled over it with a negative margin; progress through
the track is mapped through piecewise keyframes so the interesting parts get more
scroll than the boring ones — the 50–54 km band occupies a third of the descent,
and the 30 days aloft get as much scroll as the 124-day cruise.

`prefers-reduced-motion: reduce` unsticks every stage, stops the starfield
animation and renders all content statically.

---

## Design

A deliberate single-theme page: the night side of Venus. The palette is taken from
the planet rather than from the pop-culture orange — `#F2E8D0` is close to Venus's
true-color cloud tops, on a violet-biased black. Warm (`#E8B33A` sulfur,
`#FF7A45` ember) always means Venus, heat or acid; cool (`#5FD0C4`) always means
Earth, water, breathable air or crew. That split carries information, not
decoration.

Type: Archivo for technical labels, Spectral for the argument, IBM Plex Mono for
every number, unit and date.

---

## Sources

**Thesis**
- E. Roth, [*We're Going the Wrong Way: Why Venus is a Better Planet than Mars*](https://thatmre.medium.com/we-re-going-the-wrong-way-ca8fb1a8691a)

**Architecture**
- Arney & Jones, [*High Altitude Venus Operational Concept (HAVOC): An Exploration Strategy for Venus*](https://arc.aiaa.org/doi/10.2514/6.2015-4612), AIAA SPACE 2015-4612
- [*HAVOC: Proofs of Concept*](https://ntrs.nasa.gov/citations/20160006580), NASA Langley (NTRS 20160006580)
- G. A. Landis, [*Colonization of Venus*](https://ntrs.nasa.gov/citations/20030022668), STAIF 2003
- G. A. Landis, [*Settling Venus: A City in the Clouds?*](https://arc.aiaa.org/doi/10.2514/6.2020-4152), AIAA ASCEND 2020-4152

**Clouds and habitability**
- Hallsworth et al., [*Water activity in Venus's uninhabitable clouds and other planetary atmospheres*](https://www.nature.com/articles/s41550-021-01391-3), Nature Astronomy 2021
- Seager et al., [*Venus Life Finder Mission Study*](https://arxiv.org/abs/2112.05153), arXiv:2112.05153
- Seager et al., *Stability of 20 Biogenic Amino Acids in Concentrated Sulfuric Acid*, Astrobiology 2024

**Aerostats and materials**
- [*Aerial Platform Design Options for a Life-Finding Mission at Venus*](https://arxiv.org/abs/2208.05579), arXiv:2208.05579
- [*Mission Architecture to Characterize Habitability of Venus Cloud Layers via an Aerial Platform*](https://arxiv.org/abs/2208.05582), arXiv:2208.05582
- VEGA 1 and 2 balloon envelopes — woven PTFE with a PTFE skin, 46 hours at 54 km, 1985

**Radiation**
- Herbst et al., [*Revisiting the cosmic-ray induced Venusian radiation dose in the context of habitability*](https://www.aanda.org/articles/aa/full_html/2020/01/aa36968-19/aa36968-19.html), A&A 2020

**ISRU**
- [*Exploring Venus with Electrolysis (EVE)*](https://www.nasa.gov/directorates/stmd/niac/niac-studies/exploring-venus-with-electrolysis-eve/), NASA NIAC
- MOXIE — solid-oxide electrolysis of CO₂, demonstrated on Mars, 2021

**Missions in the 2026–2032 window**
- Rocket Lab / MIT [Venus Life Finder](https://rocketlabcorp.com/missions/launches/first-private-mission-to-venus/) · ISRO Shukrayaan-1 · NASA [DAVINCI](https://science.nasa.gov/mission/davinci/) · NASA [VERITAS](https://science.nasa.gov/mission/veritas/) · ESA EnVision

**Science — open questions the mission targets**
- Greaves et al., [*Phosphine gas in the cloud decks of Venus*](https://arxiv.org/abs/2011.08176) (re-analysis, arXiv:2011.08176), and Villanueva et al., [*No evidence of phosphine…*](https://www.nature.com/articles/s41550-021-01422-z), Nature Astronomy 2021 — both sides of a still-open dispute
- Spacek et al., [*Iron-sulfur chemistry can explain the ultraviolet absorber in the clouds of Venus*](https://www.science.org/doi/10.1126/sciadv.adg8826), Science Advances 2024
- Herrick & Hensley, [*Surface changes observed on a Venusian volcano during the Magellan mission*](https://www.jpl.nasa.gov/news/ongoing-venus-volcanic-activity-discovered-with-nasas-magellan-data/), Science 2023
- Lai et al., [*Contribution of Thermal Tides to Venus Upper Cloud-Layer Superrotation*](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025AV001880), AGU Advances 2025
- Way & Del Genio, [*Venusian habitable climate scenarios*](https://www.giss.nasa.gov/pubs/abs/wa02800e.html), JGR Planets 2020, on the lost ocean and the D/H record
- Sagdeev et al., [*Overview of VEGA Venus Balloon in Situ Meteorological Measurements*](https://www.science.org/doi/10.1126/science.231.4744.1411), Science 1986 — the only in-situ flight data from the band, including the 3.5 m/s downdrafts

**Cost anchors**
- [*The Cost of SLS and Orion*](https://www.planetary.org/space-policy/cost-of-sls-and-orion), The Planetary Society
- Published crewed-Mars estimates: $230 bn (2035 first-mission costing), ~$500 bn (L. Garver), up to $1 tn over 25 years (P. Lee)

**See also**
- [3D Solar System — Venus](https://3dsolarsystem.online/viewer/#venus)
