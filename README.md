# Project Phosphorus

A scroll-driven mission plan for a crewed floating habitat in the clouds of Venus.

The site argues a specific case — that the cloud deck at 50–54 km is the most
habitable place off Earth, and that a crewed visit is shorter, cheaper and gentler
on a human body than the equivalent Mars mission — and then commits to a complete
architecture: a five-phase programme, a dated flagship flight, four vehicles, an
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

**A cross-check worth noting.** Sizing an envelope for ~40 t of payload on
breathable-air lift at 50 km independently returns 73 900 m³ at 127 m × 33 m. NASA
Langley's published HAVOC airship is 77 500 m³ at 129 m × 34 m, and the same hull
on helium yields ~113 t gross — consistent with HAVOC's stated ~70 t payload. The
independently computed 11.29 km/s entry speed matches HAVOC's published 11.3, and
the 459-day round trip matches HAVOC's 440-day figure to within one opportunity.

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
assets/mission.js       scroll engine, canvas and SVG renderers
scripts/*.py            the orbital mechanics behind the numbers
```

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
true-colour cloud tops, on a violet-biased black. Warm (`#E8B33A` sulfur,
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

**Cost anchors**
- [*The Cost of SLS and Orion*](https://www.planetary.org/space-policy/cost-of-sls-and-orion), The Planetary Society
- Published crewed-Mars estimates: $230 bn (2035 first-mission costing), ~$500 bn (L. Garver), up to $1 tn over 25 years (P. Lee)

**See also**
- [3D Solar System — Venus](https://3dsolarsystem.online/viewer/#venus)
