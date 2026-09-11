/* ============================================================
   PROJECT PHOSPHORUS — mission data
   Every number rendered on the page comes from this file.
   Sources are keyed in README.md. Values marked `derived` are
   computed by scripts/porkchop.py, roundtrip.py and compare.py.
   ============================================================ */

var PHOS = (window.PHOS = window.PHOS || {});

PHOS.VENUS = {
  radiusKm: 6051.8,
  gravity: 8.87,            // m/s^2
  gravityG: 0.904,          // vs Earth
  massEarths: 0.815,
  semiMajorAu: 0.7233,
  yearDays: 224.7,
  sidDayDays: 243.02,       // retrograde
  solarDayDays: 116.75,
  synodicDays: 583.92,
  closestApproachMkm: 38.2, // derived: Earth perihelion − Venus aphelion
  solarConstant: 2601,      // W/m^2 (Earth: 1361)
  bondAlbedo: 0.76,
  surfaceTempC: 464,
  surfacePressureBar: 92.1,
  composition: [
    { gas: 'CO₂', pct: 96.5 },
    { gas: 'N₂', pct: 3.5 },
    { gas: 'SO₂', pct: 0.015 },
    { gas: 'Ar', pct: 0.007 },
    { gas: 'H₂O', pct: 0.002 }
  ]
};

PHOS.MARS = {
  gravityG: 0.379,
  closestApproachMkm: 54.6,
  surfacePressureBar: 0.0063,
  surfaceTempC: -63,
  shieldingGcm2: 21
};

/* ---- Atmospheric column, VIRA-consistent ------------------
   lift = (rho_ambient − rho_liftgas) at the same T and P.
   Venus mean molar mass 43.45 g/mol; breathable air 28.96;
   helium 4.00. Shielding = P / g, i.e. the mass of atmosphere
   overhead per unit area. Earth sea level = 1033 g/cm^2.      */
PHOS.PROFILE = [
  { km: 0,   tK: 735, tC: 462,   atm: 92.10,  rho: 65.00, liftAir: 20.6,  liftHe: 58.9,  shield: 105210, zone: 'surface' },
  { km: 10,  tK: 658, tC: 385,   atm: 47.39,  rho: 37.72, liftAir: 12.6,  liftHe: 34.3,  shield: 54140, zone: 'lower' },
  { km: 20,  tK: 581, tC: 308,   atm: 22.52,  rho: 20.53, liftAir: 6.85,  liftHe: 18.6,  shield: 25730, zone: 'lower' },
  { km: 30,  tK: 497, tC: 224,   atm: 9.851,  rho: 10.42, liftAir: 3.48,  liftHe: 9.46,  shield: 11254, zone: 'lower' },
  { km: 40,  tK: 418, tC: 145,   atm: 3.501,  rho: 4.386, liftAir: 1.463, liftHe: 3.982, shield: 3999,  zone: 'lower' },
  { km: 45,  tK: 385, tC: 112,   atm: 1.953,  rho: 2.686, liftAir: 0.896, liftHe: 2.439, shield: 2231,  zone: 'lower' },
  { km: 48,  tK: 363, tC: 90,    atm: 1.399,  rho: 2.041, liftAir: 0.681, liftHe: 1.853, shield: 1598,  zone: 'cloud-lower' },
  { km: 50,  tK: 348, tC: 75,    atm: 1.052,  rho: 1.601, liftAir: 0.534, liftHe: 1.453, shield: 1202,  zone: 'cloud-lower' },
  { km: 52,  tK: 333, tC: 60,    atm: 0.817,  rho: 1.299, liftAir: 0.433, liftHe: 1.180, shield: 934,   zone: 'cloud-mid' },
  { km: 54,  tK: 311, tC: 38,    atm: 0.620,  rho: 1.056, liftAir: 0.352, liftHe: 0.959, shield: 709,   zone: 'cloud-mid' },
  { km: 55,  tK: 300, tC: 27,    atm: 0.524,  rho: 0.925, liftAir: 0.308, liftHe: 0.840, shield: 599,   zone: 'cloud-mid' },
  { km: 60,  tK: 263, tC: -10,   atm: 0.233,  rho: 0.469, liftAir: 0.156, liftHe: 0.426, shield: 266,   zone: 'cloud-upper' },
  { km: 65,  tK: 243, tC: -30,   atm: 0.097,  rho: 0.212, liftAir: 0.071, liftHe: 0.192, shield: 111,   zone: 'cloud-upper' },
  { km: 70,  tK: 230, tC: -43,   atm: 0.037,  rho: 0.085, liftAir: 0.028, liftHe: 0.077, shield: 42,    zone: 'haze' },
  { km: 80,  tK: 197, tC: -76,   atm: 0.0047, rho: 0.013, liftAir: 0.004, liftHe: 0.012, shield: 5.4,   zone: 'haze' },
  { km: 100, tK: 175, tC: -98,   atm: 0.0003, rho: 0.001, liftAir: 0.000, liftHe: 0.001, shield: 0.34,  zone: 'space' }
];

