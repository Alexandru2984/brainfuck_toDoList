import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { library } from "../static/library-data.mjs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
const sources = new Map(
  library.map((p) => [
    p.id,
    readFileSync(
      new URL("../static/programs/" + p.file, import.meta.url),
      "utf8",
    ),
  ]),
);
function execute(name, input) {
  const vm = new BrainfuckVM(sources.get(name), input, { history: 0 });
  return new TextDecoder().decode(vm.run());
}
for (const p of library)
  test("library references: " + p.id, () => {
    for (const sample of p.cases) {
      const vm = new BrainfuckVM(sources.get(p.id), sample.input, {
        history: 0,
        steps: 500000,
      });
      const bytes = vm.run();
      assert.deepEqual(
        [...bytes],
        sample.expectedBytes ?? [...new TextEncoder().encode(sample.expected)],
      );
    }
    assert.ok(p.memory.length && p.explanation.length && p.domain);
  });
test("arithmetic algorithms cover their complete single-digit domains", () => {
  for (let a = 0; a <= 9; a++)
    for (let b = 0; b <= 9; b++) {
      assert.equal(
        execute("sort-pair", `${a}${b}`),
        [a, b].sort((a, b) => a - b).join(""),
      );
      assert.equal(
        execute("division", `${a}${b}`),
        b === 0 ? "?" : `${Math.floor(a / b)} ${a % b}`,
      );
      if (a + b <= 9)
        assert.equal(execute("calculator", `${a}+${b}`), String(a + b));
      if (a >= b)
        assert.equal(execute("calculator", `${a}-${b}`), String(a - b));
      if (a * b <= 9)
        assert.equal(execute("calculator", `${a}*${b}`), String(a * b));
    }
  for (let n = 0; n <= 6; n++)
    assert.equal(
      execute("fibonacci", String(n)),
      String([0, 1, 1, 2, 3, 5, 8][n]),
    );
  for (let n = 0; n <= 9; n++)
    assert.equal(execute("parity", String(n)), n % 2 ? "IMPAR" : "PAR");
});
test("ROT13 preserves printable ASCII outside letters and roundtrips UTF-8", () => {
  for (let code = 32; code <= 126; code++) {
    const c = String.fromCharCode(code);
    const expected =
      code >= 65 && code <= 90
        ? String.fromCharCode(65 + ((code - 65 + 13) % 26))
        : code >= 97 && code <= 122
          ? String.fromCharCode(97 + ((code - 97 + 13) % 26))
          : c;
    assert.equal(execute("rot13", c), expected);
  }
  assert.equal(execute("rot13", "Salut, 🧠"), "Fnyhg, 🧠");
  assert.equal(execute("rot13", "Hello, World!"), "Uryyb, Jbeyq!");
});
