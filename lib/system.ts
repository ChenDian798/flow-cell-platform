// Deterministic model of the single-cell flow platform: fluids, one cycle per spot, and a pause-compatible clock.
// Real durations are in seconds; the UI plays them back faster.

export type Fluid = 'A' | 'B' | 'Water' | 'UPD' | 'Air';
export type Content = Fluid | 'Mix' | 'Empty';
export type Outlet = 'WASTE' | 'CLOSED';
export type Echem = 'OFF' | 'DEPOSITION' | 'CV / EIS';
export type StepKind = 'seal' | 'deposit' | 'rinse' | 'fill' | 'analyse' | 'drain' | 'unseal' | 'move';

export const FLUIDS: Fluid[] = ['A', 'B', 'Water', 'UPD', 'Air'];
// Manifold inlets from the upstream head to the outlet. Air and water sit at the head so draining and rinsing sweep every inlet.
export const INLET_ORDER: Fluid[] = ['Air', 'Water', 'UPD', 'B', 'A'];
export const FLUID_INFO: Record<Fluid, { name: string; color: string; role: string }> = {
  A: { name: 'Stock A', color: '#0072b2', role: 'Stock solution 1 for deposition' },
  B: { name: 'Stock B', color: '#d55e00', role: 'Stock solution 2 for deposition' },
  Water: { name: 'Water', color: '#56b4e9', role: 'Rinse and diluent' },
  UPD: { name: 'UPD', color: '#009e73', role: 'Electroanalysis solution (static)' },
  Air: { name: 'Air', color: '#b8c4cc', role: 'Drains the cell before the seal opens' }
};
export const MIX_COLOR = '#7a5aa6';
export function contentColor(c: Content) {
  return c === 'Mix' ? MIX_COLOR : c === 'Empty' ? '#ffffff' : FLUID_INFO[c].color;
}

// Cell, plate and mount geometry, taken from the CAD scripts (cell_v1.py + mount_v1.py, cell_debug.py + mount_debug.py).
// Heights are from the plate surface; the body sits on the contact boss from 0 to `underside`.
export type DesignId = 'v1' | 'debug';
export type Design = {
  id: DesignId; name: string; short: string; scripts: string;
  cell: {
    chamberD: number; liquidHeight: number; volume: number; area: number;
    bodyW: number; underside: number; bodyTop: number; bossD: number; windowD: number; windowT: number;
    retainerW: number; retainerT: number; aperture: number; towerStart: number; towerTop: number; mountPos: number;
  };
  plate: { size: number; pitch: number; grid: number; lift: number };
  mount: { adapterHole: number; tray: number; guideAt: number; pogo: number; screw: string; seal: [number, number]; springRate: string };
};
export const DESIGNS: Record<DesignId, Design> = {
  v1: {
    id: 'v1', name: 'Flow cell v1', short: 'v1 · Ø12 chamber · Raman', scripts: 'cell_v1 + mount_v1',
    cell: {
      chamberD: 12, liquidHeight: 4.4, volume: 537, area: 1.13,
      bodyW: 40, underside: 1.2, bodyTop: 5.25, bossD: 20, windowD: 20, windowT: 1,
      retainerW: 28, retainerT: 2, aperture: 14, towerStart: 14.5, towerTop: 6.5, mountPos: 17
    },
    plate: { size: 110, pitch: 25, grid: 4, lift: 3 },
    mount: { adapterHole: 34, tray: 140, guideAt: 62, pogo: 48, screw: 'M3 × 12', seal: [20, 60], springRate: '1–3 N/mm' }
  },
  debug: {
    id: 'debug', name: 'Flow cell debug', short: 'debug · Ø24 chamber · easier to see', scripts: 'cell_debug + mount_debug',
    cell: {
      chamberD: 24, liquidHeight: 4.4, volume: 2043, area: 4.52,
      bodyW: 60, underside: 1.2, bodyTop: 6.25, bossD: 32, windowD: 35, windowT: 2,
      retainerW: 48, retainerT: 2, aperture: 28, towerStart: 24.5, towerTop: 7.5, mountPos: 26.5
    },
    plate: { size: 130, pitch: 40, grid: 3, lift: 3 },
    mount: { adapterHole: 48, tray: 160, guideAt: 72, pogo: 58, screw: 'M3 × 14', seal: [40, 120], springRate: '2–7 N/mm' }
  }
};
export const spotCount = (d: Design) => d.plate.grid * d.plate.grid;

