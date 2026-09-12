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
  { open: '2031-03-27', close: '2031-06-15', best: '2031-05-22', arrive: '2031-10-27', tof: 158, c3: 6.46,  vinf: 3.83, use: 'Step 1 — Balloon' },
  { open: '2032-10-29', close: '2033-02-20', best: '2032-12-06', arrive: '2033-05-09', tof: 154, c3: 8.97,  vinf: 2.98, use: null },
  { open: '2034-05-04', close: '2034-10-11', best: '2034-06-09', arrive: '2034-12-08', tof: 182, c3: 14.45, vinf: 2.97, use: 'Step 2 — Empty ship' },
  { open: '2036-01-16', close: '2036-05-11', best: '2036-02-19', arrive: '2036-08-19', tof: 182, c3: 12.98, vinf: 4.70, use: null },
  { open: '2037-09-03', close: '2037-11-26', best: '2037-10-25', arrive: '2038-04-03', tof: 160, c3: 8.03,  vinf: 4.91, use: 'Step 3 — Supplies' },
  { open: '2039-03-25', close: '2039-06-13', best: '2039-05-20', arrive: '2039-10-25', tof: 158, c3: 6.41,  vinf: 3.92, use: 'Step 3 — Vesper' },
  { open: '2040-10-29', close: '2041-02-18', best: '2040-12-08', arrive: '2041-05-07', tof: 150, c3: 8.65,  vinf: 2.92, use: 'Step 3 — Rehearsal' },
  { open: '2042-04-30', close: '2042-10-09', best: '2042-07-27', arrive: '2042-11-28', tof: 124, c3: 7.08,  vinf: 4.71, use: 'STEP 4 — PEOPLE' },
  { open: '2044-01-14', close: '2044-05-11', best: '2044-03-15', arrive: '2044-07-05', tof: 112, c3: 12.23, vinf: 5.18, use: 'Step 5 — Resupply' },
  { open: '2045-09-01', close: '2045-11-26', best: '2045-10-24', arrive: '2046-02-10', tof: 109, c3: 14.25, vinf: 4.35, use: 'Step 5 — Second crew' },
  { open: '2047-03-23', close: '2047-06-11', best: '2047-05-16', arrive: '2047-10-23', tof: 160, c3: 6.34,  vinf: 4.04, use: 'Step 5 — Outpost' },
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
  { metric: 'Round trip',            venus: '459 d',         mars: '990 d',        win: 'venus', note: 'Same solver, same years. Venus gets you home a year and a half sooner.' },
  { metric: 'Gravity',               venus: '0.904 g',       mars: '0.379 g',      win: 'venus', note: 'Your bones stop noticing below about 0.4 g. Venus is barely partial at all.' },
  { metric: 'Air overhead',          venus: '1,200 g/cm²',   mars: '21 g/cm²',     win: 'venus', note: 'More shielding at 50 km than you get at sea level on Earth.' },
  { metric: 'Pressure',              venus: '1.05 atm',      mars: '0.006 atm',    win: 'venus', note: 'A Venus habitat is not a pressure vessel. A Mars habitat always is.' },
  { metric: 'Temperature',           venus: '80 – 167 °F',   mars: '−81 °F',       win: 'venus', note: 'Hot, but hot in the range an air conditioner handles. Pick your altitude, pick your climate.' },
  { metric: 'Sunlight',              venus: '2,601 W/m²',    mars: '586 W/m²',     win: 'venus', note: 'Almost twice what Earth gets. Mars gets less than half.' },
  { metric: 'Closest approach',      venus: '38 M km',       mars: '55 M km',      win: 'venus', note: 'Venus is, and has always been, the nearest planet.' },
  { metric: 'Launch windows',        venus: 'every 584 d',   mars: 'every 780 d',  win: 'venus', note: 'More chances to go. More chances to come home early.' },
  { metric: 'Solid ground',          venus: 'none',          mars: 'yes',          win: 'mars',  note: 'The real cost. Venus is a sky you visit, not ground you stand on.' },
  { metric: 'Re-entry speed home',   venus: '14.1 km/s',     mars: '~11.5 km/s',   win: 'mars',  note: 'The hardest number here. Nobody has ever come home this fast.' },
  { metric: 'Water',                 venus: 'in the acid',   mars: 'buried ice',   win: 'mars',  note: 'On Venus you cook water out of sulfuric acid. On Mars you dig.' }
];