/* shield = P/g, the mass of atmosphere overhead per unit area,
   in g/cm^2. Earth sea level for reference: */
PHOS.EARTH_SHIELD_GCM2 = 1033;

PHOS.CLOUD_DECKS = [
  { name: 'Upper haze',  lo: 70,   hi: 90,   acid: null,     note: 'Sub-micron droplets. UV-absorber streaks visible from orbit.' },
  { name: 'Upper cloud', lo: 56.5, hi: 70,   acid: '75–85%', note: 'Mode 1 + 2 droplets. Where Venus’ albedo is made.' },
  { name: 'Middle cloud', lo: 50.5, hi: 56.5, acid: '81–98%', note: 'Densest deck. Target band sits at its base.' },
  { name: 'Lower cloud', lo: 47.5, hi: 50.5, acid: '~98%',    note: 'Largest droplets. Hot enough to need active cooling.' }
];

PHOS.FLOAT_BAND = { lo: 50, hi: 54, nominal: 52 };

/* ---- Reference mission: PHOSPHORUS 1 ----------------------
   derived — scripts/roundtrip.py, patched-conic Lambert on JPL
   approximate planetary elements. 400 km circular LEO departure. */
PHOS.MISSION = {
  name: 'Phosphorus 1',
  depart:      { date: '2042-07-27', label: 'Trans-Venus injection' },
  venusArrive: { date: '2042-11-28', label: 'Venus arrival' },
  venusDepart: { date: '2042-12-28', label: 'Trans-Earth injection' },
  earthArrive: { date: '2043-10-29', label: 'Earth aerocapture' },
  outboundDays: 124,
  aloftDays: 30,
  returnDays: 305,
  totalDays: 459,
  c3: 7.08,             // km^2/s^2
  dvTvi: 3.50,          // km/s, LEO 400 km -> TVI
  venusVinf: 4.71,      // km/s
  venusEntryKms: 11.29, // km/s at the 125 km entry interface
  dvTei: 3.6,           // km/s from 300 km Venus orbit
  earthVinf: 8.67,      // km/s
  earthEntryKms: 14.06, // km/s at the 125 km entry interface
  crew: 4,
  crewAloft: 2
};

PHOS.BACKUP_WINDOW = {
  depart: '2045-10-24', earthArrive: '2047-01-06',
  outboundDays: 109, aloftDays: 30, returnDays: 300, totalDays: 439, c3: 14.25
};

/* Every Earth→Venus departure opportunity, 2030–2050.
   derived — scripts/porkchop.py, minimum-energy solution in each window. */
