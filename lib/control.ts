// Computer-control view of the same machine: which device the PC is talking to at each step, and what it sends.
// The PC runs the cycle; a controller board (MCU) drives the stage motors, pump motors and outlet valve and reads
// the switches and sensors; the potentiostat and spectrometer are driven directly from the PC through vendor SDKs.
import { Fluid, INLET_ORDER, Machine, Outlet, SPRING, Step, designOf, spotPosition, status } from './system';

export type PumpDrive = 'board' | 'rs485';
export type ControlState = {
  step: Step | null;
  paused: boolean;
  board: boolean;      // PC → controller board link busy (motors moving)
  pumpBus: boolean;    // PC → RS485 pumps link busy
  potentiostat: boolean;
  axes: { x: boolean; y: boolean; z: boolean };
  pumps: Fluid[];      // running channels, manifold order
  valve: Outlet;
  commands: string[];
};

const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1);
// Stage Z in board coordinates: 0 with the plate lowered, lift + spring overtravel when sealed.
export const zSealed = (m: Machine) => designOf(m.config).plate.lift + SPRING.overtravel;

export function pumpCommand(pumps: Partial<Record<Fluid, number>>, drive: PumpDrive): string {
  const args = INLET_ORDER.filter(f => pumps[f]).map(f => `${f}=${fmt(pumps[f]!)}`).join(', ');
  return `pumps.run(${args})  # μL/min · ${drive === 'board' ? 'stepper speeds on the board' : 'RS485 / Modbus to each pump'}`;
}

// What the orchestrator sends at the start of a step, written as Python with the board's G-code in comments.
export function stepCommands(m: Machine, s: Step, drive: PumpDrive): string[] {
  const z = fmt(zSealed(m));
  const valve = s.outlet === 'WASTE' ? 'valve.open()   # SET_PIN PIN=outlet_valve VALUE=1' : 'valve.close()  # SET_PIN PIN=outlet_valve VALUE=0';
  const pumps = Object.keys(s.pumps).length ? pumpCommand(s.pumps, drive) : 'pumps.stop()';
  switch (s.kind) {
    case 'seal': return [valve, `stage.move_z(${z})  # G1 Z${z} F120 · springs take the last ${fmt(SPRING.overtravel)} mm`, 'board.wait(seal_switch)  # confirm the plate touches the cell'];
    case 'deposit': return [valve, pumps, `pstat.start("deposition", t=${fmt(s.seconds)} s)  # vendor SDK`];
    case 'analyse': return [pumps, valve, 'pstat.run("CV"); pstat.run("EIS")  # static, vendor SDK', `pstat.save(spot=${s.spot + 1})`];
    case 'unseal': return [pumps, valve, 'stage.move_z(0)  # G1 Z0 F120'];
    case 'move': {
      const [x, y] = spotPosition(s.toSpot ?? s.spot, designOf(m.config));
      return [`stage.move_xy(${fmt(-x)}, ${fmt(-y)})  # G1 X${fmt(-x)} Y${fmt(-y)} F1500 · spot ${(s.toSpot ?? s.spot) + 1} under the cell`];
    }
    default: return [valve, pumps];
  }
}

export function controlState(m: Machine, drive: PumpDrive): ControlState {
  const st = status(m), s = st.step;
  const pumps = INLET_ORDER.filter(f => st.pumps[f]);
  const axes = { x: false, y: false, z: false };
  if (s && !m.paused) {
    if (s.kind === 'move') axes.x = axes.y = true;
    if (s.kind === 'seal' || s.kind === 'unseal') axes.z = true;
  }
  const moving = axes.x || axes.y || axes.z;
  const commands = !s ? ['# idle · press Run in panel 01']
    : m.paused ? ['pumps.stop(); valve.close()  # paused: outlet held, potentiostat off', '# stage holds its position']
    : stepCommands(m, s, drive);
  return {
    step: s, paused: m.paused,
    board: moving || (pumps.length > 0 && drive === 'board'),
    pumpBus: pumps.length > 0 && drive === 'rs485',
    potentiostat: st.echem !== 'OFF',
    axes, pumps, valve: st.outlet, commands
  };
}