// Serpentine order so consecutive spots are always neighbours.
export function spotPosition(i: number, d: Design = DESIGNS.v1): [number, number] {
  const { grid, pitch } = d.plate;
  const row = Math.floor(i / grid), k = i % grid;
  const col = row % 2 === 0 ? k : grid - 1 - k;
  const offset = (grid - 1) / 2;
  return [(col - offset) * pitch, (row - offset) * pitch];
}

export type Config = {
  depFlow: number;      // μL/min, total deposition feed
  fracA: number;        // volume fraction of stock A in the deposition feed
  fracB: number;        // volume fraction of stock B; water makes up the rest
  depTime: number;      // min
  rinseFlow: number;    // μL/min, also used to fill UPD and to pump air
  rinseVolume: number;  // μL per rinse
  updVolume: number;    // μL pumped to replace water with UPD
  analysisTime: number; // min, static CV / EIS
  drainTime: number;    // s of air
  spots: number;        // spots to run, 1 to the plate's spot count
  design: DesignId;     // which cell and mount geometry
};
export const DEFAULTS: Config = {
  depFlow: 200, fracA: .2, fracB: .1, depTime: 15,
  rinseFlow: 1000, rinseVolume: 2700, updVolume: 1100,
  analysisTime: 5, drainTime: 60, spots: spotCount(DESIGNS.v1), design: 'v1'
};
export const designOf = (c: Config) => DESIGNS[c.design];
// Defaults for a design: rinse ≈ 5× and UPD fill ≈ 2× the cell volume, every spot on the plate.
export function defaultsFor(id: DesignId): Config {
  if (id === 'v1') return DEFAULTS;
  const d = DESIGNS[id];
  return { ...DEFAULTS, design: id, rinseVolume: Math.ceil(5 * d.cell.volume / 100) * 100, updVolume: Math.ceil(2.05 * d.cell.volume / 100) * 100, spots: spotCount(d) };
}
const SEAL_S = 5, MOVE_S = 20;

export function configErrors(c: Config): string[] {
  const e: string[] = [];
  if (c.fracA < 0 || c.fracB < 0) e.push('Stock fractions cannot be negative.');
  if (c.fracA + c.fracB > 1) e.push('Stock A + stock B fractions exceed 1; there is no room for diluent water.');
  if (c.depFlow <= 0 || c.rinseFlow <= 0) e.push('Flow rates must be positive.');
  if (c.depTime <= 0 || c.analysisTime <= 0 || c.drainTime <= 0) e.push('Times must be positive.');
  const n = spotCount(designOf(c));
  if (!Number.isInteger(c.spots) || c.spots < 1 || c.spots > n) e.push(`Spots must be a whole number from 1 to ${n}.`);
  return e;
}
export function configWarnings(c: Config): string[] {
  const w: string[] = [], CELL = designOf(c).cell;
  if (c.rinseVolume < 3 * CELL.volume) w.push(`Rinse volume is under 3× the cell volume (${3 * CELL.volume} μL); carry-over is likely.`);
  if (c.updVolume < 2 * CELL.volume) w.push(`UPD volume is under 2× the cell volume (${2 * CELL.volume} μL); water may remain in the cell.`);
  return w;
}

export type Step = {
  kind: StepKind; name: string; seconds: number; spot: number; toSpot?: number;
  pumps: Partial<Record<Fluid, number>>; outlet: Outlet; echem: Echem; content: Content;
};

export function depositionFlows(c: Config): Partial<Record<Fluid, number>> {
  const flows: Partial<Record<Fluid, number>> = { A: c.depFlow * c.fracA, B: c.depFlow * c.fracB, Water: c.depFlow * (1 - c.fracA - c.fracB) };
  for (const f of FLUIDS) if (!flows[f]) delete flows[f];
  return flows;
}

