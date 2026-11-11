'use client';
import { isValidElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';

export type Vec3 = [number, number, number];

export function Box({ position, size, color = '#dde4e9', opacity = 1 }: { position: Vec3; size: Vec3; color?: string; opacity?: number }) {
  return <mesh position={position}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.65} metalness={.15} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1}/></mesh>;
}
export function Cylinder({ position, radius, height, color, opacity = 1, metal = .15, rotation = [0, 0, 0] }: { position: Vec3; radius: number; height: number; color: string; opacity?: number; metal?: number; rotation?: Vec3 }) {
  return <mesh position={position} rotation={rotation}><cylinderGeometry args={[radius, radius, Math.max(.001, height), 40]}/><meshStandardMaterial color={color} roughness={.55} metalness={metal} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} side={THREE.DoubleSide}/></mesh>;
}
// Tube along a smooth path through the given points.
export function Pipe({ points, color = '#8096a4', radius = .6, opacity = 1 }: { points: Vec3[]; color?: string; radius?: number; opacity?: number }) {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => {
    const vectors = (JSON.parse(key) as Vec3[]).map(p => new THREE.Vector3(...p));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', .1), Math.max(16, vectors.length * 12), radius, 10, false);
  }, [key, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color={color} roughness={.6} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1}/></mesh>;
}
// Rectangular plate (width along x, depth along z; square by default) of thickness t with a centred round hole, top face at y + t.
export function HolePlate({ y, width, depth = width, t, hole, color, opacity = 1 }: { y: number; width: number; depth?: number; t: number; hole: number; color: string; opacity?: number }) {
  const geometry = useMemo(() => {
    const s = new THREE.Shape(), h = width / 2, d = depth / 2;
    s.moveTo(-h, -d); s.lineTo(h, -d); s.lineTo(h, d); s.lineTo(-h, d); s.lineTo(-h, -d);
    const p = new THREE.Path(); p.absarc(0, 0, hole / 2, 0, Math.PI * 2, true); s.holes.push(p);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 40 });
  }, [width, depth, t, hole]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // The shape lies in (x, z); rotating +90° about x extrudes it downward from y + t.
  return <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, y + t, 0]}><meshStandardMaterial color={color} roughness={.6} metalness={.15} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide}/></mesh>;
}
export function Label({ position, children, accent = false, scale = 1 }: { position: Vec3; children: React.ReactNode; accent?: boolean; scale?: number }) {
  function text(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(text).join('');
    if (isValidElement<{ children?: React.ReactNode }>(node)) return node.type === 'br' ? '\n' : text(node.props.children);
    return '';
  }
  const content = text(children);
  const { texture, width, height } = useMemo(() => {
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
    const lines = content.split('\n'); context.font = '28px Arial';
    const width = Math.ceil(Math.max(...lines.map(line => context.measureText(line).width))) + 32;
    const height = lines.length * 38 + 20; canvas.width = width; canvas.height = height;
    context.fillStyle = accent ? '#edf6f6' : '#ffffff'; context.fillRect(0, 0, width, height);
    context.strokeStyle = accent ? '#b7d3d4' : '#d5e0e6'; context.lineWidth = 2; context.strokeRect(1, 1, width - 2, height - 2);
    context.font = '28px Arial'; context.fillStyle = accent ? '#365f68' : '#526977'; context.textAlign = 'center'; context.textBaseline = 'middle';
    lines.forEach((line, i) => context.fillText(line, width / 2, 29 + i * 38));
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, width, height };
  }, [content, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[width * .055 * scale, height * .055 * scale, 1]} renderOrder={20}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false}/></sprite>;
}
