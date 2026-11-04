import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
import { terminalPrograms } from "../static/terminal-data.mjs";

const files = Object.fromEntries(
  terminalPrograms.map((p) => [
    p.id,
    readFileSync(
      new URL("../static/programs/" + p.file, import.meta.url),
      "utf8",
    ),
  ]),
);
function execute(id, input) {
  const vm = new BrainfuckVM(files[id], input, {
    history: 0,
    profiling: false,
  });
  return new TextDecoder().decode(vm.run());
}

for (const p of terminalPrograms)
  test("terminal BF references: " + p.id, () => {
    assert.match(files[p.id], /^[><+\-.,\[\]\n]+$/);
    for (const sample of p.cases)
      assert.equal(execute(p.id, sample.input), sample.expected);
  });

test("decimal BF parser and formatter roundtrip every byte and reject malformed lines", () => {
  for (let value = 0; value < 256; value++) {
    const expected = `Numar (0..255): Valoare: ${value}\n`;
    assert.equal(execute("terminal-decimal", value + "\n"), expected);
    assert.equal(
      execute("terminal-decimal", String(value).padStart(3, "0")),
      expected,
    );
  }
  for (const input of [
    "",
    "\n",
    "256\n",
    "999\n",
    "1000\n",
    "-1\n",
    "+1\n",
    "2x\n",
    "🧠\n",
    " 1\n",
    "1\r\n",
    "0000\n",
  ])
    assert.equal(
      execute("terminal-decimal", input),
      "Numar (0..255): Input invalid.\n",
    );
});

test("BF calculator handles byte boundaries and large multiplication within two million steps", () => {
  for (const a of [0, 1, 9, 10, 25, 99, 128, 254, 255])
    for (const b of [0, 1, 9, 10, 25, 99, 128, 254, 255])
      for (const op of ["+", "-", "*"]) {
        const expected =
          (((op === "+" ? a + b : op === "-" ? a - b : a * b) % 256) + 256) %
          256;
        assert.equal(
          execute("terminal-calculator", `${a}\n${op}\n${b}\n`),
          `A (0..255): Operator (+ - *): B (0..255): Rezultat mod 256: ${expected}\n`,
        );
      }
  for (const input of [
    "1\n/\n2\n",
    "1\n++\n2\n",
    "1\n+\n256\n",
    "1\n+\n",
    "1\n",
    "1",
  ])
    assert.match(
      execute("terminal-calculator", input),
      /Input invalid sau incomplet\.\n$/,
    );
});

test("BF byte dump prints UTF-8 bytes rather than Unicode code points", () => {
  for (const text of ["A", "Salut", "🧠", "é", "\n", "\u0001", "\u007f"])
    assert.equal(
      execute("terminal-bytes", text),
      "Text UTF-8. EOF pentru stop.\n" +
        [...new TextEncoder().encode(text)].map((n) => n + " ").join("") +
        "\n",
    );
});

test("BF guessing rejects invalid partial matches and stops after five attempts", () => {
  const text = execute("terminal-guess", "37x\n37\n");
  assert.match(text, /Input invalid\.\nNumar \(0\.\.255\): CORECT/);
  assert.equal((text.match(/CORECT/g) || []).length, 1);
  const capped = execute("terminal-guess", "1\n2\n3\n4\n5\n37\n");
  assert.equal((capped.match(/Numar \(0\.\.255\):/g) || []).length, 5);
  assert.doesNotMatch(capped, /CORECT/);
});

test("BF prompts are emitted before input and subsequent answers resume the same machine", () => {
  const vm = new BrainfuckVM(files["terminal-calculator"], "", {
    interactive: true,
    history: 0,
  });
  const output = () => new TextDecoder().decode(vm.run());
  assert.equal(output(), "A (0..255): ");
  vm.feedInput("255\n");
  assert.equal(output(), "A (0..255): Operator (+ - *): ");
  vm.feedInput("+\n");
  assert.equal(output(), "A (0..255): Operator (+ - *): B (0..255): ");
  vm.feedInput("1\n");
  assert.equal(
    output(),
    "A (0..255): Operator (+ - *): B (0..255): Rezultat mod 256: 0\n",
  );
  assert.equal(vm.done, true);
});
