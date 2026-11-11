'use client';
import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Machine, liftState, platePose, status } from '@/lib/system';
import { Box, Cylinder, HolePlate, Label, Pipe, Vec3 } from './ModelPrimitives';
import { FlowCell, SpotPlate } from './Scene';

// Mounting concept built from off-the-shelf parts: aluminium-extrusion frame, cell adapter plate,
// manual Z focus stage for the spectrometer, motorized XYZ stage and a spring tray under the plate.
// Units are mm; the plate top is at y = 0 when sealed. Sizes are indicative, not a vendor's drawing.
export type MountView = 'iso' | 'front' | 'side' | 'cell';
const EXTRUSION = '#c3cad0', PRINTED = '#e9b44c', STAGE = '#38434d', STAGE_MOVE = '#4f5c68', STEEL = '#aeb7be';
const BEAM = { y: 14, h: 40, z: 65, span: 340 };   // 2040 beams along x, bottom face at y = 14
const POST_X = 160, BASE_TOP = -95;
const ADAPTER = { y: 8, t: 6, width: 90, depth: 150, hole: 34 };
const TOP_PLATE = { y: BEAM.y + BEAM.h, t: 6 };
const TRAY = 140, SPRING_AT = 62;

function CameraRig({ view }: { view: MountView }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const [pos, target]: [Vec3, Vec3] = view === 'front' ? [[0, -4, 560], [0, -4, 0]]
      : view === 'side' ? [[560, 0, 0], [0, -15, 0]]
      : view === 'cell' ? [[170, -6, 190], [0, -10, 0]]
      : [[430, 250, 420], [0, -20, 0]];
    camera.position.set(...pos); camera.lookAt(...target);
    if (controls && 'target' in controls) { const orbit = controls as unknown as { target: THREE.Vector3; update: () => void }; orbit.target.set(...target); orbit.update(); }
  }, [camera, controls, view]);
  return null;
}
// Coil spring between two heights, drawn as a helix around a shoulder screw.
function Spring({ x, z, bottom, top }: { x: number; z: number; bottom: number; top: number }) {
  const geometry = useMemo(() => {
    const turns = 6, r = 3.2, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(a), i / (turns * 24), r * Math.sin(a))); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, .45, 6, false);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[x, bottom, z]} scale={[1, Math.max(.1, top - bottom), 1]}><meshStandardMaterial color="#8d99a3" metalness={.6} roughness={.35}/></mesh>;
}
// Two 2040 beams across four posts on a breadboard; the cell hangs from an adapter plate under the beams.
function Frame({ labels }: { labels: boolean }) {
  const postH = BEAM.y + BEAM.h - BASE_TOP;
  return <group>
    <Box position={[0, BASE_TOP - 6, 0]} size={[440, 12, 340]} color="#5d666e"/>
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => <Box key={`${sx}${sz}`} position={[sx * POST_X, BASE_TOP + postH / 2, sz * BEAM.z]} size={[20, postH, 40]} color={EXTRUSION}/>))}
    {[-1, 1].map(sz => <Box key={sz} position={[0, BEAM.y + BEAM.h / 2, sz * BEAM.z]} size={[BEAM.span, BEAM.h, 20]} color={EXTRUSION}/>)}
    <HolePlate y={ADAPTER.y} width={ADAPTER.width} depth={ADAPTER.depth} t={ADAPTER.t} hole={ADAPTER.hole} color={PRINTED}/>
    {[-1, 1].flatMap(sx => [-1, 1].map(sz => <Cylinder key={`${sx}${sz}`} position={[sx * 17, (5.25 + ADAPTER.y) / 2, sz * 17]} radius={2.5} height={ADAPTER.y - 5.25} color={STEEL} metal={.6}/>))}
    {labels && <>
      <Label position={[-205, 70, 0]} scale={5}>2040 aluminium extrusion<br/>posts + beams</Label>
      <Label position={[0, -112, 185]} scale={5}>Optical breadboard / extrusion base</Label>
      <Label position={[-95, 18, 95]} scale={4.5} accent>Cell adapter plate (printed)<br/>M3 spacers · slotted holes</Label>
    </>}
  </group>;
}
// Spectrometer on a manual Z stage for focusing; the objective passes through the top plate to the cell window.
function RamanMount({ labels }: { labels: boolean }) {
  const top = TOP_PLATE.y + TOP_PLATE.t;
  return <group>
    <HolePlate y={TOP_PLATE.y} width={90} depth={150} t={TOP_PLATE.t} hole={26} color="#b7bfc6"/>
    <Box position={[0, top + 10, -50]} size={[60, 20, 40]} color="#7b8791"/>
    <Cylinder position={[38, top + 10, -50]} radius={4} height={16} rotation={[0, 0, Math.PI / 2]} color={STEEL} metal={.6}/>
    <Box position={[0, top + 20 + 20.5, -25]} size={[70, 41, 100]} color="#2b3036"/>
    <Cylinder position={[0, 12, 0]} radius={4.5} height={4} color="#2f353b" metal={.5}/>
    <Cylinder position={[0, (14 + top + 20) / 2, 0]} radius={11} height={top + 20 - 14} color="#3a4148" metal={.5}/>
    {labels && <>
      <Label position={[0, top + 72, -25]} scale={5}>Raman spectrometer</Label>
      <Label position={[100, top + 14, -60]} scale={4.5}>Manual Z stage · focus</Label>
    </>}
  </group>;
}
// Motorized XYZ stack: X and Y carry everything; Z lifts the spring tray, which presses the plate onto the cell.
function StageStack({ machine, labels }: { machine: Machine; labels: boolean }) {
  const [px, , pz] = platePose(machine), { carriage: c, plate: yp, compression } = liftState(machine);
  const echem = status(machine).echem !== 'OFF';
  return <group>
    <Box position={[0, -87.5, 0]} size={[280, 15, 110]} color={STAGE}/>
    <group position={[px, 0, 0]}>
      <Box position={[0, -75, 0]} size={[120, 10, 110]} color={STAGE_MOVE}/>
      <Box position={[0, -65, 0]} size={[110, 10, 260]} color={STAGE}/>
      <group position={[0, 0, pz]}>
        <Box position={[0, -55, 0]} size={[110, 10, 120]} color={STAGE_MOVE}/>
        <Box position={[0, -43, 0]} size={[100, 14, 100]} color={STAGE}/>
        <Box position={[0, c - 28, 0]} size={[90, 10, 90]} color={STAGE_MOVE}/>
        <Box position={[0, c - 20.5, 0]} size={[TRAY, 5, TRAY]} color={PRINTED}/>
        <Box position={[0, yp - 5.5, 0]} size={[TRAY, 5, TRAY]} color={PRINTED}/>
        {/* Guide shaft fixed in the top tray, LM6UU bearing in a boss under the base tray, collar as the upward stop */}
        {[-1, 1].flatMap(sx => [-1, 1].map(sz => <group key={`${sx}${sz}`}>
          <Spring x={sx * SPRING_AT} z={sz * SPRING_AT} bottom={c - 18} top={yp - 8}/>
          <Cylinder position={[sx * SPRING_AT, yp - 24, sz * SPRING_AT]} radius={3} height={42} color={STEEL} metal={.6}/>
          <Cylinder position={[sx * SPRING_AT, c - 30, sz * SPRING_AT]} radius={9} height={14} color={PRINTED}/>
          <Cylinder position={[sx * SPRING_AT, yp - 40, sz * SPRING_AT]} radius={6} height={6} color="#6f7c87" metal={.5}/>
        </group>))}
        <Cylinder position={[-48, yp - 5.5, 48]} radius={1.2} height={5} color="#cfa53a" metal={.7}/>
        <Pipe points={[[-48, yp - 8, 48], [-60, yp - 14, 70], [-90, yp - 30, 110]]} radius={.6} color={echem ? '#cfa53a' : '#9aa5ad'}/>
        <group position={[0, yp, 0]}><SpotPlate machine={machine}/></group>
      </group>
    </group>
    {labels && <>
      <Label position={[0, -100, -175]} scale={5}>Motorized XYZ stage · X / Y change spot · Z lifts</Label>
      <Label position={[px + 150, c - 18, pz]} scale={4.5} accent={compression > 0}>Spring tray · guide shafts + LM6UU bearings<br/>compression {compression.toFixed(1)} mm</Label>
      <Label position={[px - 110, yp - 22, pz + 110]} scale={4.5}>Pogo pin → WE contact</Label>
    </>}
  </group>;
}
// Short tube and wire stubs leaving the fixed cell; the full fluidics are in panel 01.
function Stubs() {
  return <group>
    {[-1, 1].map(s => <Pipe key={s} points={[[s * 20, 3.4, 0], [s * 50, 3.4, 0], [s * 70, 30, 0], [s * 150, 40, 0]]} radius={.9} color="#9fb3c0"/>)}
    {[-1, 1].map(s => <Pipe key={`w${s}`} points={[[0, 2.15, s * 32], [0, 2.15, s * 82], [0, 20, s * 92], [-60, 40, s * 110]]} radius={.45} color="#9aa5ad"/>)}
  </group>;
}

export default function MountScene({ machine, view, labels }: { machine: Machine; view: MountView; labels: boolean }) {
  return <Canvas camera={{ position: [430, 250, 420], fov: 38, near: 1, far: 3000 }} gl={{ antialias: true }} aria-label="3D model of the cell mounting frame and spring-loaded lift">
    <color attach="background" args={['#f5f8fa']}/>
    <ambientLight intensity={1.6}/><directionalLight position={[120, 300, 200]} intensity={2.4}/><directionalLight position={[-200, 100, -150]} intensity={.8}/>
    <Frame labels={labels}/>
    <RamanMount labels={labels}/>
    <FlowCell machine={machine} labels={false}/>
    <Stubs/>
    <StageStack machine={machine} labels={labels}/>
    <OrbitControls makeDefault minDistance={40} maxDistance={1400}/>
    <CameraRig view={view}/>
  </Canvas>;
}
