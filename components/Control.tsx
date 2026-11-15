'use client';
import { useState } from 'react';
import { FLUID_INFO, INLET_ORDER, Machine, designOf } from '@/lib/system';
import { PumpDrive, controlState, zSealed } from '@/lib/control';

// Computer-control diagram: one Windows PC runs the cycle, a controller board (MCU) drives the motors and the outlet
// valve, and the potentiostat and spectrometer are driven from the PC through their vendor SDKs.
const ON = '#007b79', OFF = '#b8c2ca', INK = '#607989';

function Node({ x, y, w, h, title, lines, on = false, dashed = false, tip }: { x: number; y: number; w: number; h: number; title: string; lines: string[]; on?: boolean; dashed?: boolean; tip: string }) {
  return <g><title>{tip}</title>
    <rect x={x} y={y} width={w} height={h} rx={5} fill={on ? '#e3f2ef' : dashed ? '#fbfcfd' : '#f5f8fa'} stroke={on ? ON : INK} strokeWidth={on ? 2 : 1} strokeDasharray={dashed ? '5 4' : undefined}/>
    <text x={x + 12} y={y + 19} fontWeight={600} fill="#2f4b5c">{title}</text>
    {lines.map((l, i) => <text key={i} x={x + 12} y={y + 35 + i * 14} fontSize={10}>{l}</text>)}
  </g>;
}
function Link({ d, on, label, lx, ly, dashed = false }: { d: string; on: boolean; label?: string; lx?: number; ly?: number; dashed?: boolean }) {
  return <g>
    <path d={d} fill="none" stroke={on ? ON : OFF} strokeWidth={on ? 3 : 1.5} strokeDasharray={dashed ? '5 4' : undefined} markerEnd={`url(#ctl-arrow-${on ? 'on' : 'off'})`}/>
    {label && <text x={lx} y={ly} fontSize={9} fill={on ? ON : '#8195a2'}>{label}</text>}
  </g>;
}

const PARTS = (drive: PumpDrive): [string, string, string, string, string][] => [
  ['Windows PC', '—', 'Runs the cycle in Python (pyserial for the board, vendor SDKs for the instruments)', 'Windows 电脑 · Python', 'Potentiostat and spectrometer software is usually Windows-only, so a Raspberry Pi cannot replace the PC'],
  ['Potentiostat', 'USB', 'PC · vendor SDK or scripting interface', '电化学工作站 · SDK · 二次开发 · 远程控制', 'Ask the vendor whether deposition, CV and EIS can be started and saved from a script'],
  ['Raman spectrometer', 'USB', 'PC · vendor SDK', '拉曼光谱仪 · SDK', 'Trigger an acquisition and save the spectrum from Python; not in the cycle yet'],
  ['Controller board (MCU)', 'USB serial · G-code', 'PC', '3D 打印机主板 · BTT Octopus · Klipper / Marlin', drive === 'board' ? '8 driver slots: 3 stage axes + 5 pump motors' : '3 driver slots for the stage; pumps are on RS485'],
  ['Stepper drivers', 'On the board', 'Board', '步进驱动 TMC2209', 'Set the current for each motor; quiet mode for the pumps'],
  ['Motorized XYZ stage', 'Stepper motors + endstops', 'Board', '电动 XYZ 位移台 · 步进电机 · 限位开关', 'If the stage comes with its own controller, it connects to the PC instead and the board keeps only pumps and valve'],
  drive === 'board'
    ? ['Peristaltic pumps ×5', 'Stepper motors', 'Board', '蠕动泵头 · 步进电机', 'Calibrate μL per step for each channel and tube']
    : ['Peristaltic pumps ×5', 'RS485 / Modbus', 'PC through a USB–RS485 adapter', '蠕动泵 RS485 · Modbus · USB 转 485', 'Each pump needs its own address on the bus'],
  ['Outlet valve', '24 V output (MOSFET)', 'Board', '电磁夹管阀 24V 常闭', 'Normally closed, so the cell holds its liquid if the power fails'],
  ['Switches and sensors', 'Board inputs', 'Board', '微动开关 · 漏液传感器 · 非接触液位/气泡传感器', 'Seal switch confirms contact; a leak stops the pumps; the bubble sensor confirms filling and draining'],
  ['Camera (optional)', 'LAN', 'Raspberry Pi', '树莓派 · 摄像头模块', 'Only for watching the debug cell; not needed to run the cycle'],
  ['Power', '24 V supply', '—', '24V 开关电源', 'Drivers and valve; the instruments use their own supplies']
];