export function cycle(c: Config, spot: number, last: boolean): Step[] {
  const rinse = (n: number): Step => ({ kind: 'rinse', name: `Rinse ${n} · water`, seconds: c.rinseVolume / c.rinseFlow * 60, spot, pumps: { Water: c.rinseFlow }, outlet: 'WASTE', echem: 'OFF', content: 'Water' });
  const steps: Step[] = [
    { kind: 'seal', name: 'Raise plate · seal', seconds: SEAL_S, spot, pumps: {}, outlet: 'CLOSED', echem: 'OFF', content: 'Empty' },
    { kind: 'deposit', name: 'Electrodeposition · flow', seconds: c.depTime * 60, spot, pumps: depositionFlows(c), outlet: 'WASTE', echem: 'DEPOSITION', content: 'Mix' },
    rinse(1),
    { kind: 'fill', name: 'Fill UPD', seconds: c.updVolume / c.rinseFlow * 60, spot, pumps: { UPD: c.rinseFlow }, outlet: 'WASTE', echem: 'OFF', content: 'UPD' },
    { kind: 'analyse', name: 'CV / EIS · static', seconds: c.analysisTime * 60, spot, pumps: {}, outlet: 'CLOSED', echem: 'CV / EIS', content: 'UPD' },
    rinse(2),
    { kind: 'drain', name: 'Drain with air', seconds: c.drainTime, spot, pumps: { Air: c.rinseFlow }, outlet: 'WASTE', echem: 'OFF', content: 'Empty' },
    { kind: 'unseal', name: 'Lower plate · release seal', seconds: SEAL_S, spot, pumps: {}, outlet: 'CLOSED', echem: 'OFF', content: 'Empty' }
  ];
  if (!last) steps.push({ kind: 'move', name: `Move to spot ${spot + 2}`, seconds: MOVE_S, spot, toSpot: spot + 1, pumps: {}, outlet: 'CLOSED', echem: 'OFF', content: 'Empty' });
  return steps;
}
export const cycleSeconds = (c: Config) => cycle(c, 0, false).reduce((s, x) => s + x.seconds, 0);
export const runSeconds = (c: Config) => Array.from({ length: c.spots }, (_, i) => cycle(c, i, i === c.spots - 1)).flat().reduce((s, x) => s + x.seconds, 0);

export type Machine = {
  config: Config; queue: Step[]; elapsed: number; paused: boolean;
  spot: number; sealed: boolean; content: Content; line: Content; done: boolean[]; log: string[];
};
export function initial(config: Config = DEFAULTS): Machine {
  return { config, queue: [], elapsed: 0, paused: false, spot: 0, sealed: false, content: 'Empty', line: 'Empty', done: Array(spotCount(DESIGNS[config.design])).fill(false), log: ['Ready. Plate lowered at spot 1.'] };
}
const busy = (m: Machine) => m.queue.length > 0;
const lastSpot = (m: Machine) => m.config.spots - 1;

export type Action = 'spot' | 'all';
export function disabledReason(m: Machine, a: Action): string | null {
  if (busy(m)) return 'A sequence is running.';
  if (configErrors(m.config).length) return 'Fix the parameter errors first.';
  if (m.done[m.spot] && m.spot >= lastSpot(m)) return 'All spots are done. Reset to start again.';
  if (a === 'spot' && m.done[m.spot]) return 'This spot is done.';
  return null;
}
export function request(m: Machine, a: Action): Machine {
  if (disabledReason(m, a)) return m;
  const end = a === 'spot' ? m.spot : lastSpot(m);
  const queue = Array.from({ length: end - m.spot + 1 }, (_, k) => cycle(m.config, m.spot + k, m.spot + k === lastSpot(m))).flat();
  return { ...m, queue, elapsed: 0, paused: false, log: [...m.log, a === 'spot' ? `Running spot ${m.spot + 1}.` : `Running spots ${m.spot + 1}–${end + 1}.`].slice(-60) };
}
export function togglePause(m: Machine): Machine {
  if (!busy(m)) return m;
  return { ...m, paused: !m.paused, log: [...m.log, m.paused ? 'Resumed.' : 'Paused. Pumps stopped, outlet held.'].slice(-60) };
}

// What the pumps send into the line: one fluid, a mix of several, or nothing.
export function feedContent(pumps: Partial<Record<Fluid, number>>): Content | null {
  const feed = Object.keys(pumps) as Fluid[];
  return feed.length > 1 ? 'Mix' : feed.length === 1 ? feed[0] : null;
}

