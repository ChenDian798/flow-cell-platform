'use client';
import { FLUID_INFO, INLET_ORDER, Machine, cellFill, contentColor, feedContent, status } from '@/lib/system';

// 2D connection diagram. Channels are drawn in manifold order so the head (air) is at the left and the outlet at the right.
const CH_X = (i: number) => 70 + i * 85;
const MANIFOLD_Y = 233;
function CheckValve({ x, y, open }: { x: number; y: number; open: boolean }) {
  return <g transform={`translate(${x} ${y}) rotate(90)`}><title>Inlet check valve: lets this channel into the manifold and blocks backflow</title>
    <rect x={-10} y={-9} width={20} height={18} rx={3} fill="white" stroke="#607989"/><path d="M-6 -6V6L4 0Z" fill={open ? '#007b79' : '#b8c2ca'}/><path d="M6 -6V6" stroke="#36505f" strokeWidth={2}/>
  </g>;
}
export default function Schematic({ machine }: { machine: Machine }) {
  const st = status(machine), fill = cellFill(machine);
  const line = contentColor(feedContent(st.pumps) ?? machine.line), lineOn = st.flowing;
  const outletOpen = st.outlet === 'WASTE', echem = st.echem !== 'OFF';
  const level = 50 * fill.level;
  return <section className="schematic panel">
    <div className="panel-heading"><h2><span className="section-number">02</span> Fluidic connection diagram</h2><span className="micro">ONE CELL AT A TIME · NO GAS GAPS</span></div>
    <div className="svg-scroll"><svg viewBox="0 0 1000 320" role="img" aria-label="Five reservoirs on separate peristaltic channels and check valves into a manifold, then a static mixer, the fixed flow cell, an outlet valve and waste">
      <defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="#66798a"/></marker></defs>
      <rect x={35} y={125} width={415} height={32} rx={6} fill={lineOn ? '#eef7f5' : '#f6f8f9'} stroke="#607989"/>
      <text x={458} y={138}>5-channel</text><text x={458} y={151}>peristaltic pump</text>
      {INLET_ORDER.map((f, i) => {
        const x = CH_X(i), flow = st.pumps[f] ?? 0, on = flow > 0, color = FLUID_INFO[f].color;
        return <g key={f}>
          {f === 'Air'
            ? <g><rect x={x - 16} y={52} width={32} height={38} rx={4} fill="#f3f6f8" stroke={on ? '#007b79' : '#95a3af'} strokeWidth={on ? 2.5 : 1.2}/><path d={`M${x - 10} 60 L${x + 10} 82 M${x - 10} 70 L${x + 2} 84 M${x - 2} 58 L${x + 10} 72`} stroke="#a6b4be"/><text x={x} y={42} textAnchor="middle">Air + filter</text></g>
            : <g><path d={`M ${x - 26} 30 V 82 Q ${x - 26} 92 ${x - 16} 92 H ${x + 16} Q ${x + 26} 92 ${x + 26} 82 V 30 Z`} fill={color + '18'} stroke={on ? '#007b79' : '#95a3af'} strokeWidth={on ? 2.5 : 1.2}/><rect x={x - 19} y={58} width={38} height={28} rx={3} fill={color} opacity={.6}/><text x={x} y={22} textAnchor="middle">{FLUID_INFO[f].name}</text></g>}
          <path d={`M ${x} ${f === 'Air' ? 90 : 92} V 128 M ${x} 154 V 186 M ${x} 204 V 225`} fill="none" stroke={color} strokeWidth={on ? 3 : 1.5}/>
          <g><title>{`Pump channel · ${FLUID_INFO[f].name}`}</title><circle cx={x} cy={141} r={11} fill={on ? '#d7eeeb' : 'white'} stroke="#607989"/><path d={`M ${x - 7} 141 H ${x + 7} M ${x} 134 V 148`} stroke={on ? '#007b79' : '#607989'} strokeWidth={2}/></g>
          {on && <text x={x + 15} y={176} fontSize={9} fill="#007b79">{flow.toFixed(0)} μL/min</text>}
          <CheckValve x={x} y={195} open={on}/>
        </g>;
      })}
      <g><title>Manifold: every channel enters through its own check valve; air and water at the head sweep all inlets</title>
        <rect x={40} y={MANIFOLD_Y - 8} width={430} height={16} rx={4} fill="#f1ebe1" stroke="#8d7f6a"/>
        <path d={`M 48 ${MANIFOLD_Y} H 470`} stroke={lineOn ? line : '#a8b7c4'} strokeWidth={3}/>
      </g>
      <text x={48} y={268} fontSize={10}>Manifold · head (air) → outlet</text>
      <path d={`M 470 ${MANIFOLD_Y} H 490 ${Array.from({ length: 8 }, (_, k) => `L ${498 + k * 9} ${MANIFOLD_Y + (k % 2 ? -9 : 9)}`).join(' ')} L 572 ${MANIFOLD_Y} H 606`} fill="none" stroke={lineOn ? line : '#a8b7c4'} strokeWidth={3} markerEnd="url(#arrow)"/>
      <text x={530} y={268} textAnchor="middle" fontSize={10}>Static mixer</text>
      <g><title>Raman objective, fixed above the quartz window</title>
        <path d="M 640 150 H 670 L 664 192 H 646 Z" fill="#3a4148"/><text x={655} y={140} textAnchor="middle">Raman objective (fixed)</text>
      </g>
      <g><title>Flow cell v1: fixed; sealed against the plate by the bottom O-ring</title>
        <rect x={610} y={205} width={90} height={50} rx={3} fill="#e7ebee" stroke="#607989"/>
        <rect x={632} y={198} width={46} height={6} fill="#cfefff" stroke="#8fb9cf"/>
        <rect x={635} y={205} width={40} height={50} fill="white" stroke="#9aa7b1"/>
        {level > .5 && <rect x={635} y={255 - level} width={40} height={level} fill={contentColor(fill.content)} opacity={.8}/>}
        <text x={655} y={300} textAnchor="middle" fontSize={10}>Flow cell · {fill.content === 'Empty' ? 'empty' : fill.content === 'Mix' ? 'deposition mix' : FLUID_INFO[fill.content].name}</text>
      </g>
      <rect x={585} y={256} width={140} height={8} fill={machine.sealed ? '#59626b' : '#7c858d'}/>
      <rect x={600} y={267} width={110} height={12} rx={2} fill="#dde4e9" stroke="#a8b7c4"/>
      <text x={655} y={314} textAnchor="middle" fontSize={9}>WE plate on XYZ stage · {machine.sealed ? 'sealed' : 'lowered'}</text>
      <g><title>Potentiostat: working electrode = plate spot, counter and reference electrodes in the cell</title>
        <rect x={760} y={40} width={110} height={44} rx={5} fill={echem ? '#d8eeea' : '#f3f6f8'} stroke="#607989"/>
        <text x={815} y={60} textAnchor="middle">Potentiostat</text><text x={815} y={75} textAnchor="middle" fontSize={10} fill={echem ? '#007b79' : '#7d8f9b'}>{st.echem}</text>
        <path d="M 610 215 H 590 V 100 H 780 V 84" fill="none" stroke={echem ? '#cfa53a' : '#b8c2ca'} strokeDasharray="4 3"/><text x={594} y={114} fontSize={9}>CE</text>
        <path d="M 700 215 H 730 V 108 H 815 V 84" fill="none" stroke={echem ? '#cfa53a' : '#b8c2ca'} strokeDasharray="4 3"/><text x={734} y={124} fontSize={9}>RE</text>
        <path d="M 725 260 H 850 V 84" fill="none" stroke={echem ? '#cfa53a' : '#b8c2ca'} strokeDasharray="4 3"/><text x={855} y={250} fontSize={9}>WE</text>
      </g>
      <path d={`M 700 ${MANIFOLD_Y} H 752`} stroke={outletOpen && lineOn ? contentColor(fill.content) : '#a8b7c4'} strokeWidth={3}/>
      <g><title>Outlet valve: open to waste while liquid flows, closed for static steps and while the plate moves</title>
        <rect x={752} y={MANIFOLD_Y - 11} width={34} height={22} rx={3} fill={outletOpen ? '#d2eeea' : 'white'} stroke="#607989"/>
        <path d={outletOpen ? `M757 ${MANIFOLD_Y} H781` : `M769 ${MANIFOLD_Y - 7} V${MANIFOLD_Y + 7}`} stroke="#007b79" strokeWidth={3}/>
        <text x={769} y={MANIFOLD_Y - 18} textAnchor="middle" fontSize={10}>Outlet valve · {st.outlet}</text>
      </g>
      <path d={`M 786 ${MANIFOLD_Y} H 905 V 252`} fill="none" stroke={outletOpen && lineOn ? contentColor(fill.content) : '#a8b7c4'} strokeWidth={3} markerEnd="url(#arrow)"/>
      <path d="M 880 255 V 296 Q 880 304 888 304 H 922 Q 930 304 930 296 V 255 Z" fill="#a2937d33" stroke="#95a3af"/><text x={905} y={318} textAnchor="middle" fontSize={10}>Waste</text>
    </svg></div>
    <div className="delivery-state">
      <span>Pumping: <b>{st.flowing ? Object.entries(st.pumps).map(([f, q]) => `${f} ${q!.toFixed(0)}`).join(' · ') + ' μL/min' : 'none'}</b></span>
      <span>Outlet valve: <b>{st.outlet}</b></span><span>Potentiostat: <b>{st.echem}</b></span>
      <span>Plate: <b>{machine.sealed ? 'SEALED' : 'LOWERED'}</b></span><span>Spot: <b>{machine.spot + 1} / 16</b></span>
    </div>
    <p className="footnote">Each reservoir has its own pump channel and inlet check valve, as in the earlier single-line design. Gas gaps and the Ar supply are gone: the cell finishes one spot before the next starts, so only one liquid is in the line at a time and a water rinse separates them. For deposition, stock A, stock B and water run together at a set ratio and meet in the static mixer, which sets the concentration in the cell. Air from the fifth channel empties the cell before the plate is lowered, so no liquid spills onto neighbouring spots. Schematic, not to scale.</p>
  </section>;
}