/* ---- Program --------------------------------------------- */
PHOS.PHASES = [
  {
    id: 0, tag: 'Step 0', name: 'Look first', years: '2026 — 2032',
    status: 'funded',
    thesis: 'Five spacecraft already on the books answer the questions a crew would bet their lives on.',
    items: [
      { name: 'Venus Life Finder', who: 'Rocket Lab / MIT', when: '2026', what: 'A 45-pound probe hunting for organic molecules in the clouds. Under $10 million.' },
      { name: 'Shukrayaan-1', who: 'ISRO', when: '2028', what: 'Orbiter. Arrives four months after launch.' },
      { name: 'DAVINCI', who: 'NASA', when: '2030', what: 'Drops through the whole atmosphere, sniffing it on the way down.' },
      { name: 'VERITAS', who: 'NASA', when: '2031', what: 'Radar maps. Is Venus still geologically alive?' },
      { name: 'EnVision', who: 'ESA', when: '2031', what: 'Watches the surface for change.' }
    ],
    cost: 1.9
  },
  {
    id: 1, tag: 'Step 1', name: 'Send a balloon', years: '2031 — 2032',
    status: 'proposed', window: 'Leaves May 22, 2031',
    thesis: 'One uncrewed balloon, one Venus year in the clouds. Everything that must not surprise a crew gets surprised here first.',
    items: [
      { name: 'The balloon', who: '6,000 m³ at 52 km', when: '225 days minimum', what: 'Flies the exact skin the crewed ship will wear, through 45 days and nights of acid and heat.' },
      { name: 'Making oxygen', who: 'solid-oxide cells', when: 'continuous', what: 'Cracks the CO₂ outside into oxygen and lift gas. Proves a balloon here need not have a lifetime.' },
      { name: 'Making water', who: 'droplet collector', when: 'continuous', what: 'Pulls sulfuric acid from the cloud and splits it. Water is the part that matters.' }
    ],
    cost: 0.9
  },
  {
    id: 2, tag: 'Step 2', name: 'Send the real ship, empty', years: '2034 — 2036',
    status: 'proposed', window: 'Leaves June 9, 2034',
    thesis: 'The crewed airship flies to Venus with nobody aboard, and stays. If it survives two years, it becomes the lifeboat.',
    items: [
      { name: 'Hull number one', who: '129 m × 34 m', when: 'indefinite', what: 'Identical to the crewed ship minus life support. Flies the whole entry, inflation and cruise.' },
      { name: 'Starts making air', who: 'on station from 2034', when: '8 years', what: '11.5 kg a day, every day, until the crew arrives to a hull that is already full of something breathable.' }
    ],
    cost: 4.6
  },
  {
    id: 3, tag: 'Step 3', name: 'Park the ride home', years: '2037 — 2041',
    status: 'proposed', window: 'Oct 2037 · May 2039 · Dec 2040',
    thesis: 'The way back gets sent to Venus, fueled and checked out, three windows before anyone leaves Earth.',
    items: [
      { name: 'Vesper', who: 'two-stage LOX/methane', when: 'arrives April 2038', what: 'About 8 km/s from 50 km up to orbit. The hardest single piece in the whole plan.' },
      { name: 'Supplies', who: 'strapped to the hull', when: 'arrives Oct 2039', what: '400 crew-days of margin above the 30-day plan, floating and waiting.' },
      { name: 'Dress rehearsal', who: 'the full stack', when: 'Dec 2040', what: 'Vesper flies 50 km → orbit → rendezvous with nobody in it. The abort works before it has to.' }
    ],
    cost: 7.2
  },
  {
    id: 4, tag: 'Step 4', name: 'People', years: '2042 — 2043',
    status: 'flagship', window: 'Leaves July 27, 2042 · home Oct 29, 2043',
    thesis: 'Four people leave Earth. Two of them spend a month in the only place off Earth where you can stand at one atmosphere in a t-shirt.',
    items: [
      { name: 'Out', who: '124 days', when: 'July 27, 2042', what: 'One 3.5 km/s burn out of low Earth orbit.' },
      { name: 'Arrive', who: '11.3 km/s at the top of the air', when: 'Nov 28, 2042', what: 'The atmosphere does the braking. Two stay in orbit; the airship goes in direct with the other two.' },
      { name: 'A month in the clouds', who: '2 crew, 51–55 km', when: 'Nov – Dec 2042', what: 'Five times around the planet, chasing the sun by day and coasting high at night. About two-thirds of the month in daylight.' },
      { name: 'Home', who: '305 days', when: 'Dec 28, 2042', what: 'Up to orbit, meet the ship, burn for Earth. Hits the atmosphere at 14.06 km/s — see the risks.' }
    ],
    cost: 17.8
  },
  {
    id: 5, tag: 'Step 5', name: 'Stay', years: '2045 — 2055',
    status: 'proposed', window: 'every 584 days',
    thesis: 'Visits stretch from a month to a Venus year. One more hull every window, and it stops being a trip.',
    items: [
      { name: 'Year-long stays', who: 'four in the clouds', when: 'from 2045', what: 'The 2045 window is the shortest round trip of the decade: 439 days.' },
      { name: 'One hull per window', who: 'docked side by side', when: 'every 584 d', what: 'A cluster is harder to lose than a single ship.' },
      { name: 'Close the loop', who: 'C, O, N, H, S', when: 'by 2050', what: 'Every element a body needs is in the air outside — except, fittingly, phosphorus.' }
    ],
    cost: 12.0
  }
];