PHOS.WINDOWS = [
  { open: '2031-03-27', close: '2031-06-15', best: '2031-05-22', arrive: '2031-10-27', tof: 158, c3: 6.46,  vinf: 3.83, use: 'Phase 1 — Pathfinder' },
  { open: '2032-10-29', close: '2033-02-20', best: '2032-12-06', arrive: '2033-05-09', tof: 154, c3: 8.97,  vinf: 2.98, use: null },
  { open: '2034-05-04', close: '2034-10-11', best: '2034-06-09', arrive: '2034-12-08', tof: 182, c3: 14.45, vinf: 2.97, use: 'Phase 2 — Uncrewed airship' },
  { open: '2036-01-16', close: '2036-05-11', best: '2036-02-19', arrive: '2036-08-19', tof: 182, c3: 12.98, vinf: 4.70, use: null },
  { open: '2037-09-03', close: '2037-11-26', best: '2037-10-25', arrive: '2038-04-03', tof: 160, c3: 8.03,  vinf: 4.91, use: 'Phase 3 — Pre-positioning' },
  { open: '2039-03-25', close: '2039-06-13', best: '2039-05-20', arrive: '2039-10-25', tof: 158, c3: 6.41,  vinf: 3.92, use: 'Phase 3 — Ascent vehicle' },
  { open: '2040-10-29', close: '2041-02-18', best: '2040-12-08', arrive: '2041-05-07', tof: 150, c3: 8.65,  vinf: 2.92, use: 'Phase 3 — Dress rehearsal' },
  { open: '2042-04-30', close: '2042-10-09', best: '2042-07-27', arrive: '2042-11-28', tof: 124, c3: 7.08,  vinf: 4.71, use: 'PHASE 4 — CREW' },
  { open: '2044-01-14', close: '2044-05-11', best: '2044-03-15', arrive: '2044-07-05', tof: 112, c3: 12.23, vinf: 5.18, use: 'Phase 5 — Resupply' },
  { open: '2045-09-01', close: '2045-11-26', best: '2045-10-24', arrive: '2046-02-10', tof: 109, c3: 14.25, vinf: 4.35, use: 'Phase 5 — Crew 2 (backup)' },
  { open: '2047-03-23', close: '2047-06-11', best: '2047-05-16', arrive: '2047-10-23', tof: 160, c3: 6.34,  vinf: 4.04, use: 'Phase 5 — Outpost' },
  { open: '2048-10-29', close: '2049-01-19', best: '2048-12-10', arrive: '2049-05-05', tof: 146, c3: 7.76,  vinf: 3.05, use: null },
  { open: '2050-04-28', close: '2050-10-05', best: '2050-06-07', arrive: '2050-12-02', tof: 178, c3: 13.37, vinf: 2.96, use: null }
];

/* Same code, same assumptions, run against Mars. derived — scripts/compare.py */
PHOS.MARS_TRIPS = [
  { kind: 'Short stay',       depart: '2041-10-19', arrive: '2042-09-04', out: 320, stay: 340, back: 330, total: 990 },
  { kind: 'Long stay',        depart: '2041-10-20', arrive: '2042-09-05', out: 320, stay: 400, back: 300, total: 1020 },
  { kind: 'Short stay',       depart: '2043-11-17', arrive: '2044-09-22', out: 310, stay: 335, back: 350, total: 995 }
];

PHOS.LEDGER = [
  { metric: 'Round trip, short stay',   venus: '459 d',            mars: '990 d',            unit: null, win: 'venus', note: 'Same Lambert solver, same epoch band. Venus gets you home 1.5 years sooner.' },
  { metric: 'Surface gravity',          venus: '0.904 g',          mars: '0.379 g',          win: 'venus', note: 'Partial-gravity deconditioning is a concern below ~0.4 g. Venus is barely partial at all.' },
  { metric: 'Shielding overhead',       venus: '1 200 g/cm²', mars: '21 g/cm²',    win: 'venus', note: 'At 50 km you sit under more atmosphere than you do at sea level on Earth (1 033 g/cm²).' },
  { metric: 'Ambient pressure',         venus: '1.05 atm',         mars: '0.006 atm',        win: 'venus', note: 'A habitat at Venus float altitude is not a pressure vessel. A Mars habitat always is.' },
  { metric: 'Ambient temperature',      venus: '27– 75 °C', mars: '−63 °C', win: 'venus', note: 'Hot, but hot in the range a heat pump handles. Choose your altitude, choose your climate.' },
  { metric: 'Sunlight available',       venus: '2 601 W/m²',  mars: '586 W/m²',    win: 'venus', note: 'Venus intercepts 1.9× Earth’s solar constant; Mars gets 43% of it.' },
  { metric: 'Closest approach',         venus: '38.2 M km',        mars: '54.6 M km',        win: 'venus', note: 'Venus is, and always has been, the nearest planet to Earth.' },
  { metric: 'Launch cadence',           venus: 'every 584 d',      mars: 'every 780 d',      win: 'venus', note: 'More chances to go, more chances to abort home.' },
  { metric: 'Solid ground',             venus: 'none',             mars: 'yes',              win: 'mars',  note: 'This is the real cost. Venus is a sky you visit, not a ground you stand on.' },
  { metric: 'Earth-return entry speed', venus: '14.1 km/s',        mars: '3.4 km/s V∞', win: 'mars',  note: 'The single hardest number in this plan. No vehicle has ever entered Earth’s atmosphere that fast.' },
  { metric: 'Water',                    venus: 'in acid, 20 ppm vapour', mars: 'buried ice',  win: 'mars',  note: 'Venus water must be stripped out of sulfuric acid. Mars water can be dug up.' }
];

