import { BrainfuckVM } from "./bf-vm.mjs";
function machine(code, input = "", extra = {}) {
  return new BrainfuckVM(code, input, { history: 0, ...extra });
}
function metrics(vm) {
  return {
    steps: vm.steps,
    cells: vm.distinctCells,
    instructions: vm.code.length,
  };
}
function evaluate(code, cases) {
  if (!Array.isArray(cases) || !cases.length || cases.length > 8)
    throw new Error("Sunt permise 1–8 cazuri.");
  return cases.map((sample) => {
    try {
      const vm = machine(code, sample.input || "", {
        steps: 500000,
        output: 4096,
      });
      const actual = vm.run();
      const expected = sample.expectedBytes
        ? Uint8Array.from(sample.expectedBytes)
        : new TextEncoder().encode(sample.expected || "");
      const memory = Object.entries(sample.memory || {}).every(
        ([cell, value]) => vm.tape[Number(cell)] === value,
      );
      return {
        pass:
          memory &&
          actual.length === expected.length &&
          actual.every((byte, i) => byte === expected[i]),
        actual: [...actual.slice(0, 256)],
        expected: [...expected.slice(0, 256)],
        input: sample.input || "",
        ...metrics(vm),
      };
    } catch (error) {
      return { pass: false, input: sample.input || "", error: error.message };
    }
  });
}
self.onmessage = ({ data }) => {
  try {
    if (data.type === "evaluate") {
      const results = evaluate(data.code, data.cases);
      self.postMessage({
        ok: true,
        results,
        pass: results.every((r) => r.pass),
      });
      return;
    }
    if (data.type === "run" || data.type === "inspect") {
      const vm = machine(data.code, data.input || "");
      const output = vm.run();
      self.postMessage({
        ok: true,
        output: [...output],
        memory: [...vm.tape.slice(0, 16)],
        profile: vm.profileSnapshot(),
        ...metrics(vm),
      });
      return;
    }
    throw new Error("Operație necunoscută.");
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