/* ---- Fleet ----------------------------------------------- */
PHOS.FLEET = [
  {
    code: 'ONE', name: 'Hesperus', role: 'The ride there and back',
    mass: '~55 t', crew: '4',
    line: 'Where four people live for fifteen months. Only ever touches an atmosphere to slow down.',
    specs: [
      ['Living space', '~180 m³'],
      ['Trip length', '459 days'],
      ['Storm shelter', 'water wall + polyethylene'],
      ['Waits in orbit', '30 days, 2 crew aboard'],
      ['Engines', 'LOX/methane, 3.6 km/s to leave Venus']
    ]
  },
  {
    code: 'TWO', name: 'Phosphorus', role: 'The cloud ship',
    mass: '~85 t', crew: '2',
    line: 'A 129-meter hull that is also a house, floating at one atmosphere.',
    specs: [
      ['Hull', '129 m × 34 m, 77,500 m³'],
      ['Skin', '~11,100 m² at ~200 g/m²'],
      ['Lift', '46,000 m³ helium + 31,500 m³ breathable air'],
      ['Carries', '83.6 t gross → ~63 t useful'],
      ['Floats at', '51 km by day, 55 km at night'],
      ['Power', '~1,000 m² thin-film solar + fuel cells'],
      ['Propulsion', '2 × 9 m electric props, 10 m/s upwind by day']
    ]
  },
  {
    code: 'THREE', name: 'Vesper', role: 'The ride back up',
    mass: '~40 t fueled', crew: '2',
    line: 'Sent ahead in 2038. Launches to orbit from a balloon at 50 km — the hardest thing here.',
    specs: [
      ['Stages', 'two, LOX/methane'],
      ['Needs', '~8.0 km/s to reach orbit'],
      ['Launches from', '50 km — above 98.8% of the air'],
      ['Orbit speed', '7.15 km/s'],
      ['Has this been done', 'no, never, at any size']
    ]
  },
  {
    code: 'FOUR', name: 'Lucifer', role: 'The heat shield home',
    mass: '~12 t', crew: '4',
    line: 'Brings the crew through Earth\'s air at 14.06 km/s. Nothing has ever done this.',
    specs: [
      ['Entry speed', '14.06 km/s'],
      ['Fastest crew ever', '11.07 km/s, Apollo 10'],
      ['Fastest anything', '12.9 km/s, Stardust, uncrewed'],
      ['Option A', 'brake with ~12 t of propellant first'],
      ['Option B', 'take the slow way home — 833 days']
    ]
  }
];

/* ---- Envelope laminate, outside in ----------------------- */
PHOS.LAMINATE = [
  { layer: 'PTFE / FEP film',           thick: '25 µm', why: 'The acid barrier. VEGA flew woven PTFE in these clouds for two days in 1985 and it held.' },
  { layer: 'Aluminized PET',            thick: '12 µm', why: 'Bounces sunlight and heat so the lift gas stays cool under a sky twice as bright as ours.' },
  { layer: 'Zylon PBO / Vectran weave', thick: 'woven', why: 'Carries every ounce of load. What modern Venus balloon designs all end up using.' },
  { layer: 'Polyurethane barrier',      thick: '20 µm', why: 'Keeps the helium in. Helium is the one thing Venus cannot make for you.' }
];