/* ---- Programme ------------------------------------------- */
PHOS.PHASES = [
  {
    id: 0, tag: 'Phase 0', name: 'Reconnaissance', years: '2026 — 2032',
    status: 'funded',
    thesis: 'Five spacecraft already on the books answer the questions a crew would bet their lives on.',
    items: [
      { name: 'Venus Life Finder', who: 'Rocket Lab / MIT', when: 'NET 2026', what: '20 kg probe, autofluorescence nephelometer, night-side entry. Under $10 M.' },
      { name: 'Shukrayaan-1', who: 'ISRO', when: '2028-03-29', what: 'Orbiter. 112-day cruise, Venus orbit insertion 2028-07-19.' },
      { name: 'DAVINCI', who: 'NASA', when: 'Dec 2030 preferred', what: 'Descent sphere samples the full atmospheric column. Noble gases, D/H ratio.' },
      { name: 'VERITAS', who: 'NASA', when: 'NET Jun 2031', what: 'Radar and gravity mapping. Is Venus geologically alive?' },
      { name: 'EnVision', who: 'ESA', when: 'Dec 2031', what: 'Sub-surface radar, atmospheric spectroscopy, surface change detection.' }
    ],
    cost: 1.9
  },
  {
    id: 1, tag: 'Phase 1', name: 'Pathfinder', years: '2031 — 2032',
    status: 'proposed', window: '2031-05-22 → 2031-10-27',
    thesis: 'One uncrewed balloon, one Venus year aloft. Everything that must not surprise a crew gets surprised here first.',
    items: [
      { name: 'Superpressure aerobot', who: '~6 000 m³, 52 km float', when: '225 d minimum', what: 'Flies the exact envelope laminate the crewed ship will use, through ~45 circumnavigations and ~45 acid-thermal cycles.' },
      { name: 'Electrolysis demo', who: 'Solid-oxide cell stack', when: 'continuous', what: 'Cracks ambient CO₂ into CO + O₂ to replace lost lift gas. Proves the balloon need not have a lifetime.' },
      { name: 'Acid harvest demo', who: 'Impaction collector', when: 'continuous', what: 'Pulls H₂SO₄ droplets from the deck and thermally splits them. Water is the product that matters.' }
    ],
    cost: 0.9
  },
  {
    id: 2, tag: 'Phase 2', name: 'Full-scale rehearsal', years: '2034 — 2036',
    status: 'proposed', window: '2034-06-09 → 2034-12-08',
    thesis: 'The crewed airship flies to Venus without a crew, and stays. If it survives two years, it becomes the lifeboat.',
    items: [
      { name: 'Airship article 001', who: '129 m × 34 m, 77 500 m³', when: 'indefinite', what: 'Identical to the crewed vehicle minus life support. Flies the complete entry, inflation and cruise sequence.' },
      { name: 'Standing lifeboat', who: 'on station at 52 km', when: 'from 2034-12', what: 'No crew launches until a second, proven habitat is already floating and healthy.' }
    ],
    cost: 4.6
  },
  {
    id: 3, tag: 'Phase 3', name: 'Pre-positioning', years: '2037 — 2041',
    status: 'proposed', window: '2037-10-25 · 2039-05-20 · 2040-12-08',
    thesis: 'The ride home is parked at Venus, fuelled and checked out, three windows before anybody leaves Earth.',
    items: [
      { name: 'Venus Ascent Vehicle', who: 'two-stage LOX/LCH₄', when: 'arrives 2038-04', what: '~8 km/s from 50 km to Venus orbit. The heaviest, hardest element in the architecture.' },
      { name: 'Consumables cache', who: 'gondola-mounted', when: 'arrives 2039-10', what: '400 crew-days of margin above the 30-day plan, aloft and waiting.' },
      { name: 'Uncrewed dress rehearsal', who: 'full stack', when: '2040-12 → 2041-05', what: 'Ascent vehicle flies 50 km → orbit → rendezvous, empty. The abort path is demonstrated before it is needed.' }
    ],
    cost: 7.2
  },
  {
    id: 4, tag: 'Phase 4', name: 'Phosphorus 1 — crewed', years: '2042 — 2043',
    status: 'flagship', window: '2042-07-27 → 2043-10-29',
    thesis: 'Four people leave Earth. Two of them spend thirty days in the only place off Earth where you can stand at one atmosphere in a shirt.',
    items: [
      { name: 'Outbound', who: '124 days', when: '2042-07-27', what: 'ΔV 3.50 km/s from a 400 km parking orbit. C₃ = 7.08 km²/s².' },
      { name: 'Arrival', who: '11.29 km/s at entry interface', when: '2042-11-28', what: 'Transit habitat aerocaptures into Venus orbit with two crew. Airship separates and enters direct.' },
      { name: 'Thirty days aloft', who: '2 crew, 50–54 km', when: '2042-11 → 12', what: 'Roughly six circumnavigations of the planet, carried by the superrotating winds.' },
      { name: 'Return', who: '305 days', when: '2042-12-28', what: 'Ascent to orbit, rendezvous, trans-Earth injection. Earth entry at 14.06 km/s.' }
    ],
    cost: 17.8
  },
  {
    id: 5, tag: 'Phase 5', name: 'Aerial outpost', years: '2045 — 2055',
    status: 'proposed', window: 'every 584 days',
    thesis: 'Stays lengthen from 30 days to a Venus year. The fleet grows by one airship per window, and the outpost stops being a visit.',
    items: [
      { name: 'Year-long stays', who: 'crew of 4 aloft', when: 'from 2045', what: 'Backup window 2045-10-24 → 2047-01-06: 439 days total, the shortest round trip of the decade.' },
      { name: 'Fleet growth', who: '+1 hull per window', when: 'every 584 d', what: 'Airships dock envelope-to-envelope. A cluster is more survivable than a single hull.' },
      { name: 'Closed loop', who: 'C, O, N, H, S', when: 'target 2050', what: 'Every element a human needs except phosphorus is in the air around the hull.' }
    ],
    cost: 12.0
  }
];

