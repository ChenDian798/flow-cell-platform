'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Machine, SPRING, liftState } from '@/lib/system';
import type { MountView } from './MountScene';
const MountScene = dynamic(() => import('./MountScene'), { ssr: false, loading: () => <div className="scene-loading">Initializing mounting frame…</div> });

// Off-the-shelf parts for the frame and lift. Keywords are for Taobao / 1688 searches; specs must be checked per listing.
const PARTS: [string, string, string, string][] = [
  ['Frame and beams', '2040 aluminium extrusion, corner brackets, T-nuts', '欧标铝型材 2040 · 角码', 'Beam stiffness over the span'],
  ['Base', 'Optical breadboard or extrusion base', '光学面包板 · 铝型材底板', 'Flat, rigid enough for the stage'],
  ['Spectrometer focus', 'Manual Z translation stage', '手动 Z 轴位移台 · 手动升降台', 'Load > spectrometer mass; 10–25 mm travel'],
  ['Spot change and lift', 'Motorized XYZ stage (stepper, lead screw)', '电动 XYZ 位移台 · 电动十字滑台', 'XY ≥ 100 mm; Z ≥ 10 mm; Z vertical load > 6 kg'],
  ['Seal force', 'Compression springs (×4), OD ≤ 10 mm, free length 17 mm', '压缩弹簧', '1–3 N/mm each for 20–60 N in total (estimate); buy two or three rates'],
  ['Keep the tray level', 'Ø6 guide shafts + LM6UU linear bearings + shaft collars (×4)', '光轴 6mm 一端攻丝 · 直线轴承 LM6UU · 轴环 6mm', 'Shaft 45 mm long; bearings press-fit, test the fit first'],
  ['WE contact', 'Spring-loaded contact pin', '弹簧顶针 · pogo pin', 'Stroke covers the tray movement'],
  ['Cell adapter, spring trays', 'Printed parts (only custom items)', '3D printed', 'Slotted holes to centre the cell under the objective']
];

export default function Mounting({ machine }: { machine: Machine }) {
  const [view, setView] = useState<MountView>('iso');
  const [labels, setLabels] = useState(true);
  const lift = liftState(machine);
  return <section className="panel mounting">
    <div className="panel-heading"><h2><span className="section-number">03</span> Mounting concept · off-the-shelf frame</h2><span className="micro">SAME CLOCK AS 01 · SIZES INDICATIVE</span></div>
    <div className="model-toolbar">
      <div className="segmented">{(['iso', 'front', 'side', 'cell'] as const).map(v => <button key={v} className={view === v ? 'selected' : ''} onClick={() => setView(v)}>{v === 'iso' ? 'Isometric' : v === 'front' ? 'Front' : v === 'side' ? 'Side' : 'Cell + spring tray'}</button>)}</div>
      <label className="toggle"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)}/>Labels</label>
    </div>
    <div className="model-canvas"><MountScene machine={machine} view={view} labels={labels}/>
      <div className="scene-key"><b>PARTS</b><span><i style={{ background: '#c3cad0' }}/>Extrusion frame (buy)</span><span><i style={{ background: '#38434d' }}/>Motorized XYZ stage (buy)</span><span><i style={{ background: '#e9b44c' }}/>Printed adapter and trays</span><span><i style={{ background: '#59626b' }}/>WE plate</span></div>
      <div className="scene-hint">Drag to orbit · scroll to zoom · right-drag to pan · run the sequence in 01 to see the lift</div>
    </div>
    <div className="delivery-state">
      <span>Plate: <b>{lift.plate >= 0 ? 'SEALED' : `${(-lift.plate).toFixed(1)} mm below cell`}</b></span>
      <span>Z carriage: <b>{lift.carriage >= 0 ? `+${lift.carriage.toFixed(1)}` : lift.carriage.toFixed(1)} mm</b></span>
      <span>Spring compression: <b>{lift.compression.toFixed(1)} / {SPRING.overtravel} mm</b></span>
    </div>
    <div className="parts-table"><table>
      <thead><tr><th>Function</th><th>Off-the-shelf part</th><th>Search keywords</th><th>Check</th></tr></thead>
      <tbody>{PARTS.map(([f, p, k, c]) => <tr key={f}><td>{f}</td><td>{p}</td><td>{k}</td><td>{c}</td></tr>)}</tbody>
    </table></div>
    <p className="footnote">The cell hangs under the beams on a printed adapter and M3 spacers; the spectrometer sits on a manual Z stage on the same frame, so the objective stays fixed relative to the window and only needs focusing once. The XYZ stage changes spots and lifts a spring tray: the plate meets the cell's contact boss first and the springs take the remaining {SPRING.overtravel} mm of Z travel, so the seal force comes from the springs, not from where the Z axis stops. Four guide shafts in linear bearings keep the top tray level, so a corner spot does not tilt the plate against the cell. Spring force, stage load rating and beam stiffness are estimates to confirm with real parts.</p>
  </section>;
}
