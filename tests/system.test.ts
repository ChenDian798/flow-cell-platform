import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, PLATE, SPOT_COUNT, SPRING, configErrors, cycle, cycleSeconds, depositionFlows, disabledReason, initial, liftState, platePose, request, runSeconds, spotPosition, status, tick, togglePause } from '../lib/system';

const runToEnd = (m: ReturnType<typeof initial>) => tick(m, 1e9);

test('deposition feed splits the total flow by stock fractions with water as diluent', () => {
  const f = depositionFlows(DEFAULTS);
  assert.equal(f.A, 40);
  assert.equal(f.B, 20);
  assert.ok(Math.abs((f.Water ?? 0) - 140) < 1e-9);
  assert.equal(f.UPD, undefined);
  assert.equal(depositionFlows({ ...DEFAULTS, fracA: .5, fracB: .5 }).Water, undefined);
});

test('one cycle seals, deposits, rinses, analyses statically, drains, unseals and moves', () => {
  const steps = cycle(DEFAULTS, 0, false);
  assert.deepEqual(steps.map(s => s.kind), ['seal', 'deposit', 'rinse', 'fill', 'analyse', 'rinse', 'drain', 'unseal', 'move']);
  const analyse = steps.find(s => s.kind === 'analyse')!;
  assert.deepEqual(analyse.pumps, {});
  assert.equal(analyse.outlet, 'CLOSED');
  assert.equal(analyse.echem, 'CV / EIS');
  for (const s of steps) assert.equal(s.kind === 'drain', 'Air' in s.pumps, `air only drains: ${s.name}`);
  assert.equal(cycle(DEFAULTS, 15, true).at(-1)!.kind, 'unseal');
  assert.ok(Math.abs(cycleSeconds(DEFAULTS) - (5 + 900 + 162 + 66 + 300 + 162 + 60 + 5 + 20)) < 1e-6);
});

test('spots follow a serpentine order so every move is one pitch', () => {
  for (let i = 1; i < SPOT_COUNT; i++) {
    const [x1, z1] = spotPosition(i - 1), [x2, z2] = spotPosition(i);
    assert.equal(Math.hypot(x2 - x1, z2 - z1), PLATE.pitch);
  }
});

test('running one spot marks it done and leaves the plate lowered under the next spot', () => {
  const m = runToEnd(request(initial(), 'spot'));
  assert.equal(m.queue.length, 0);
  assert.equal(m.done[0], true);
  assert.equal(m.done[1], false);
  assert.equal(m.spot, 1);
  assert.equal(m.sealed, false);
  assert.equal(m.content, 'Empty');
  assert.deepEqual(platePose(m), [-spotPosition(1)[0], -PLATE.lift, -spotPosition(1)[1]]);
});

test('run all completes every configured spot and then blocks', () => {
  const m = runToEnd(request(initial({ ...DEFAULTS, spots: 3 }), 'all'));
  assert.deepEqual(m.done.slice(0, 4), [true, true, true, false]);
  assert.equal(m.spot, 2);
  assert.ok(disabledReason(m, 'all'));
  assert.ok(Math.abs(runSeconds({ ...DEFAULTS, spots: 3 }) - (3 * cycleSeconds(DEFAULTS) - 20)) < 1e-6);
});

test('pause stops pumps and holds the outlet, then resumes the same step', () => {
  let m = tick(request(initial(), 'spot'), 10);
  assert.equal(m.queue[0].kind, 'deposit');
  assert.equal(status(m).flowing, true);
  m = togglePause(m);
  const held = tick(m, 100);
  assert.equal(held.elapsed, m.elapsed);
  assert.equal(status(held).flowing, false);
  assert.equal(status(held).outlet, 'CLOSED');
  assert.equal(status(held).echem, 'OFF');
  assert.equal(status(tick(togglePause(held), 1)).flowing, true);
});

test('the Z carriage overtravels into the springs only once the plate meets the cell', () => {
  const lowered = liftState(initial());
  assert.deepEqual(lowered, { carriage: -PLATE.lift, plate: -PLATE.lift, compression: 0 });
  const sealed = liftState(tick(request(initial(), 'spot'), 10));
  assert.equal(sealed.plate, 0);
  assert.equal(sealed.compression, SPRING.overtravel);
});

test('invalid parameters block running', () => {
  const bad = { ...DEFAULTS, fracA: .8, fracB: .4 };
  assert.ok(configErrors(bad).length);
  assert.ok(disabledReason(initial(bad), 'spot'));
  assert.equal(request(initial(bad), 'spot').queue.length, 0);
});