/* ---- Fleet ----------------------------------------------- */
PHOS.FLEET = [
  {
    code: 'ELEMENT 1', name: 'Hesperus', role: 'Transit habitat',
    mass: '~55 t', crew: '4',
    line: 'Cycles Earth ↔ Venus and never enters an atmosphere except to aerocapture.',
    specs: [
      ['Pressurised volume', '~180 m³'],
      ['Mission duration', '459 days'],
      ['Storm shelter', 'water-wall + polyethylene'],
      ['Loiter', '30 d in 300 km Venus orbit, 2 crew aboard'],
      ['Propulsion', 'LOX/LCH₄, ΔV 3.6 km/s for trans-Earth injection']
    ]
  },
  {
    code: 'ELEMENT 2', name: 'Phosphorus', role: 'Venus atmospheric vehicle',
    mass: '~85 t', crew: '2',
    line: 'The airship. A 129-metre hull that is also a house, floating at one atmosphere.',
    specs: [
      ['Envelope', '129 m × 34 m, 77 500 m³'],
      ['Envelope area', '~11 100 m² at ~200 g/m²'],
      ['Lift split', '46 000 m³ sealed helium + 31 500 m³ ambient breathable air'],
      ['Gross lift at 50 km', '83.6 t → ~63 t useful'],
      ['Float band', '50 – 54 km, trimmed by ballonet + electrolysis'],
      ['Power', '~1 000 m² thin-film PV + regenerative fuel cell']
    ]
  },
  {
    code: 'ELEMENT 3', name: 'Vesper', role: 'Venus ascent vehicle',
    mass: '~40 t fuelled', crew: '2',
    line: 'Pre-positioned in 2038. Launches from a balloon at 50 km — the hardest thing here.',
    specs: [
      ['Stages', 'two, LOX/LCH₄'],
      ['ΔV required', '~8.0 km/s to 300 km Venus orbit'],
      ['Launch altitude', '50 km — above 98.8% of the atmosphere’s mass'],
      ['Ideal circular velocity', '7.15 km/s'],
      ['Heritage gap', 'no vehicle has ever staged off an aerostat']
    ]
  },
  {
    code: 'ELEMENT 4', name: 'Lucifer', role: 'Earth aerocapture shell',
    mass: '~12 t', crew: '4',
    line: 'Brings the crew through Earth’s atmosphere at 14.06 km/s. Nothing has done this.',
    specs: [
      ['Entry velocity', '14.06 km/s at 125 km'],
      ['Apollo 10 record', '11.07 km/s'],
      ['Stardust record', '12.9 km/s (uncrewed)'],
      ['Mitigation A', 'propulsive pre-braking, ~1.5 km/s for ~12 t of propellant'],
      ['Mitigation B', 'long-stay return: 12.12 km/s, but 833 days total']
    ]
  }
];

