import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, defaultsFor, initial, request, tick, togglePause } from '../lib/system';
import { controlState, zSealed } from '../lib/control';

// Advance to the first step of the given kind in a one-spot run.
function at(kind: string, config = DEFAULTS) {
  let m = request(initial(config), 'spot');
  while (m.queue.length && m.queue[0].kind !== kind) m = tick(m, m.queue[0].seconds - m.elapsed);
  return tick(m, .5);
}

test('idle: nothing is busy and the PC waits for Run', () => {
  const c = controlState(initial(), 'board');
  assert.equal(c.board || c.pumpBus || c.potentiostat, false);
  assert.match(c.commands[0], /idle/);
});

test('seal lifts Z by the gap plus the spring overtravel with the outlet closed', () => {
  const m = at('seal'), c = controlState(m, 'board');
  assert.deepEqual(c.axes, { x: false, y: false, z: true });
  assert.equal(c.board, true);
  assert.equal(c.valve, 'CLOSED');
  assert.ok(c.commands.some(l => l.includes(`G1 Z${zSealed(m)}`)));
});

test('deposition runs three pump channels and the potentiostat; the pump link depends on the drive', () => {
  const m = at('deposit');
  const board = controlState(m, 'board'), bus = controlState(m, 'rs485');
  assert.deepEqual(board.pumps, ['Water', 'B', 'A']);
  assert.equal(board.potentiostat, true);
  assert.equal(board.valve, 'WASTE');
  assert.equal(board.board, true);
  assert.equal(board.pumpBus, false);
  assert.equal(bus.board, false);
  assert.equal(bus.pumpBus, true);
  assert.ok(board.commands.some(l => l.startsWith('pumps.run(Water=140, B=20, A=40)')));
});

test('static CV / EIS stops the pumps and closes the outlet', () => {
  const c = controlState(at('analyse'), 'board');
  assert.deepEqual(c.pumps, []);
  assert.equal(c.valve, 'CLOSED');
  assert.equal(c.potentiostat, true);
  assert.equal(c.board, false);
});

test('move drives X and Y to the next spot in board coordinates', () => {
  const c = controlState(at('move', defaultsFor('debug')), 'board');
  assert.deepEqual(c.axes, { x: true, y: true, z: false });
  assert.ok(c.commands[0].includes('G1 X0 Y40'), c.commands[0]);
});

test('pause stops everything', () => {
  const c = controlState(togglePause(at('deposit')), 'board');
  assert.equal(c.board || c.pumpBus || c.potentiostat, false);
  assert.match(c.commands[0], /paused/);
});
