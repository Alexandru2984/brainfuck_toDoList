import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lessons } from "../static/curriculum.mjs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
for (const lesson of lessons)
  test("lesson reference solution: " + lesson.id, () => {
    const code =
      lesson.solution ??
      readFileSync(
        new URL("../static/programs/" + lesson.file, import.meta.url),
        "utf8",
      );
    for (const sample of lesson.cases) {
      const vm = new BrainfuckVM(code, sample.input, {
        history: 0,
        steps: 500000,
      });
      const output = vm.run();
      const expected = sample.expectedBytes ?? [
        ...new TextEncoder().encode(sample.expected),
      ];
      assert.deepEqual([...output], expected);
      for (const [cell, value] of Object.entries(sample.memory || {}))
        assert.equal(vm.tape[cell], value);
    }
    const prediction = new BrainfuckVM(lesson.prediction.code, "", {
      history: 0,
    });
    prediction.run();
    assert.ok(prediction.tape[lesson.prediction.cell] >= 0);
  });