export default function Control({ machine }: { machine: Machine }) {
  const [drive, setDrive] = useState<PumpDrive>('board');
  const c = controlState(machine, drive), d = designOf(machine.config);
  const pumpsOn = c.pumps.length > 0;
  return <section className="panel control">
    <div className="panel-heading"><h2><span className="section-number">04</span> Computer control · PC + controller board</h2><span className="micro">SAME CLOCK AS 01 · ARCHITECTURE, NOT A WIRING DIAGRAM</span></div>
    <div className="model-toolbar">
      <span className="micro">PUMPS</span>
      <div className="segmented">
        <button className={drive === 'board' ? 'selected' : ''} onClick={() => setDrive('board')}>Stepper pump heads on the board</button>
        <button className={drive === 'rs485' ? 'selected' : ''} onClick={() => setDrive('rs485')}>Commercial pumps on RS485</button>
      </div>
    </div>
    <div className="svg-scroll"><svg viewBox="0 0 1000 390" role="img" aria-label="Control architecture: a PC drives the potentiostat and the spectrometer over USB and a controller board over USB serial; the board drives the XYZ stage, the pumps and the outlet valve and reads the switches and sensors">
      <defs>{(['on', 'off'] as const).map(k => <marker key={k} id={`ctl-arrow-${k}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill={k === 'on' ? ON : OFF}/></marker>)}</defs>

      <Node x={30} y={130} w={170} h={110} on={!!c.step && !c.paused} title="Windows PC" tip="Runs the whole cycle and talks to every device"
        lines={['Python orchestrator', 'runs the cycle in 01', c.step ? (c.paused ? 'PAUSED' : `step: ${c.step.name}`) : 'idle']}/>
      <Node x={30} y={300} w={170} h={56} dashed title="Raspberry Pi + camera" tip="Optional: a camera over the debug cell to watch filling and bubbles" lines={['optional · LAN · watch the cell']}/>
      <Link d="M 115 240 V 296" on={false} dashed/>

      <Node x={300} y={20} w={200} h={64} on={c.potentiostat} title="Potentiostat" tip="Started and read from the PC through the vendor SDK" lines={['USB · vendor SDK', c.potentiostat ? (c.step?.echem ?? '') : 'OFF']}/>
      <Node x={300} y={100} w={200} h={64} title="Raman spectrometer" tip="Driven from the PC through the vendor SDK; no Raman step in the current cycle" lines={['USB · vendor SDK', 'not in the cycle yet']}/>
      <Node x={300} y={180} w={200} h={92} on={c.board} title="Controller board (MCU)" tip="Receives G-code from the PC; drives stepper motors and the valve, reads switches and sensors"
        lines={['e.g. BTT Octopus · Klipper', 'USB serial · G-code', `${drive === 'board' ? 8 : 3} stepper drivers in use`, 'valve output · sensor inputs']}/>
      <Node x={300} y={300} w={200} h={56} title="Switches and sensors" tip="Inputs read by the board: seal switch, endstops, leak sensor, bubble sensor"
        lines={[`seal ${machine.sealed ? 'CLOSED' : 'open'} · endstops · leak · bubble`]}/>

      <Link d="M 200 150 H 250 V 52 H 296" on={c.potentiostat} label="USB" lx={256} ly={64}/>
      <Link d="M 200 165 H 260 V 132 H 296" on={false} label="USB" lx={266} ly={126}/>
      <Link d="M 200 205 H 296" on={c.board} label="USB serial" lx={212} ly={198}/>
      <Link d="M 400 300 V 276" on={false}/>

      <Node x={600} y={20} w={200} h={64} on={c.potentiostat} title="Electrodes" tip="WE: the plate spot through the pogo pin; CE and RE in the cell" lines={['WE · plate spot via pogo pin', 'CE · RE · in the cell']}/>
      <Node x={600} y={100} w={200} h={64} title="Objective over the window" tip="Fixed above the cell; focused once on the manual Z stage" lines={['manual Z stage · focus once']}/>
      <Link d="M 500 52 H 596" on={c.potentiostat}/>
      <Link d="M 500 132 H 596" on={false}/>

      <g><title>Stage motors driven by the board; endstops for homing</title>
        <rect x={600} y={180} width={200} height={52} rx={5} fill={c.axes.x || c.axes.y || c.axes.z ? '#e3f2ef' : '#f5f8fa'} stroke={c.axes.x || c.axes.y || c.axes.z ? ON : INK} strokeWidth={c.axes.x || c.axes.y || c.axes.z ? 2 : 1}/>
        <text x={612} y={199} fontWeight={600} fill="#2f4b5c">XYZ stage</text>
        {(['x', 'y', 'z'] as const).map((a, i) => <g key={a}><rect x={612 + i * 30} y={208} width={24} height={16} rx={3} fill={c.axes[a] ? ON : 'white'} stroke={INK}/><text x={624 + i * 30} y={220} textAnchor="middle" fontSize={10} fill={c.axes[a] ? 'white' : INK}>{a.toUpperCase()}</text></g>)}
        <text x={712} y={220} fontSize={9}>±{(d.plate.grid - 1) / 2 * d.plate.pitch} mm · Z {zSealed(machine)} mm</text>
      </g>
      <g><title>{drive === 'board' ? 'Five pump motors on the board' : 'Five commercial pumps on an RS485 bus from the PC'}</title>
        <rect x={600} y={244} width={200} height={52} rx={5} fill={pumpsOn ? '#e3f2ef' : '#f5f8fa'} stroke={pumpsOn ? ON : INK} strokeWidth={pumpsOn ? 2 : 1}/>
        <text x={612} y={263} fontWeight={600} fill="#2f4b5c">Pumps ×5 · {drive === 'board' ? 'steppers' : 'RS485'}</text>
        {INLET_ORDER.map((f, i) => { const on = c.pumps.includes(f); return <g key={f}><title>{FLUID_INFO[f].name}</title><circle cx={622 + i * 26} cy={280} r={8} fill={on ? FLUID_INFO[f].color : 'white'} stroke={on ? FLUID_INFO[f].color : INK}/><text x={622 + i * 26} y={283} textAnchor="middle" fontSize={f === 'Air' ? 6.5 : 8} fill={on ? 'white' : INK}>{f === 'Water' ? 'W' : f === 'UPD' ? 'U' : f}</text></g>; })}
      </g>
      <g><title>24 V normally closed pinch valve switched by a MOSFET output on the board</title>
        <rect x={600} y={308} width={200} height={40} rx={5} fill={c.valve === 'WASTE' ? '#e3f2ef' : '#f5f8fa'} stroke={c.valve === 'WASTE' ? ON : INK} strokeWidth={c.valve === 'WASTE' ? 2 : 1}/>
        <text x={612} y={326} fontWeight={600} fill="#2f4b5c">Outlet valve</text>
        <text x={612} y={340} fontSize={10}>24 V · MOSFET · {c.valve === 'WASTE' ? 'OPEN' : 'CLOSED'}</text>
      </g>
      <Link d="M 500 206 H 596" on={c.axes.x || c.axes.y || c.axes.z} label="step / dir" lx={515} ly={200}/>
      {drive === 'board'
        ? <Link d="M 500 230 H 550 V 270 H 596" on={pumpsOn} label="step / dir" lx={504} ly={244}/>
        : <Link d="M 200 225 H 265 V 376 H 840 V 270 H 804" on={pumpsOn} label="USB–RS485 · Modbus" lx={560} ly={371}/>}
      <Link d="M 500 258 H 540 V 328 H 596" on={c.valve === 'WASTE' && !!c.step} label="24 V" lx={548} ly={322}/>

      <g fontSize={10}>
        <text x={860} y={36} fontWeight={600} fill="#2f4b5c">Who drives what</text>
        <text x={860} y={56}>PC → instruments</text><text x={860} y={70} fill="#8195a2">USB · vendor SDK</text>
        <text x={860} y={96}>PC → board</text><text x={860} y={110} fill="#8195a2">G-code over serial</text>
        <text x={860} y={136}>Board → motors,</text><text x={860} y={150}>valve; ← sensors</text>
        <text x={860} y={176} fill="#8195a2">green = busy now</text>
      </g>
    </svg></div>
    <div className="log-block command-block">
      <div><h3>PC commands for this step</h3><p className="footnote">Python on the PC; the board&apos;s G-code is in the comments. Placeholder names, not a real driver API.</p></div>
      <ol>{c.commands.map((l, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{l}</li>)}</ol>
    </div>
    <div className="parts-table"><table>
      <thead><tr><th>Device</th><th>Interface</th><th>Driven by</th><th>Search keywords</th><th>Check</th></tr></thead>
      <tbody>{PARTS(drive).map(([dev, i, by, k, ch]) => <tr key={dev}><td>{dev}</td><td>{i}</td><td>{by}</td><td>{k}</td><td>{ch}</td></tr>)}</tbody>
    </table></div>
    <p className="footnote">One PC runs the cycle and is the only thing that decides what happens next. The controller board (a microcontroller, MCU) only does timing-critical work: step pulses for the motors, the valve output and the switch and sensor inputs, so a Windows hiccup cannot leave a motor half-stepped. Off-the-shelf 3D-printer boards already handle stepper drivers, endstops, homing and acceleration, and take G-code over USB. Open questions: the potentiostat and spectrometer models (and whether they can be scripted), whether the pumps are stepper heads or commercial pumps, and whether the XYZ stage comes with its own controller.</p>
  </section>;
}
