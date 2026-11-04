import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dailyPuzzle,
  utcDay,
  scoreSubmission,
  improveRecord,
} from "../static/daily.mjs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
test("UTC dates are deterministic and reject impossible dates", () => {
  assert.deepEqual(dailyPuzzle("2026-11-04"), dailyPuzzle("2026-11-04"));
  for (const date of ["2026-02-30", "x", "2026-1-01", "2026-11-04T00:00Z"])
    assert.throws(() => utcDay(date));
});
test("reference programs solve 40 days of seeded challenges", () => {
  for (let i = 0; i < 40; i++) {
    const date = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10),
      p = dailyPuzzle(date);
    const code =
      p.reference ??
      readFileSync(
        new URL("../static/programs/" + p.file, import.meta.url),
        "utf8",
      );
    const results = p.cases.map((sample) => {
      const vm = new BrainfuckVM(code, sample.input, {
        history: 0,
        steps: 500000,
      });
      assert.equal(new TextDecoder().decode(vm.run()), sample.expected, date);
      return { pass: true, steps: vm.steps, cells: vm.distinctCells };
    });
    const score = scoreSubmission(code, results);
    assert.ok(score.length > 0);
    assert.ok(score.steps > 0);
  }
});
test("records improve metrics independently and invalid runs never get a score", () => {
  assert.deepEqual(
    improveRecord(
      { length: 10, steps: 100, cells: 3 },
      { length: 12, steps: 80, cells: 2 },
    ),
    { length: 10, steps: 80, cells: 2 },
  );
  assert.deepEqual(
    improveRecord({ length: "bad" }, { length: 5, steps: 6, cells: 1 }),
    { length: 5, steps: 6, cells: 1 },
  );
  assert.throws(() => scoreSubmission("+", [{ pass: false }]));
  assert.throws(() => scoreSubmission("+", []));
  assert.deepEqual(
    scoreSubmission("comment + .", [{ pass: true, steps: 2, cells: 1 }]),
    { length: 2, steps: 2, cells: 1 },
  );
});
