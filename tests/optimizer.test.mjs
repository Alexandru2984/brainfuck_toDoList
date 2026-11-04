import test from "node:test";
import assert from "node:assert/strict";
import {
  optimizeBrainfuck,
  parseComparisonInputs,
} from "../static/optimizer.mjs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
function finish(code, input) {
  const vm = new BrainfuckVM(code, input, { history: 0, steps: 500000 });
  vm.run();
  return {
    ptr: vm.ptr,
    input: Math.min(vm.inputPtr, vm.input.length),
    output: vm.output,
    tape: [...vm.tape],
  };
}
test("conservative transformations preserve observable final state", () => {
  const programs = [
    "[-]+++..",
    "++--+++.",
    ">><<+>+-<.",
    "++++[-][-].",
    ",".repeat(2) + "+-.[-][-]",
    "+".repeat(256) + ".",
    ">".repeat(18000) + "+.",
    "[+[[]]]+.",
    "++[>++--+++<-]>..",
  ];
  for (const program of programs) {
    const result = optimizeBrainfuck(program);
    assert.ok(result.after <= result.before);
    for (const input of ["", "A", "🧠"])
      assert.deepEqual(finish(result.optimized, input), finish(program, input));
  }
});
test("normalization never discards arbitrary noninitial loops", () => {
  assert.equal(optimizeBrainfuck("+[]").optimized, "+[]");
  assert.throws(() => optimizeBrainfuck("["));
});
test("comparison input lists reject malformed and oversized jobs", () => {
  assert.deepEqual(parseComparisonInputs('["", "A"]'), ["", "A"]);
  for (const value of [
    "{}",
    "[]",
    "bad",
    "[1]",
    JSON.stringify(Array(9).fill("")),
    JSON.stringify(["🧠".repeat(129)]),
  ])
    assert.throws(() => parseComparisonInputs(value));
});