/* ---- Life aloft ------------------------------------------ */
PHOS.ALOFT = {
  circumnavKm: 38340,        // derived: 2*pi*(6051.8+50)
  windMs: [60, 95],
  /* The ship chases the sun: by day it floats low and flies upwind at
     10 m/s on solar surplus; at night it climbs to 55 km and coasts on
     the fastest air. Day and night are measured against the Sun, not
     the ground. derived — scripts/sunchase.py */
  chase: { dayKm: 51, nightKm: 55, airspeedMs: 10, propKw: 73 },
  dayHours: 88,
  nightHours: 54,
  sunPct: 62,
  cycleDays: 5.9,
  driftNightHours: [54, 83],  // what the night would be if the ship only drifted
  solarVsEarthSurface: '+40%',
  loops: [
    { name: 'Oxygen',     in: 'CO₂ from outside',        out: 'O₂ to breathe, CO to burn', how: 'Solid-oxide electrolysis. MOXIE did this on Mars in 2021.' },
    { name: 'Water',      in: 'sulfuric acid droplets',  out: 'H₂O',                      how: 'Catch the acid, heat it, keep the water. The clouds are the well.' },
    { name: 'Nitrogen',   in: '3.5% of the air',         out: 'cabin buffer gas',         how: 'Venus holds more than three times the nitrogen in Earth\'s whole atmosphere.' },
    { name: 'Lift',       in: 'CO₂',                     out: 'CO + O₂ lift gas',         how: 'The same cells that make oxygen top up the balloon. It never has to come down.' }
  ]
};

/* ---- Cost ------------------------------------------------
   Order-of-magnitude, 2026 US dollars. Built bottom-up from the
   phase table; see README.md for the basis of estimate. */
PHOS.COSTS = {
  phases: [
    { name: 'Step 0 — Look first',           usd: 1.9,  note: 'Already funded' },
    { name: 'Step 1 — Send a balloon',       usd: 0.9,  note: 'One uncrewed flight' },
    { name: 'Step 2 — The real ship, empty', usd: 4.6,  note: 'First hull plus launch' },
    { name: 'Step 3 — Park the ride home',   usd: 7.2,  note: 'Vesper is most of this' },
    { name: 'Step 4 — People',               usd: 17.8, note: 'Crew ship, life support, operations' },
    { name: 'Step 5 — Stay',                 usd: 12.0, note: 'Four more hulls, longer stays' }
  ],
  total: 44.4,
  years: 20,
  perYear: 2.2,
  launchMassT: 450,
  launchCostLo: 0.09,
  launchCostHi: 0.225,
  marsEstimates: [
    { label: 'First crewed Mars mission, 2035 estimate', usd: 230 },
    { label: 'Half a trillion (L. Garver, former NASA deputy)', usd: 500 },
    { label: 'Up to $1 trillion over 25 years (P. Lee, Mars Institute)', usd: 1000 }
  ]
};

