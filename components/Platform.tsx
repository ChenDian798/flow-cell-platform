'use client';
import dynamic from 'next/dynamic';
import { useEffect, useReducer, useState } from 'react';
import { Action, CELL, cellFill, Config, DEFAULTS, FLUID_INFO, FLUIDS, MIX_COLOR, Machine, PLATE, SPOT_COUNT, configErrors, configWarnings, contentColor, cycle, cycleSeconds, disabledReason, formatTime, initial, request, runSeconds, spotPosition, status, tick, togglePause } from '@/lib/system';
import type { CameraView } from './Scene';
import Schematic from './Schematic';
import Mounting from './Mounting';
const Scene = dynamic(() => import('./Scene'), { ssr: false, loading: () => <div className="scene-loading">Initializing platform geometry…</div> });

type Event = { type: 'tick'; dt: number } | { type: 'action'; action: Action } | { type: 'pause' } | { type: 'reset' } | { type: 'config'; config: Config };
function reducer(m: Machine, e: Event): Machine {
  if (e.type === 'tick') return tick(m, e.dt);
  if (e.type === 'action') return request(m, e.action);
  if (e.type === 'pause') return togglePause(m);
  if (e.type === 'config') return initial(e.config);
  return initial(m.config);
}
const SPEEDS = [60, 300, 1200];