/* ---- Entry, descent and inflation ------------------------ */
PHOS.EDI = [
  { t: 'E − 4 h',  alt: null,    name: 'Separation',        detail: 'Airship stack separates from the transit habitat. Hesperus continues to aerocapture into Venus orbit with two crew; Phosphorus enters direct.' },
  { t: 'E + 0',     alt: 125,     name: 'Entry interface',    detail: 'Atmospheric interface at 11.29 km/s, flight-path angle −10°. The aeroshell is now the only thing between the crew and 1 800 °C plasma.' },
  { t: 'E + 90 s',  alt: 82,      name: 'Peak heating',       detail: 'Stagnation-point heat load of order 18 kJ/cm². Peak deceleration follows within seconds.' },
  { t: 'E + 3 min', alt: 74,      name: 'Parachute',          detail: 'Supersonic decelerator deploys. Five seconds later the forward heat shield is jettisoned.' },
  { t: 'E + 4 min', alt: 72,      name: 'Inflation begins',   detail: 'Envelope is drawn from the backshell and helium generation starts. From here the vehicle stops falling like a probe and starts becoming a ship.' },
  { t: 'E + 11 min',alt: 52,      name: 'Inflation complete', detail: 'Descent parachute released. The hull is now flying. Ambient pressure 0.82 atm, ambient temperature 60 °C.' },
  { t: 'E + 21 min',alt: 52,      name: 'Trim to float',      detail: 'Inflation hardware jettisoned, flight control engaged, ballonets trimmed. The airship settles into the band and begins its first circumnavigation.' },
  { t: 'E + 30 d',  alt: 50,      name: 'Ascent',             detail: 'Vesper lights at 50 km. Eight kilometres per second later the crew is in Venus orbit, closing on Hesperus.' }
];

/* ---- Envelope laminate, outside in ----------------------- */
PHOS.LAMINATE = [
  { layer: 'PTFE / FEP film',        thick: '25 µm', why: 'Sulfuric acid barrier. Flight heritage: VEGA 1 and 2 flew woven PTFE with a PTFE skin for 46 hours at 54 km in 1985.' },
  { layer: 'Aluminised PET',         thick: '12 µm', why: 'Reflects sunlight and infrared so the lift gas stays cool and the hull does not superheat in a 2 601 W/m² sky.' },
  { layer: 'Zylon PBO / Vectran scrim', thick: 'woven',  why: 'Carries every newton of pressure and suspension load. The tendon material modern Venus balloon designs converge on.' },
  { layer: 'Polyurethane barrier',   thick: '20 µm', why: 'Holds helium in. Helium is the one consumable that cannot be made from Venus’ air.' }
];

/* ---- Life aloft ------------------------------------------ */
PHOS.ALOFT = {
  circumnavKm: 38340,        // derived: 2*pi*(6051.8+50)
  windMs: [60, 95],
  circumnavDays: [4.7, 7.4],
  nightHours: 50,
  solarVsEarthSurface: '+40%',
  loops: [
    { name: 'Oxygen', in: 'CO₂ from outside the hull', out: 'O₂ to breathe, CO for fuel', how: 'Solid-oxide electrolysis. MOXIE proved the same reaction on Mars in 2021.' },
    { name: 'Water',  in: 'H₂SO₄ droplets, 81–98% w/w', out: 'H₂O + SO₃', how: 'Impaction collection, then thermal decomposition. The clouds are the reservoir.' },
    { name: 'Buffer gas', in: 'N₂, 3.5% of the air', out: 'habitat nitrogen', how: 'Venus holds roughly 3.4× the nitrogen in Earth’s entire atmosphere.' },
    { name: 'Lift',   in: 'CO₂', out: 'CO + O₂ lift gas', how: 'The same electrolyser that makes oxygen replaces leaked buoyancy. A balloon that need not have a lifetime.' }
  ]
};