/* ---- The honest column ----------------------------------- */
PHOS.RISKS = [
  {
    rank: 1, name: 'Coming home at 14.06 km/s', severity: 'critical',
    what: 'The fast itinerary brings the crew into Earth\'s air 27% faster than any person ever has. Apollo 10 hit 11.07. The fastest thing ever, Stardust, hit 12.9 with nobody aboard.',
    fix: 'Spend propellant — about 12 tons to slow down first — or spend time. The gentle return exists, but it makes the trip 833 days and the whole argument about duration falls apart.'
  },
  {
    rank: 2, name: 'Launching to orbit from a balloon', severity: 'critical',
    what: 'Vesper has to deliver 8 km/s with no launch pad, no hold-downs, and a hull full of helium directly overhead. Nothing has ever launched to orbit from a balloon, at any size.',
    fix: 'Step 3 flies the whole climb and rendezvous with nobody aboard, in 2040, before a single person commits. Dropping below the hull before lighting solves the plume problem. Proving it is a decade of work.'
  },
  {
    rank: 3, name: 'A month in sulfuric acid', severity: 'high',
    what: 'The clouds are 80 to 98% sulfuric acid. VEGA\'s balloons lasted two days. A crew needs thirty, and a settlement needs decades.',
    fix: 'This is exactly what Step 1 is for: one empty balloon, one Venus year, the real skin. If it fails there, the program stops there — cheaply.'
  },
  {
    rank: 4, name: 'Cooling off in a hot sky', severity: 'high',
    what: 'At 50 km it is 167 °F outside. Radiators need somewhere colder to dump heat into, and there is nowhere.',
    fix: 'Altitude is the thermostat. Low and slow by day to stay in the light, with cooling the biggest thing the array pays for; up to 55 km and 80 °F at night, where the heat finally has somewhere to go.'
  },
  {
    rank: 5, name: 'Nights that last two days', severity: 'medium',
    what: 'Nothing that floats can hold still under the sun here. Even chasing it, the ship spends 54 of every 142 hours in the dark.',
    fix: 'Fuel cells sized for 430 kWh carry 8 kW through the night, charged by sunlight almost twice as strong as ours.'
  },
  {
    rank: 6, name: 'There is no ground', severity: 'structural',
    what: 'The surface is 860 °F at 92 atmospheres. Nothing built has lasted more than 127 minutes there. Every settlement idea that assumes dirt is off the table.',
    fix: 'None. This is the trade, not a problem. Venus gives you a sky and refuses you a floor. If you need ground, go to Mars.'
  },
  {
    rank: 7, name: 'No water to drink', severity: 'medium',
    what: 'The cloud droplets are, chemically, a hundred times drier than anything alive can use. That is probably why nothing lives there — and why you cannot just scoop a glass.',
    fix: 'You cook water out of the acid instead. It costs energy, and energy is the one thing Venus is not short of.'
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
  { tag: 'Astrobiology', cite: 'Greaves et al., “Phosphine gas in the cloud decks of Venus”, Nature Astronomy 2021; re-analysis arXiv:2011.08176', url: 'https://arxiv.org/abs/2011.08176' },
  { tag: 'Astrobiology', cite: 'Villanueva et al., “No evidence of phosphine in the atmosphere of Venus from independent analyses”, Nature Astronomy 2021', url: 'https://www.nature.com/articles/s41550-021-01422-z' },
  { tag: 'Chemistry',    cite: 'Spacek et al., “Iron-sulfur chemistry can explain the ultraviolet absorber in the clouds of Venus”, Science Advances 2024', url: 'https://www.science.org/doi/10.1126/sciadv.adg8826' },
  { tag: 'Geology',      cite: 'Herrick & Hensley, “Surface changes observed on a Venusian volcano during the Magellan mission”, Science 2023', url: 'https://www.jpl.nasa.gov/news/ongoing-venus-volcanic-activity-discovered-with-nasas-magellan-data/' },
  { tag: 'Dynamics',     cite: 'Lai et al., “Contribution of Thermal Tides to Venus Upper Cloud-Layer Superrotation”, AGU Advances 2025', url: 'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025AV001880' },
  { tag: 'Climate',      cite: 'Venus’ D/H ratio and the lost ocean — Donahue et al., Science 1982; Way & Del Genio, JGR Planets 2020', url: 'https://www.giss.nasa.gov/pubs/abs/wa02800e.html' },
  { tag: 'Flight data',  cite: 'Sagdeev et al., “Overview of VEGA Venus Balloon in Situ Meteorological Measurements”, Science 1986', url: 'https://www.science.org/doi/10.1126/science.231.4744.1411' },
  { tag: 'Cost',         cite: 'The Cost of SLS and Orion, The Planetary Society', url: 'https://www.planetary.org/space-policy/cost-of-sls-and-orion' },
  { tag: 'Viewer',       cite: '3D Solar System — Venus', url: 'https://3dsolarsystem.online/viewer/#venus' }
];

/* ============================================================
   SCIENCE — what the mission is actually for
   ============================================================ */

/* The open questions. `probe` is what an uncrewed mission can reach;
   `crew` is what a laboratory with hands in it adds. */
PHOS.SCIENCE = [
  {
    n: 1, tag: 'Life', name: 'Is anything alive in the clouds?',
    known: 'Phosphine was reported in 2020, argued down from 20 to a few parts per billion, and is still disputed. No one has found a way to make it without life in air this oxidizing. Against it: the droplets are a hundred times drier, chemically, than anything we know can live.',
    probe: 'One fall through the clouds, one look, no second chances.',
    crew: 'Thirty days of catching cloud, putting it under a microscope, testing it, trying to grow it — and going back for the same air on the next lap.'
  },
  {
    n: 2, tag: 'Chemistry', name: 'What is eating the sunlight?',
    known: 'Something in the upper cloud soaks up about half the solar energy Venus takes in, and after sixty years nobody knows what it is. And the big particles Pioneer Venus measured were the wrong shape to be liquid acid — so something solid is up there too.',
    probe: 'Spectra from a distance and a few seconds of sampling on the way down.',
    crew: 'Fly to its altitude, catch it, and look at it. Nobody has ever held it still.'
  },
  {
    n: 3, tag: 'Weather', name: 'Why does the sky spin sixty times faster than the planet?',
    known: 'Venus turns once in 243 days. Its atmosphere laps the planet in four. We mostly understand the mechanism now, but the accounting still does not close — and the same physics runs on every tidally locked planet out there.',
    probe: 'Winds tracked from orbit, at one altitude, inferred from the top.',
    crew: 'At night the ship is a tracer — it goes where the air goes, with a full weather station. By day it flies against the flow and feels every gust. Drop probes through the shear and you measure the answer instead of inferring it.'
  },
  {
    n: 4, tag: 'Climate', name: 'Did Venus have an ocean, and when did it go?',
    known: 'The heavy-hydrogen signature says a lot of water once left — somewhere between a few meters and a few hundred, globally. Whether that happened in the first hundred million years or the last three billion decides whether Earth-sized worlds are usually Earths or usually Venuses.',
    probe: 'DAVINCI measures this once, on one descent, through one column of air.',
    crew: 'Repeat measurements at the precision a falling probe cannot hold, at many latitudes, with blanks and standards. A dataset instead of a data point.'
  },
  {
    n: 5, tag: 'Geology', name: 'Is Venus erupting right now?',
    known: 'A vent on Maat Mons changed shape between two radar passes in 1991 — the first direct sign of an eruption, and it implies several a year. Nobody has caught one happening.',
    probe: 'Radar from orbit, months between looks.',
    crew: 'Volcanic gases show up below the clouds. When an orbiter flags a plume, someone on station drops a probe into it that afternoon.'
  },
  {
    n: 6, tag: 'Living there', name: 'Can a closed loop actually run on Venus air?',
    known: 'Carbon, oxygen, nitrogen, sulfur and hydrogen are all outside the hull. Each conversion has worked somewhere. Nobody has run the whole loop — oxygen, water, nitrogen, lift gas — together, at size, in acid.',
    probe: 'One reaction at a time, on the bench.',
    crew: 'Thirty days of real people breathing real air closed against a real atmosphere. This is the experiment that decides whether Step 5 is a settlement or a series of visits.'
  }
];

/* Sampling stations, top to bottom. Everything except the ship itself is
   deployed from it and most of it is expendable. */
PHOS.SAMPLING = [
  { km: 62, name: 'Tethered package, sent up',    dur: 'hours · comes back',  gets: 'The mystery absorber, at its own altitude.',       kit: 'particle catcher · UV spectrometer' },
  { km: 54, name: 'The ship, top of the band',    dur: 'continuous',          gets: 'Upper cloud. Coolest and brightest.',              kit: 'aerosol inlet · microscope · mass spec' },
  { km: 52, name: 'The ship, home altitude',      dur: '30 days',             gets: 'The lab. Everything comes back here.',             kit: 'wet lab · culture bay · isotopes · weather' },
  { km: 50, name: 'The ship, bottom of the band', dur: 'continuous',          gets: 'Densest cloud, strongest acid, most lift.',        kit: 'droplet collector · pH cell' },
  { km: 45, name: 'Tethered package, sent down',  dur: 'hours · comes back',  gets: 'Below the cloud, where volcanic gases show up.',   kit: 'gas chromatograph · SO₂ / H₂S sniffers' },
  { km: 30, name: 'Drop probe',                   dur: '~20 min · expended',  gets: 'The deep atmosphere, on demand.',                 kit: 'pressure · temperature · wind' },
  { km: 0,  name: 'Surface probe',                dur: '~2 hours · expended', gets: 'A look at the ground and what it is made of.',     kit: 'camera · X-ray fluorescence' }
];

/* ============================================================
   CONSTRUCTION — how the hull gets made, packed and filled
   ============================================================ */

PHOS.BUILD = [
  {
    step: 'Cut', where: 'on Earth',
    head: 'Sixty-nine panels, nine kilometers of seam',
    body: 'The hull is 107 m around at its widest and the acid-proof skin comes off the roll about five feet wide, so it gets cut into 69 tapering panels. The seams are heat-welded, not glued — there is nothing for the acid to eat.',
    num: '9.4 km', numlab: 'of welded seam'
  },
  {
    step: 'Fold', where: 'on Earth',
    head: 'A 77,500 m³ hull fits in about two and a half cubic meters',
    body: 'The skin is about a tenth of a millimeter thick. Over the whole hull that is 1.4 m³ of actual material — a closet, folded. The shell it rides in is sized by the crew cabin, not the ship.',
    num: '30,700 : 1', numlab: 'inflated to packed'
  },
  {
    step: 'Inflate', where: 'at Venus, 72 → 52 km',
    head: 'Seven minutes from probe to ship',
    body: 'Helium starts flowing at 72 km under a parachute and the hull is full by 52. Venera did the entry, VEGA inflated balloons at 54 km in 1985, HIAD has flown the decelerator — never all at once, and never this big. The 6.8 tons of helium is the one thing that has to come from Earth.',
    num: '6.8 t', numlab: 'of helium, shipped'
  },
  {
    step: 'Fill', where: 'at Venus, eight years',
    head: 'The air the crew breathes gets made before they leave home',
    body: 'The lower hull holds 34 tons of breathable air — more than the ship could ever carry up — so the empty hull from Step 2 makes it on site, with the same oxygen and nitrogen loops the crew will live on, at 11.5 kg a day for eight years.',
    num: '11.5 kg/day', numlab: 'for eight years'
  }
];

PHOS.LIFT_NOTE = {
  heOnly: 46.2,
  withAir: 63.1,
  airMass: 33.6
};

/* ============================================================
   LIFE ALOFT — the sun-chasing cycle and what it is like
   ============================================================ */

/* derived — scripts/sunchase.py. One sun-chasing cycle for each day-side
   float altitude and airspeed; the night is always coasted at 55 km.
   Day and night are measured against the Sun. */
PHOS.SUNCHASE = [
  { km: 50, u:  0, wind: 60, dayH:  83.5, nightH: 53.9, lapDays: 5.72, sunPct: 61, propKw:   0, storageKwh: 431, lift: 66.8 },
  { km: 50, u:  5, wind: 60, dayH:  90.6, nightH: 53.9, lapDays: 6.02, sunPct: 63, propKw:  10, storageKwh: 431, lift: 66.8 },
  { km: 50, u: 10, wind: 60, dayH:  99.0, nightH: 53.9, lapDays: 6.37, sunPct: 65, propKw:  81, storageKwh: 431, lift: 66.8 },
  { km: 50, u: 15, wind: 60, dayH: 109.1, nightH: 53.9, lapDays: 6.79, sunPct: 67, propKw: 273, storageKwh: 431, lift: 66.8 },
  { km: 51, u:  0, wind: 67, dayH:  75.2, nightH: 53.9, lapDays: 5.38, sunPct: 58, propKw:   0, storageKwh: 431, lift: 61.8 },
  { km: 51, u:  5, wind: 67, dayH:  80.9, nightH: 53.9, lapDays: 5.62, sunPct: 60, propKw:   9, storageKwh: 431, lift: 61.8 },
  { km: 51, u: 10, wind: 67, dayH:  87.6, nightH: 53.9, lapDays: 5.90, sunPct: 62, propKw:  73, storageKwh: 431, lift: 61.8 },
  { km: 51, u: 15, wind: 67, dayH:  95.4, nightH: 53.9, lapDays: 6.22, sunPct: 64, propKw: 247, storageKwh: 431, lift: 61.8 },
  { km: 52, u:  0, wind: 75, dayH:  67.6, nightH: 53.9, lapDays: 5.06, sunPct: 56, propKw:   0, storageKwh: 431, lift: 54.3 },
  { km: 52, u:  5, wind: 75, dayH:  72.2, nightH: 53.9, lapDays: 5.25, sunPct: 57, propKw:   8, storageKwh: 431, lift: 54.3 },
  { km: 52, u: 10, wind: 75, dayH:  77.4, nightH: 53.9, lapDays: 5.47, sunPct: 59, propKw:  66, storageKwh: 431, lift: 54.3 },
  { km: 52, u: 15, wind: 75, dayH:  83.5, nightH: 53.9, lapDays: 5.73, sunPct: 61, propKw: 221, storageKwh: 431, lift: 54.3 },
  { km: 53, u:  0, wind: 82, dayH:  62.1, nightH: 53.9, lapDays: 4.83, sunPct: 54, propKw:   0, storageKwh: 431, lift: 49.0 },
  { km: 53, u:  5, wind: 82, dayH:  65.9, nightH: 53.9, lapDays: 4.99, sunPct: 55, propKw:   7, storageKwh: 431, lift: 49.0 },
  { km: 53, u: 10, wind: 82, dayH:  70.3, nightH: 53.9, lapDays: 5.18, sunPct: 57, propKw:  60, storageKwh: 431, lift: 49.0 },
  { km: 53, u: 15, wind: 82, dayH:  75.2, nightH: 53.9, lapDays: 5.38, sunPct: 58, propKw: 201, storageKwh: 431, lift: 49.0 },
  { km: 54, u:  0, wind: 90, dayH:  56.8, nightH: 53.9, lapDays: 4.61, sunPct: 51, propKw:   0, storageKwh: 431, lift: 44.1 },
  { km: 54, u:  5, wind: 90, dayH:  60.0, nightH: 53.9, lapDays: 4.75, sunPct: 53, propKw:   7, storageKwh: 431, lift: 44.1 },
  { km: 54, u: 10, wind: 90, dayH:  63.6, nightH: 53.9, lapDays: 4.90, sunPct: 54, propKw:  53, storageKwh: 431, lift: 44.1 },
  { km: 54, u: 15, wind: 90, dayH:  67.6, nightH: 53.9, lapDays: 5.06, sunPct: 56, propKw: 180, storageKwh: 431, lift: 44.1 },
];

/* Why the ship cannot simply park under the sun: the airspeed needed to
   hold the sub-solar longitude at 52 km, the propulsive power that costs
   (drag on a 34 m hull goes as speed cubed) and what a 1,000 m² array
   makes at that latitude. derived — scripts/sunchase.py */
PHOS.SUNKEEP = [
  { lat:  0, wind: 75, airspeed: 71, propKw:    23648, solarKw: 210 },
  { lat: 30, wind: 75, airspeed: 72, propKw:    24159, solarKw: 182 },
  { lat: 50, wind: 75, airspeed: 73, propKw:    25027, solarKw: 135 },
  { lat: 60, wind: 58, airspeed: 56, propKw:    11779, solarKw: 105 },
  { lat: 70, wind: 40, airspeed: 39, propKw:     3770, solarKw:  72 },
  { lat: 75, wind: 30, airspeed: 29, propKw:     1634, solarKw:  54 },
  { lat: 80, wind: 20, airspeed: 20, propKw:      493, solarKw:  36 },
  { lat: 85, wind: 10, airspeed: 10, propKw:       62, solarKw:  18 },
];

PHOS.EXPERIENCE = [
  { k: 'Weight',        v: '0.904 g',              d: 'You walk. Nothing floats, nothing needs strapping down, and the puffy face and thinning bones of a Mars trip just do not happen. Of everything here, this is what a crew would feel most.' },
  { k: 'The view',      v: 'a few hundred yards',  d: 'You are inside the cloud, not above it. Think heavy fog. No horizon, and the ground is never visible — thirty miles of haze below. Venus is the place you go to and never see.' },
  { k: 'The light',     v: 'bright overcast',      d: 'Yellowish-white, shadowless, from every direction at once. Plenty to read by.' },
  { k: 'The sound',     v: 'a breeze by day',      d: 'By day the props are on and there is a steady twenty-knot breeze over the hull. At sunset they stop, you climb, and the ship goes quiet: fans, pumps, the oxygen plant — and in rough air, the hull working above you.' },
  { k: 'The weather',   v: 'real',                 d: 'In 1985 the VEGA balloons hit downdrafts that shoved them a mile and a half below where they wanted to be, in gusts lasting about an hour. The ship rides it. You buckle in.' },
  { k: 'Going outside', v: 'not a spacewalk',      d: 'Outside is one atmosphere and about 140 °F. No pressure difference means no pressure suit — you need an acid-proof coverall, cooling, and your own air. Closer to a hazmat job than an EVA, which is why fixing the hull can be routine.' },
  { k: 'The airlock',   v: 'a rinse',              d: 'The danger coming back in is not vacuum, it is acid on your suit. So the lock is a shower: water, then neutralizer, then the inner door.' },
  { k: 'The clock',     v: 'yours to set',         d: 'Out there, daylight runs about 88 hours and the night about 54. You keep a 24-hour clock on the lights and treat the sun outside as weather.' }
];

PHOS.CREW_DETAIL = [
  {
    role: 'Commander', station: 'Hesperus · in orbit', days: 459,
    duties: ['Owns the decision to leave', 'Flies the burn for home', 'Never goes down'],
    why: 'Somebody has to be able to call it, and they cannot be 50 km down in a balloon when they do.'
  },
  {
    role: 'Flight engineer', station: 'Hesperus · in orbit', days: 459,
    duties: ['Keeps the ride home alive for 30 days', 'Relays for the crew below', 'Second pilot for the rendezvous'],
    why: 'The NASA study left this seat empty. A crewed way home is worth two seats.'
  },
  {
    role: 'Pilot', station: 'Phosphorus · in the clouds', days: 30,
    duties: ['Flies the ship: buoyancy, altitude, heat', 'Runs the oxygen and water plants', 'Goes outside when something needs fixing'],
    why: 'Flying it and cooling it are the same job, and somebody has to do it hour by hour.'
  },
  {
    role: 'Scientist', station: 'Phosphorus · in the clouds', days: 30,
    duties: ['Chemist and astrobiologist', 'Runs the wet lab and the culture bay', 'Decides where the probes go'],
    why: 'The reason the trip is worth taking, and the one job that cannot be done from orbit.'
  }
];
