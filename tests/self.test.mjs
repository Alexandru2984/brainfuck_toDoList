import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
import { selfDemos } from "../static/self-data.mjs";
const source = readFileSync(
  new URL("../static/programs/self-interpreter.bf", import.meta.url),
  "utf8",
);
const fixtures = [
  ...selfDemos,
  ...[
    ["+++.", ""],
    ["", ""],
    [",[.,]", "Hi"],
    [",.,.", "A"],
    ["[[]]+.", ""],
    ["><+.", ""],
    ["<+.", ""],
    ["+[-].", ""],
  ].map(([code, input]) => ({ code, input })),
];
for (const fixture of fixtures)
  test("real BF self-interpreter: " + JSON.stringify(fixture.code), () => {
    const inner = new BrainfuckVM(fixture.code, fixture.input, {
      cells: 16,
      history: 0,
      steps: 50000,
    });
    const outer = new BrainfuckVM(
      source,
      inner.code.join("") + "!" + fixture.input,
      { history: 0 },
    );
    outer.run();
    inner.run();
    assert.deepEqual(outer.output, inner.output);
    assert.equal(outer.tape[2], inner.ptr);
    assert.deepEqual(
      Array.from({ length: 16 }, (_, i) => outer.tape[164 + i * 4 + 1]),
      [...inner.tape],
    );
    assert.ok(outer.steps < 2000000);
  });
test("self-interpreter is actual bounded eight-instruction BF source", () => {
  assert.match(source, /^[><+\-.,\[\]\n]+$/);
  assert.ok(source.length <= 20000);
});