function SpotMap({ machine }: { machine: Machine }) {
  const active = machine.queue[0]?.spot ?? machine.spot;
  const cells = Array.from({ length: SPOT_COUNT }, (_, i) => ({ i, pos: spotPosition(i) })).sort((a, b) => a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0]);
  return <div className="spot-map" aria-label="Plate spot map">{cells.map(({ i }) => <span key={i} className={`${machine.done[i] ? 'done' : ''} ${i === active ? 'active' : ''} ${i >= machine.config.spots ? 'unused' : ''}`}>{i + 1}</span>)}</div>;
}
function Operate({ machine, act, pause, reset, speed, setSpeed }: { machine: Machine; act: (a: Action) => void; pause: () => void; reset: () => void; speed: number; setSpeed: (s: number) => void }) {
  const st = status(machine), step = st.step, inCell = cellFill(machine).content;
  const rows: [string, string][] = [
    ['Current step', step ? step.name : 'Idle'], ['Step time left', step ? formatTime(step.seconds - machine.elapsed) : '—'],
    ['Pumps', st.flowing ? 'ON' : 'OFF'], ['Outlet valve', st.outlet],
    ['Potentiostat', st.echem], ['Plate', machine.sealed ? 'SEALED' : 'LOWERED'],
    ['Cell content', inCell === 'Mix' ? 'Deposition mix' : inCell === 'Empty' ? 'Empty' : FLUID_INFO[inCell].name], ['Spot', `${(step?.spot ?? machine.spot) + 1} / ${machine.config.spots}`]
  ];
  return <div>
    <div className="control-intro"><span className={`status-dot ${machine.queue.length && !machine.paused ? 'live' : ''}`}/><b>{machine.paused ? 'Paused' : step ? `Spot ${step.spot + 1} · ${step.name}` : 'Ready'}</b><span className="micro">IDEALIZED · PLAYBACK {speed}× REAL TIME</span></div>
    <button className="primary run" disabled={!!disabledReason(machine, 'all')} title={disabledReason(machine, 'all') ?? ''} onClick={() => act('all')}><span>▶</span> Run all remaining spots <span>→</span></button>
    <div className="button-grid">
      <button disabled={!!disabledReason(machine, 'spot')} title={disabledReason(machine, 'spot') ?? ''} onClick={() => act('spot')}>Run current spot</button>
      <button onClick={pause} disabled={!machine.queue.length}>{machine.paused ? '▶ Resume' : 'Ⅱ Pause'}</button>
      <button onClick={reset}>↺ Reset</button>
      <div className="segmented speed">{SPEEDS.map(s => <button key={s} className={speed === s ? 'selected' : ''} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
    </div>
    <p className="footnote">One cycle per spot: seal → deposit (flow) → rinse → fill UPD → CV / EIS (static) → rinse → drain with air → lower plate → move. Real time per spot ≈ <b>{formatTime(cycleSeconds(machine.config))}</b>; all {machine.config.spots} spots ≈ <b>{formatTime(runSeconds(machine.config))}</b>.</p>
    <h3>Live state</h3>
    <dl className="status-grid">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={['ON', 'WASTE', 'DEPOSITION', 'CV / EIS', 'SEALED'].includes(v) ? 'on' : ''}>{v}</dd></div>)}</dl>
    <h3>Plate · {PLATE.grid} × {PLATE.grid} spots</h3>
    <SpotMap machine={machine}/>
    <p className="footnote">Purple: deposited. Ring: current spot. Order is serpentine, so every move is one {PLATE.pitch} mm step.</p>
  </div>;
}
const FIELDS: { key: keyof Config; label: string; unit: string; step: number }[] = [
  { key: 'depFlow', label: 'Deposition flow (total)', unit: 'μL/min', step: 10 },
  { key: 'fracA', label: 'Stock A fraction', unit: '0–1', step: .05 },
  { key: 'fracB', label: 'Stock B fraction', unit: '0–1', step: .05 },
  { key: 'depTime', label: 'Deposition time', unit: 'min', step: 1 },
  { key: 'rinseFlow', label: 'Rinse / fill / air flow', unit: 'μL/min', step: 50 },
  { key: 'rinseVolume', label: 'Rinse volume', unit: 'μL', step: 100 },
  { key: 'updVolume', label: 'UPD fill volume', unit: 'μL', step: 100 },
  { key: 'analysisTime', label: 'CV / EIS time', unit: 'min', step: 1 },
  { key: 'drainTime', label: 'Air drain time', unit: 's', step: 5 },
  { key: 'spots', label: 'Spots to run', unit: `1–${SPOT_COUNT}`, step: 1 }
];
function Parameters({ config, locked, change }: { config: Config; locked: boolean; change: (c: Config) => void }) {
  const [draft, setDraft] = useState(config);
  useEffect(() => setDraft(config), [config]);
  const errors = configErrors(draft), warnings = configWarnings(draft);
  const water = 1 - draft.fracA - draft.fracB;
  return <div>
    <p className="panel-copy">Placeholder values for a first water test, not a validated recipe. Editing resets the run. Water makes up the rest of the deposition feed, which sets the stock concentrations in the cell.</p>
    <fieldset className="parameter-fields" disabled={locked}>
      {FIELDS.map(f => <label key={f.key}>{f.label}<div><input type="number" step={f.step} value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: Number(e.target.value) })}/><small>{f.unit}</small></div></label>)}
      <button className="primary" disabled={errors.length > 0} onClick={() => change(draft)}>Apply parameters</button>
    </fieldset>
    {locked && <p className="footnote">Locked while a sequence is loaded. Reset first.</p>}
    <div className={`geometry-card ${errors.length || warnings.length ? 'invalid' : ''}`}>
      <h3>Deposition feed</h3>
      <dl>
        <div><dt>Stock A in cell</dt><dd>{(draft.fracA * 100).toFixed(0)}% of stock</dd></div>
        <div><dt>Stock B in cell</dt><dd>{(draft.fracB * 100).toFixed(0)}% of stock</dd></div>
        <div><dt>Water (diluent)</dt><dd>{(Math.max(0, water) * 100).toFixed(0)}%</dd></div>
        <div><dt>Cell volume (v1)</dt><dd>≈{CELL.volume} μL</dd></div>
        <div><dt>Cell volumes per rinse</dt><dd>{(draft.rinseVolume / CELL.volume).toFixed(1)}×</dd></div>
      </dl>
      {(errors.length > 0 || warnings.length > 0) && <ul>{[...errors, ...warnings].map(t => <li key={t}>{t}</li>)}</ul>}
    </div>
  </div>;
}
function DesignNotes() {
  const items: [string, string][] = [
    ['FROM THE EARLIER DESIGN', 'One peristaltic channel per reservoir, an inlet check valve on every channel and one manifold feeding one line. Only the destination changed: a fixed flow cell instead of a robot nozzle.'],
    ['REMOVED', 'Gas gaps, the Ar cylinder, regulator, flow controller and solenoid. A spot finishes before the next one starts, so liquids never need to be separated in the line; a water rinse does that instead.'],
    ['ADDED · STATIC MIXER', 'Deposition co-pumps stock A, stock B and water at a set ratio. The mixer makes the concentration uniform before the cell. Its mixing quality and dead volume are untested.'],
    ['ADDED · AIR CHANNEL', 'A fifth pump channel pushes filtered room air to empty the cell before the plate is lowered, so liquid does not spill onto the next spots. It is not a gas gap.'],
    ['ADDED · OUTLET VALVE', 'Closes for the static CV / EIS step and while the plate moves, so the cell does not drain or siphon.'],
    ['MOTION', 'The cell and Raman objective stay fixed. The XYZ stage lowers the plate, moves one spot and raises it to seal. Mounting and fixing are left for the next step.']
  ];
  return <div className="explanations">
    {items.map(([k, v]) => <div className="rationale" key={k}><span>{k}</span><p>{v}</p></div>)}
    <h3>Not yet included</h3>
    <ul className="concerns">
      <li>Reaction feed reservoir and the electro-organic synthesis step with in-situ Raman</li>
      <li>Product collection for NMR / HPLC-MS</li>
      <li>Surface modification (not decided)</li>
      <li>Real tube sizes, flow limits and pump model</li>
    </ul>
    <h3>Needs experimental checks</h3>
    <ul className="concerns">
      <li>Ratio accuracy and pulsation of peristaltic co-pumping</li>
      <li>Carry-over after the water rinse</li>
      <li>Liquid film left after the air drain</li>
      <li>Bubbles under the window after filling</li>
    </ul>
  </div>;
}
function Sequence({ machine }: { machine: Machine }) {
  const step = machine.queue[0], spot = step?.spot ?? machine.spot;
  const steps = cycle(machine.config, spot, spot === machine.config.spots - 1);
  const remaining = machine.queue.filter(s => s.spot === spot).length;
  const doneCount = step ? steps.length - remaining : machine.done[spot] ? steps.length : 0;
  return <section className="panel sequence">
    <div className="panel-heading"><h2><span className="section-number">04</span> Cycle at spot {spot + 1}</h2><span className="micro">REAL DURATIONS · NO ELECTROCHEMISTRY SIMULATED</span></div>
    <ol className="timeline" style={{ gridTemplateColumns: `repeat(${steps.length},1fr)` }}>{steps.map((s, i) => <li key={i} className={`${i < doneCount ? 'done' : ''} ${step && i === doneCount ? 'active' : ''}`}><span>{i < doneCount ? '✓' : String(i + 1).padStart(2, '0')}</span><b>{s.name}</b><small>{formatTime(s.seconds)}</small></li>)}</ol>
    {step && <div className="sequence-progress"><i style={{ width: `${machine.elapsed / step.seconds * 100}%` }}/></div>}
    <div className="log-block"><div><h3>Log</h3><p className="footnote">One deterministic clock drives the 3D model, the diagram and the state.</p></div><ol aria-live="polite">{machine.log.slice(-5).map((line, i) => <li key={`${machine.log.length}-${i}`}><span>{String(Math.max(0, machine.log.length - 5) + i + 1).padStart(2, '0')}</span>{line}</li>)}</ol></div>
  </section>;
}

