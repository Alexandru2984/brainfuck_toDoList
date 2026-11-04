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
    if (data.type === "self") {
      const reference = machine(data.code, data.input || "", {
        cells: 16,
        steps: 50000,
        output: 256,
      });
      const compact = reference.code.join("");
      if (compact.length > 31)
        throw new Error(
          "Programul interior poate avea cel mult 31 de instrucțiuni.",
        );
      if (new TextEncoder().encode(data.input || "").length > 128)
        throw new Error("Inputul interior poate avea cel mult 128 de octeți.");
      const framed = compact + "!" + (data.input || "");
      const outer = machine(data.outer, framed, { output: 256 });
      try {
        outer.run();
      } catch (error) {
        self.postMessage({
          ok: true,
          completed: false,
          error: error.message,
          outerSteps: outer.steps,
          output: [...outer.output],
        });
        return;
      }
      reference.run();
      const memory = Array.from(
        { length: 16 },
        (_, i) => outer.tape[164 + i * 4 + 1],
      );
      const equal =
        outer.output.length === reference.output.length &&
        outer.output.every((byte, i) => byte === reference.output[i]) &&
        memory.every((byte, i) => byte === reference.tape[i]) &&
        outer.tape[2] === reference.ptr;
      self.postMessage({
        ok: true,
        completed: true,
        equal,
        outerSteps: outer.steps,
        innerSteps: reference.steps,
        output: [...outer.output],
        memory,
        pointer: outer.tape[2],
        instructions: compact.length,
      });
      return;
    }
    if (data.type === "compare") {
      if (
        !Array.isArray(data.inputs) ||
        !data.inputs.length ||
        data.inputs.length > 8 ||
        data.inputs.some(
          (input) =>
            typeof input !== "string" ||
            new TextEncoder().encode(input).length > 512,
        )
      )
        throw new Error("Inputuri de comparație invalide.");
      const rows = data.inputs.map((input) => {
        try {
          const a = machine(data.left, input, { steps: 500000, output: 4096 }),
            b = machine(data.right, input, { steps: 500000, output: 4096 });
          const outputA = a.run(),
            outputB = b.run();
          const output =
            outputA.length === outputB.length &&
            outputA.every((byte, i) => byte === outputB[i]);
          const memory = a.tape.every((byte, i) => byte === b.tape[i]);
          const pointer = a.ptr === b.ptr;
          const consumed =
            Math.min(a.inputPtr, a.input.length) ===
            Math.min(b.inputPtr, b.input.length);
          return {
            input,
            equal: output && memory && pointer && consumed,
            output,
            memory,
            pointer,
            consumed,
            left: metrics(a),
            right: metrics(b),
            profileA: a.profileSnapshot(),
            profileB: b.profileSnapshot(),
          };
        } catch (error) {
          return { input, equal: null, error: error.message };
        }
      });
      self.postMessage({ ok: true, rows });
      return;
    }
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
