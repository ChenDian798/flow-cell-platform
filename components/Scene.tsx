'use client';
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CELL, FLUID_INFO, Fluid, INLET_ORDER, Machine, PLATE, SPOT_COUNT, cellFill, contentColor, feedContent, platePose, spotPosition, status } from '@/lib/system';
import { Box, Cylinder, HolePlate, Label, Pipe, Vec3 } from './ModelPrimitives';

export type CameraView = 'iso' | 'top' | 'side' | 'cell';
const LINE_Y = 3.4; // tube height at the cell's inlet and outlet bores
const IDLE = '#a9b6bf';
// Manifold inlet positions along x, head (air) farthest from the cell.
const INLET_X: Record<Fluid, number> = Object.fromEntries(INLET_ORDER.map((f, i) => [f, 146 - i * 12])) as Record<Fluid, number>;
const MANIFOLD = { from: 90, to: 152 };
const PUMP_Z = -45, RESERVOIR_Z = -82;
const POTENTIOSTAT: Vec3 = [-75, 0, 80];

function CameraRig({ view }: { view: CameraView }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const [pos, target]: [Vec3, Vec3] = view === 'top' ? [[25, 330, 1], [25, 0, -5]]
      : view === 'side' ? [[25, 25, 270], [25, 5, 0]]
      : view === 'cell' ? [[62, 16, 58], [0, 3, 0]]
      : [[200, 165, 215], [25, -5, -5]];
    camera.position.set(...pos); camera.lookAt(...target);
    if (controls && 'target' in controls) { const orbit = controls as unknown as { target: THREE.Vector3; update: () => void }; orbit.target.set(...target); orbit.update(); }
  }, [camera, controls, view]);
  return null;
}