function complete(m: Machine, s: Step): Machine {
  let next: Machine = { ...m, content: s.content, line: feedContent(s.pumps) ?? m.line, queue: m.queue.slice(1), elapsed: 0 };
  if (s.kind === 'seal') next.sealed = true;
  if (s.kind === 'unseal') { next.sealed = false; next.done = m.done.map((d, i) => i === s.spot || d); }
  if (s.kind === 'move' && s.toSpot !== undefined) next.spot = s.toSpot;
  const msg = s.kind === 'unseal' ? `Spot ${s.spot + 1} complete.` : `Spot ${s.spot + 1}: ${s.name} done.`;
  next = { ...next, log: [...m.log, msg].slice(-60) };
  return next;
}
// Advance by dt seconds of real (scaled) time; a tick never crosses more than one step boundary at a time.
export function tick(m: Machine, dt: number): Machine {
  let next = m, left = dt;
  while (!next.paused && next.queue.length && left > 0) {
    const s = next.queue[0], need = s.seconds - next.elapsed;
    if (left < need) return { ...next, elapsed: next.elapsed + left };
    left -= need;
    next = complete(next, s);
  }
  return next;
}

export type Status = { step: Step | null; pumps: Partial<Record<Fluid, number>>; outlet: Outlet; echem: Echem; flowing: boolean; progress: number };
export function status(m: Machine): Status {
  const s = m.queue[0] ?? null;
  const pumps = s && !m.paused ? s.pumps : {};
  return {
    step: s, pumps,
    outlet: s ? (m.paused ? 'CLOSED' : s.outlet) : 'CLOSED',
    echem: s && !m.paused ? s.echem : 'OFF',
    flowing: Object.keys(pumps).length > 0,
    progress: s ? m.elapsed / s.seconds : 0
  };
}
// Liquid in the cell, shown as a level and colour while a step replaces one content with another.
export function cellFill(m: Machine): { content: Content; level: number } {
  const s = m.queue[0];
  if (!s) return { content: m.content, level: m.content === 'Empty' ? 0 : 1 };
  const p = Math.min(1, m.elapsed / Math.min(s.seconds, 30));
  if (s.kind === 'drain') return { content: m.content, level: m.content === 'Empty' ? 0 : 1 - p };
  if (Object.keys(s.pumps).length) return { content: p > .5 ? s.content : m.content === 'Empty' ? s.content : m.content, level: m.content === 'Empty' ? p : 1 };
  return { content: m.content, level: m.content === 'Empty' ? 0 : 1 };
}
// Plate offset under the fixed cell: x/z put the active spot below the cell; y lifts the plate to seal.
export function platePose(m: Machine): [number, number, number] {
  const s = m.queue[0], p = s ? Math.min(1, m.elapsed / s.seconds) : 0;
  const ease = p * p * (3 - 2 * p), d = designOf(m.config), lift = d.plate.lift;
  let [x, z] = spotPosition(m.spot, d), y = m.sealed ? 0 : -lift;
  if (s?.kind === 'seal') y = -lift * (1 - ease);
  if (s?.kind === 'unseal') y = -lift * ease;
  if (s?.kind === 'move' && s.toSpot !== undefined) {
    const [x2, z2] = spotPosition(s.toSpot, d);
    x += (x2 - x) * ease; z += (z2 - z) * ease;
  }
  return [-x, y, -z];
}
// Spring-loaded lift: the Z carriage travels past the sealing height and the springs under the plate take up the overtravel.
export const SPRING = { overtravel: 1.5, freeLength: 8 };
export function liftState(m: Machine): { carriage: number; plate: number; compression: number } {
  const lift = designOf(m.config).plate.lift;
  const s = (platePose(m)[1] + lift) / lift;
  const carriage = -lift + (lift + SPRING.overtravel) * s;
  const plate = Math.min(carriage, 0);
  return { carriage, plate, compression: carriage - plate };
}
export function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.round(seconds % 60);
  return h ? `${h} h ${m} min` : m ? `${m} min ${s ? `${s} s` : ''}`.trim() : `${s} s`;
}