PHOS.CREW = [
  { role: 'Commander',      station: 'Hesperus, Venus orbit', days: 459, why: 'Holds the return asset. Never enters the atmosphere.' },
  { role: 'Flight engineer', station: 'Hesperus, Venus orbit', days: 459, why: 'Keeps the ride home alive through a 30-day solo loiter.' },
  { role: 'Aeronaut — systems', station: 'Phosphorus, 50–54 km', days: 30, why: 'Flies the airship. Buoyancy, thermal, acid management.' },
  { role: 'Aeronaut — science', station: 'Phosphorus, 50–54 km', days: 30, why: 'Analytical chemist and astrobiologist. The reason the mission is worth flying.' }
];

/* ---- Cost ------------------------------------------------
   Order-of-magnitude, 2026 US dollars. Built bottom-up from the
   phase table; see README.md for the basis of estimate. */
PHOS.COSTS = {
  phases: [
    { name: 'Phase 0 — Reconnaissance', usd: 1.9,  note: 'Already funded or committed' },
    { name: 'Phase 1 — Pathfinder',     usd: 0.9,  note: 'New Frontiers class aerobot' },
    { name: 'Phase 2 — Rehearsal',      usd: 4.6,  note: 'First airship article + heavy launch' },
    { name: 'Phase 3 — Pre-positioning', usd: 7.2, note: 'Ascent vehicle development dominates' },
    { name: 'Phase 4 — Crewed flight',  usd: 17.8, note: 'Transit habitat, crew systems, operations' },
    { name: 'Phase 5 — Outpost decade', usd: 12.0, note: 'Four more hulls, extended stays' }
  ],
  total: 44.4,
  years: 20,
  perYear: 2.2,
  launchMassT: 450,
  launchCostLo: 0.09,
  launchCostHi: 0.225,
  marsEstimates: [
    { label: 'First crewed Mars mission, 2035 costing', usd: 230 },
    { label: 'Half a trillion (L. Garver, former NASA deputy)', usd: 500 },
    { label: 'Up to $1 T over 25 years (P. Lee, Mars Institute)', usd: 1000 }
  ]
};

/* ---- The honest column ----------------------------------- */
PHOS.RISKS = [
  {
    rank: 1, name: 'Earth return at 14.06 km/s', severity: 'critical',
    what: 'The 459-day itinerary brings the crew home 27% faster than any human has ever entered Earth’s atmosphere. Apollo 10 peaked at 11.07 km/s; the fastest artificial object ever to enter, Stardust, managed 12.9 km/s and carried nobody.',
    fix: 'Either spend propellant — roughly 1.5 km/s of pre-braking for about 12 t — or spend time. The gentle return exists: leave Venus 2044-04-10 and enter at 12.12 km/s, but the mission becomes 833 days and the whole duration argument collapses.'
  },
  {
    rank: 2, name: 'Launching to orbit from a balloon', severity: 'critical',
    what: 'Vesper must deliver ~8.0 km/s from a platform with no launch pad, no hold-down, and a hull full of helium directly overhead. Nothing has ever staged off an aerostat, at any scale.',
    fix: 'Phase 3 flies the entire ascent and rendezvous uncrewed in 2040-12 before a single person commits. Drop-launch below the hull removes the plume problem; the engineering to prove it is a decade of work.'
  },
  {
    rank: 3, name: 'Sulfuric acid, for thirty days', severity: 'high',
    what: 'The float band sits in droplets of 81–98% w/w sulfuric acid. VEGA’s balloons survived 46 hours. A crewed mission needs 720, and a permanent outpost needs decades.',
    fix: 'Phase 1 exists to answer exactly this: one uncrewed hull, one Venus year, the real laminate, ~45 acid-thermal cycles. If the envelope fails there, the programme stops there — cheaply.'
  },
  {
    rank: 4, name: 'Rejecting heat into a hot sky', severity: 'high',
    what: 'At 50 km the air outside is 75 °C. Radiators want a cold sink and there is not one. Every watt the crew, the electronics and the sunlight put into the hull has to go somewhere.',
    fix: 'Altitude is the thermostat. The vehicle climbs toward 54 km (38 °C) through the day side and sinks toward 50 km at night where lift is greatest. Buoyancy control and thermal control are the same system.'
  },
  {
    rank: 5, name: 'Fifty hours of darkness', severity: 'medium',
    what: 'Carried by the superrotation the hull laps Venus in about five days, so night lasts roughly 50 hours — and Venus’ own 117-day solar day gives no relief.',
    fix: 'Regenerative fuel cells sized for a 50-hour discharge, charged by 2 601 W/m² of daylight and topped up by electrolysis products that double as lift gas.'
  },
  {
    rank: 6, name: 'There is no ground', severity: 'structural',
    what: 'Venus’ surface is 464 °C at 92 atmospheres. Nothing built has lasted more than 127 minutes there. Mining, burying, building — every settlement strategy that assumes solid ground is unavailable.',
    fix: 'None. This is the trade, not a problem to be solved: Venus offers an atmosphere and denies a surface. Anyone who wants regolith should go to Mars.'
  },
  {
    rank: 7, name: 'Water activity of 0.004', severity: 'medium',
    what: 'The cloud droplets are two orders of magnitude drier, in the sense that matters to biology, than anything terrestrial life tolerates. This is why the clouds are probably not inhabited — and why a crew cannot simply scoop a drink.',
    fix: 'Water comes out of acid by thermal decomposition, not by condensation. It costs energy, and energy is the one thing Venus is not short of.'
  }
];

