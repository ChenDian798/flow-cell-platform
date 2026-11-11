import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flow Cell Platform',
  description: 'Interactive conceptual model of a fixed EC-Raman flow cell, its reservoirs, pump channels and manifold, and a plate that moves one spot per cycle.'
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