export default function Platform() {
  const [machine, dispatch] = useReducer(reducer, DEFAULTS, initial);
  const [tab, setTab] = useState('Operate');
  const [camera, setCamera] = useState<CameraView>('iso');
  const [labels, setLabels] = useState(true);
  const [speed, setSpeed] = useState(SPEEDS[0]);
  const running = machine.queue.length > 0 && !machine.paused;
  useEffect(() => {
    if (!running) return;
    let frame = 0, last = performance.now();
    const advance = (now: number) => { dispatch({ type: 'tick', dt: Math.min(.1, (now - last) / 1000) * speed }); last = now; frame = requestAnimationFrame(advance); };
    frame = requestAnimationFrame(advance); return () => cancelAnimationFrame(frame);
  }, [running, speed]);
  const legend: [string, string][] = [...FLUIDS.filter(f => f !== 'Air').map(f => [FLUID_INFO[f].name, FLUID_INFO[f].color] as [string, string]), ['Deposition mix', MIX_COLOR], ['Air', contentColor('Air')]];
  return <main className="instrument">
    <header className="header"><div className="brand-mark"><span/><span/><span/></div><div className="brand">REACTOR LAB <span>CONCEPT INSTRUMENT / 02</span></div></header>
    <div className="title-row"><div><p className="eyebrow">FLOW CELL · IN-SITU RAMAN · 16-SPOT PLATE</p><h1>Single Flow Cell<br/><span>& Spot-by-Spot Fluidics</span></h1><p className="subtitle">Four reservoirs and an air line on separate pump channels, one manifold, a fixed cell and a plate that moves one spot per cycle.</p></div><div className="prototype-badge"><span className="status-dot"/> CONCEPTUAL PROTOTYPE <small>FLUIDIC LAYOUT · NOT TO SCALE</small></div></div>
    <div className="notice">Conceptual model of the tubing layout and sequence. Sizes, mounting, flow rates and timings are placeholders and need experimental validation.</div>
    <div className="workspace">
      <section className="panel model-panel">
        <div className="panel-heading"><h2><span className="section-number">01</span> Platform model</h2><span className={`state-pill ${running ? 'running' : ''}`}>{machine.paused ? 'PAUSED' : running ? 'SEQUENCE RUNNING' : 'STANDBY'}</span></div>
        <div className="model-toolbar"><div className="segmented">{(['iso', 'top', 'side', 'cell'] as const).map(c => <button key={c} className={camera === c ? 'selected' : ''} onClick={() => setCamera(c)}>{c === 'iso' ? 'Isometric' : c === 'top' ? 'Top' : c === 'side' ? 'Side' : 'Cell close-up'}</button>)}</div><label className="toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/>Labels</label></div>
        <div className="model-canvas"><Scene machine={machine} view={camera} labels={labels}/>
          <div className="scene-key"><b>LIQUIDS</b>{legend.map(([n, c]) => <span key={n}><i style={{ background: c }}/>{n}</span>)}</div>
          <div className="scene-hint">Drag to orbit · scroll to zoom · right-drag to pan · not to scale</div>
        </div>
        <p className="model-note">The cell, objective and fluidics are fixed; only the plate and stage carriage move. The cell body is drawn transparent so the chamber is visible.</p>
      </section>
      <aside className="panel sidebar"><div className="tabs" role="tablist" aria-label="Panels">{['Operate', 'Parameters', 'Design notes'].map(t => <button role="tab" aria-selected={tab === t} className={tab === t ? 'selected' : ''} key={t} onClick={() => setTab(t)}>{t}</button>)}</div><div className="sidebar-content" role="tabpanel">
        {tab === 'Operate' ? <Operate machine={machine} act={action => dispatch({ type: 'action', action })} pause={() => dispatch({ type: 'pause' })} reset={() => dispatch({ type: 'reset' })} speed={speed} setSpeed={setSpeed}/>
          : tab === 'Parameters' ? <Parameters config={machine.config} locked={machine.queue.length > 0} change={config => dispatch({ type: 'config', config })}/>
          : <DesignNotes/>}
      </div></aside>
    </div>
    <Schematic machine={machine}/>
    <Mounting machine={machine}/>
    <Sequence machine={machine}/>
    <footer><p><b>Flow cell v1</b> · Ø{CELL.chamberD} mm chamber, {CELL.liquidHeight} mm liquid height, ≈{CELL.area} cm² working area per spot.</p><p>Idealized sequence for layout discussion. No flow, mixing or electrochemistry is simulated.</p></footer>
  </main>;
}