PHOS.SOURCES = [
  { tag: 'Thesis',       cite: 'E. Roth, “We’re Going the Wrong Way: Why Venus is a Better Planet than Mars”', url: 'https://thatmre.medium.com/we-re-going-the-wrong-way-ca8fb1a8691a' },
  { tag: 'Architecture', cite: 'Arney & Jones, High Altitude Venus Operational Concept (HAVOC), AIAA SPACE 2015-4612', url: 'https://arc.aiaa.org/doi/10.2514/6.2015-4612' },
  { tag: 'Architecture', cite: 'HAVOC: Proofs of Concept, NASA Langley (NTRS 20160006580)', url: 'https://ntrs.nasa.gov/citations/20160006580' },
  { tag: 'Settlement',   cite: 'G. A. Landis, “Colonization of Venus”, STAIF 2003 (NTRS 20030022668)', url: 'https://ntrs.nasa.gov/citations/20030022668' },
  { tag: 'Settlement',   cite: 'G. A. Landis, “Settling Venus: A City in the Clouds?”, AIAA ASCEND 2020-4152', url: 'https://arc.aiaa.org/doi/10.2514/6.2020-4152' },
  { tag: 'Clouds',       cite: 'Hallsworth et al., “Water activity in Venus’s uninhabitable clouds”, Nature Astronomy 2021', url: 'https://www.nature.com/articles/s41550-021-01391-3' },
  { tag: 'Clouds',       cite: 'Seager et al., Venus Life Finder Mission Study, arXiv:2112.05153', url: 'https://arxiv.org/abs/2112.05153' },
  { tag: 'Aerostat',     cite: 'Aerial Platform Design Options for a Life-Finding Mission at Venus, arXiv:2208.05579', url: 'https://arxiv.org/abs/2208.05579' },
  { tag: 'Aerostat',     cite: 'Mission Architecture to Characterize Habitability of Venus Cloud Layers, arXiv:2208.05582', url: 'https://arxiv.org/abs/2208.05582' },
  { tag: 'Radiation',    cite: 'Herbst et al., “Revisiting the cosmic-ray induced Venusian radiation dose”, A&A 2020', url: 'https://www.aanda.org/articles/aa/full_html/2020/01/aa36968-19/aa36968-19.html' },
  { tag: 'ISRU',         cite: 'Exploring Venus with Electrolysis (EVE), NASA NIAC', url: 'https://www.nasa.gov/directorates/stmd/niac/niac-studies/exploring-venus-with-electrolysis-eve/' },
  { tag: 'Missions',     cite: 'NASA DAVINCI · VERITAS · ESA EnVision · ISRO Shukrayaan-1 · Rocket Lab Venus Life Finder', url: 'https://science.nasa.gov/mission/davinci/' },
  { tag: 'Cost',         cite: 'The Cost of SLS and Orion, The Planetary Society', url: 'https://www.planetary.org/space-policy/cost-of-sls-and-orion' },
  { tag: 'Viewer',       cite: '3D Solar System — Venus', url: 'https://3dsolarsystem.online/viewer/#venus' }
];