// Fixed flow cell (cell_v1): contact boss, body with port towers, quartz window, retainer, CE / RE wires.
export function FlowCell({ machine, labels }: { machine: Machine; labels: boolean }) {
  const fill = cellFill(machine), st = status(machine);
  const h = CELL.liquidHeight * fill.level, echem = st.echem !== 'OFF';
  return <group>
    <Cylinder position={[0, .6, 0]} radius={10} height={1.2} color="#8a929b" opacity={.45}/>
    <Box position={[0, 3.225, 0]} size={[40, 4.05, 40]} color="#8a929b" opacity={.35}/>
    {[-1, 1].map(s => <Box key={s} position={[s * 17.25, 3.85, 0]} size={[5.5, 5.3, 10]} color="#8a929b" opacity={.45}/>)}
    <Cylinder position={[0, 4.9, 0]} radius={10} height={1} color="#cfefff" opacity={.45}/>
    <HolePlate y={5.4} width={28} t={2} hole={14} color="#4d525c" opacity={.85}/>
    {h > .02 && <Cylinder position={[0, h / 2, 0]} radius={CELL.chamberD / 2 - .05} height={h} color={contentColor(fill.content)} opacity={.85}/>}
    <Pipe points={[[0, 2.15, 6], [0, 2.15, 20], [0, 2.15, 32]]} radius={.35} color={echem ? '#cfa53a' : '#b8bec4'}/>
    <Pipe points={[[0, 2.15, -6], [0, 2.15, -20], [0, 2.15, -32]]} radius={.45} color={echem ? '#cfa53a' : '#8c7a63'}/>
    {labels && <>
      <Label position={[0, 2, 44]} scale={1.2}>Counter electrode (CE)</Label>
      <Label position={[0, 2, -44]} scale={1.2}>Reference electrode (RE)</Label>
      <Label position={[-34, 16, 18]} scale={1.3} accent>Flow cell v1 · fixed<br/>Ø{CELL.chamberD} mm · ≈{CELL.volume} μL</Label>
    </>}
  </group>;
}
// Raman objective and spectrometer above the window, fixed relative to the cell.
function Raman({ labels }: { labels: boolean }) {
  return <group>
    <Cylinder position={[0, 12, 0]} radius={4.5} height={4} color="#2f353b" metal={.5}/>
    <Cylinder position={[0, 29, 0]} radius={11} height={30} color="#3a4148" metal={.5}/>
    <Box position={[0, 54, 0]} size={[46, 16, 30]} color="#2b3036"/>
    {labels && <Label position={[0, 72, 0]} scale={1.3}>Raman spectrometer + objective<br/>removed from enclosure · fixed</Label>}
  </group>;
}
// Working-electrode plate (top face at y = 0) with its 4 × 4 spots: purple when deposited, ring on the active spot.
export function SpotPlate({ machine }: { machine: Machine }) {
  const active = machine.queue.length > 0 ? machine.queue[0].spot : machine.spot;
  return <group>
    <Box position={[0, -1.5, 0]} size={[PLATE.size, 3, PLATE.size]} color="#59626b"/>
    {Array.from({ length: SPOT_COUNT }, (_, i) => {
      const [sx, sz] = spotPosition(i), done = machine.done[i];
      return <group key={i}>
        <Cylinder position={[sx, .06, sz]} radius={6} height={.12} color={done ? '#7a5aa6' : '#8d969e'}/>
        {i === active && <mesh position={[sx, .14, sz]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[7.3, 8.3, 48]}/><meshBasicMaterial color="#00b3ad"/></mesh>}
      </group>;
    })}
  </group>;
}
// Working-electrode plate on the motorized XYZ stage; the stage moves, the cell does not.
function PlateStage({ machine, labels }: { machine: Machine; labels: boolean }) {
  const [x, y, z] = platePose(machine);
  return <group>
    <group position={[x, y, z]}>
      <SpotPlate machine={machine}/>
      <Box position={[0, -7, 0]} size={[130, 8, 130]} color="#c4ccd2"/>
    </group>
    <Box position={[0, -22, 0]} size={[210, 10, 210]} color="#dde4e9"/>
    {labels && <>
      <Label position={[x - 40, y - 14, z + 72]} scale={1.3}>WE plate · 4 × 4 spots · {PLATE.pitch} mm pitch</Label>
      <Label position={[95, -24, 95]} scale={1.3}>Motorized XYZ stage · moves the plate</Label>
    </>}
  </group>;
}
function CheckValve({ position, open }: { position: Vec3; open: boolean }) {
  // Axis along +z (towards the manifold); the cone shows the permitted flow direction.
  return <group position={position} rotation={[Math.PI / 2, 0, 0]}>
    <mesh><cylinderGeometry args={[1.6, 1.6, 4.6, 24]}/><meshStandardMaterial color={open ? '#007b79' : '#9fb0bb'} metalness={.3} roughness={.5}/></mesh>
    <mesh position={[0, 3.2, 0]}><coneGeometry args={[1.3, 1.8, 20]}/><meshStandardMaterial color="#36505f"/></mesh>
  </group>;
}
function Bottle({ position, color, label }: { position: Vec3; color: string; label?: string }) {
  return <group position={position}>
    <Cylinder position={[0, 0, 0]} radius={6} height={26} color="#cadde7" opacity={.25}/>
    <Cylinder position={[0, -4, 0]} radius={5.6} height={17} color={color} opacity={.7}/>
    <Cylinder position={[0, 14, 0]} radius={3} height={2} color={color}/>
    {label && <Label position={[0, 24, 0]} scale={1.2}>{label}</Label>}
  </group>;
}
// Reservoirs → one peristaltic channel each → inlet check valve → manifold → static mixer → cell inlet.
function Delivery({ machine, labels }: { machine: Machine; labels: boolean }) {
  const st = status(machine), lineColor = contentColor(feedContent(st.pumps) ?? machine.line);
  const mixer: Vec3[] = Array.from({ length: 9 }, (_, i) => [48 + i * 4, LINE_Y, i % 2 ? 4 : -4]);
  return <group>
    {INLET_ORDER.map(f => {
      const x = INLET_X[f], flow = st.pumps[f] ?? 0, on = flow > 0, color = FLUID_INFO[f].color;
      return <group key={f}>
        {f === 'Air'
          ? <><Cylinder position={[x, 4, RESERVOIR_Z]} radius={3} height={8} color="#e9eef1"/><Cylinder position={[x, 8.8, RESERVOIR_Z]} radius={3.6} height={1.6} color="#7f909c"/></>
          : <Bottle position={[x, 0, RESERVOIR_Z]} color={color}/>}
        <Pipe points={[[x, f === 'Air' ? 9.6 : 15, RESERVOIR_Z], [x, 18, RESERVOIR_Z + 14], [x, LINE_Y, PUMP_Z - 6]]} color={color} radius={on ? .9 : .5} opacity={on ? 1 : .45}/>
        <Cylinder position={[x, LINE_Y, PUMP_Z]} radius={3.6} height={9} rotation={[Math.PI / 2, 0, 0]} color={on ? '#007b79' : '#a7b7c2'} metal={.25}/>
        <Pipe points={[[x, LINE_Y, PUMP_Z + 4.5], [x, LINE_Y, -20], [x, LINE_Y, -8]]} color={color} radius={on ? .9 : .5} opacity={on ? 1 : .45}/>
        <CheckValve position={[x, LINE_Y, -5]} open={on}/>
        {labels && <Label position={[x, f === 'Air' ? 20 : 26, RESERVOIR_Z - 4]} scale={1.15} accent={on}>{FLUID_INFO[f].name}{on ? `\n${flow.toFixed(0)} μL/min` : ''}</Label>}
      </group>;
    })}
    <Box position={[(MANIFOLD.from + MANIFOLD.to) / 2, LINE_Y, 0]} size={[MANIFOLD.to - MANIFOLD.from, 4, 4]} color={st.flowing ? '#cfe5df' : '#e6dccb'}/>
    <Box position={[(MANIFOLD.from + MANIFOLD.to) / 2, LINE_Y - 3.5, PUMP_Z]} size={[MANIFOLD.to - MANIFOLD.from + 6, 3, 12]} color="#e0e8ed"/>
    <Pipe points={[[MANIFOLD.from, LINE_Y, 0], [86, LINE_Y, 0], [82, LINE_Y, -4]]} color={lineColor} radius={.8}/>
    <Pipe points={[[82, LINE_Y, -4], ...[...mixer].reverse(), [44, LINE_Y, 0]]} color={lineColor} radius={.8}/>
    <Box position={[64, LINE_Y, 0]} size={[40, 6, 14]} color="#e8eef2" opacity={.35}/>
    <Pipe points={[[44, LINE_Y, 0], [32, LINE_Y, 0], [20, LINE_Y, 0]]} color={lineColor} radius={.8}/>
    {labels && <>
      <Label position={[121, 14, PUMP_Z - 2]} scale={1.3} accent={st.flowing}>5-channel peristaltic pump · {st.flowing ? 'ON' : 'OFF'}</Label>
      <Label position={[121, 12, 9]} scale={1.3}>Manifold · inlet check valves<br/>head: air → water → UPD → B → A</Label>
      <Label position={[64, 14, 12]} scale={1.3}>Static mixer</Label>
    </>}
  </group>;
}
// Cell outlet → outlet valve → waste. The valve closes for static steps.
function Outlet({ machine, labels }: { machine: Machine; labels: boolean }) {
  const st = status(machine), open = st.outlet === 'WASTE';
  const color = open && st.flowing ? contentColor(cellFill(machine).content) : IDLE;
  return <group>
    <Pipe points={[[-20, LINE_Y, 0], [-35, LINE_Y, 0], [-50, LINE_Y, 0]]} color={color} radius={.8} opacity={open ? 1 : .6}/>
    <Box position={[-55, LINE_Y, 0]} size={[9, 9, 9]} color={open ? '#007b79' : '#7e929f'}/>
    <Pipe points={[[-59.5, LINE_Y, 0], [-75, 12, 0], [-92, 18, 0]]} color={open ? color : IDLE} radius={.8} opacity={open ? 1 : .6}/>
    <Bottle position={[-98, 0, 0]} color="#a2937d"/>
    {labels && <>
      <Label position={[-55, 17, 0]} scale={1.2} accent={open}>Outlet valve · {st.outlet}</Label>
      <Label position={[-98, -20, 14]} scale={1.2}>Waste</Label>
    </>}
  </group>;
}
function Potentiostat({ machine, labels }: { machine: Machine; labels: boolean }) {
  const st = status(machine), on = st.echem !== 'OFF', [x, y, z] = platePose(machine);
  const wire = on ? '#cfa53a' : '#9aa5ad';
  const [px, py, pz] = POTENTIOSTAT;
  return <group>
    <Box position={POTENTIOSTAT} size={[50, 18, 30]} color={on ? '#d8eeea' : '#eef2f4'}/>
    <Box position={[px, py + 9.2, pz]} size={[40, .4, 20]} color={on ? '#007b79' : '#9aa7b1'}/>
    <Pipe points={[[0, 2.15, 32], [-10, 6, 52], [-50, 6, 68], [px + 10, py + 2, pz - 15]]} color={wire} radius={.35}/>
    <Pipe points={[[0, 2.15, -32], [-40, 6, -52], [-130, 6, -10], [-120, 6, 70], [px - 20, py + 2, pz - 10]]} color={wire} radius={.35}/>
    <Pipe points={[[x - PLATE.size / 2, y - 1.5, z + PLATE.size / 2 - 5], [x - PLATE.size / 2 - 8, y - 2, z + PLATE.size / 2 + 5], [px - 5, py - 6, pz - 15]]} color={wire} radius={.35}/>
    {labels && <Label position={[px, py + 20, pz]} scale={1.3} accent={on}>Potentiostat · {st.echem}<br/>WE plate · CE · RE</Label>}
  </group>;
}

export default function Scene({ machine, view, labels }: { machine: Machine; view: CameraView; labels: boolean }) {
  return <Canvas camera={{ position: [200, 165, 215], fov: 40, near: .5, far: 2000 }} gl={{ antialias: true }} aria-label="3D model of the flow-cell platform">
    <color attach="background" args={['#f5f8fa']}/>
    <ambientLight intensity={1.7}/><directionalLight position={[60, 160, 90]} intensity={2.4}/><directionalLight position={[-80, 60, -60]} intensity={.8}/>
    <FlowCell machine={machine} labels={labels}/>
    <Raman labels={labels}/>
    <PlateStage machine={machine} labels={labels}/>
    <Delivery machine={machine} labels={labels}/>
    <Outlet machine={machine} labels={labels}/>
    <Potentiostat machine={machine} labels={labels}/>
    <OrbitControls makeDefault minDistance={20} maxDistance={700}/>
    <CameraRig view={view}/>
  </Canvas>;
}
