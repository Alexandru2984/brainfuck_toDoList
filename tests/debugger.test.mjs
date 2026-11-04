import test from "node:test";
import assert from "node:assert/strict";
import { BrainfuckVM } from "../static/bf-vm.mjs";
function state(vm) {
  return {
    tape: [...vm.tape],
    pc: vm.pc,
    ptr: vm.ptr,
    steps: vm.steps,
    inputPtr: vm.inputPtr,
    output: [...vm.output],
    visits: [...vm.instructionVisits],
    cells: [...vm.cellVisits],
    distinct: vm.distinctCells,
  };
}
test("undo restores every instruction including loops, EOF, output and pointer wrap", () => {
  const vm = new BrainfuckVM(",.[>+<-]>.>,.<-.", "\u0002", { cells: 16 });
  const states = [state(vm)];
  while (vm.step()) states.push(state(vm));
  for (let i = states.length - 2; i >= 0; i--) {
    assert.equal(vm.back(), true);
    assert.deepEqual(state(vm), states[i]);
  }
  assert.equal(vm.back(), false);
  assert.equal(vm.done, false);
});
test("bounded circular history survives wrap and deterministic seek", () => {
  const vm = new BrainfuckVM("++++++++++.", "", { history: 4 });
  vm.run();
  const done = state(vm);
  assert.equal(vm.historyCount, 4);
  assert.equal(vm.snapshot().historyFloor, 7);
  vm.seek(7);
  assert.equal(vm.steps, 7);
  assert.equal(vm.back(), false);
  vm.seek(11);
  assert.deepEqual(state(vm), done);
  assert.throws(() => vm.seek(6));
  assert.throws(() => vm.seek(12));
});
test("profile totals and nested loop costs are consistent and reversible", () => {
  const vm = new BrainfuckVM("++[>++[>+<-]<-]>>.");
  vm.run();
  let profile = vm.profileSnapshot();
  assert.equal(
    Object.values(profile.operations).reduce((a, b) => a + b, 0),
    vm.steps,
  );
  assert.equal(
    vm.instructionVisits.reduce((a, b) => a + b, 0),
    vm.steps,
  );
  assert.equal(profile.distinctCells, 3);
  assert.ok(profile.loops.length === 2);
  const steps = vm.steps;
  vm.back();
  profile = vm.profileSnapshot();
  assert.equal(
    Object.values(profile.operations).reduce((a, b) => a + b, 0),
    steps - 1,
  );
});
test("disabled history preserves execution and output-limit failure does not add phantom undo", () => {
  const vm = new BrainfuckVM("+..", "", { history: 2, output: 1 });
  vm.step();
  vm.step();
  assert.throws(() => vm.step());
  assert.equal(vm.steps, 2);
  assert.equal(vm.historyCount, 2);
  vm.back();
  assert.deepEqual(vm.output, []);
  vm.back();
  assert.equal(vm.tape[0], 0);
  const fast = new BrainfuckVM("+++.", "", { history: 0 });
  fast.run();
  assert.equal(fast.back(), false);
  assert.deepEqual(fast.output, [3]);
});
