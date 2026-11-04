import { BrainfuckVM } from "./bf-vm.mjs";
export function optimizeBrainfuck(source) {
  const vm = new BrainfuckVM(source, "", { history: 0, profiling: false });
  const original = vm.code.join("");
  let code = original;
  const log = new Map();
  const record = (rule, before, after) => {
    if (before === after) return;
    const current = log.get(rule) || {
      rule,
      count: 0,
      before: before.slice(0, 48),
      after: after.slice(0, 48),
    };
    current.count++;
    log.set(rule, current);
  };
  if (source !== original)
    record("Elimină caracterele care nu sunt instrucțiuni", source, original);
  for (let pass = 0; pass < 8; pass++) {
    const previous = code;
    code = code.replace(/[+-]{2,}/g, (run) => {
      const net = [...run].reduce((sum, c) => sum + (c === "+" ? 1 : -1), 0);
      const byte = ((net % 256) + 256) % 256;
      const result = byte <= 128 ? "+".repeat(byte) : "-".repeat(256 - byte);
      record("Combină modificări consecutive modulo 256", run, result);
      return result;
    });
    code = code.replace(/[<>]{2,}/g, (run) => {
      const net = [...run].reduce((sum, c) => sum + (c === ">" ? 1 : -1), 0);
      const index = ((net % 30000) + 30000) % 30000;
      const result =
        index <= 15000 ? ">".repeat(index) : "<".repeat(30000 - index);
      record("Combină deplasări pe banda circulară", run, result);
      return result;
    });
    code = code.replace(/(?:\[-\]){2,}/g, (run) => {
      record("Elimină curățări redundante ale aceleiași celule", run, "[-]");
      return "[-]";
    });
    if (code.startsWith("[")) {
      let depth = 0,
        end = 0;
      for (; end < code.length; end++) {
        if (code[end] === "[") depth++;
        else if (code[end] === "]" && --depth === 0) break;
      }
      const removed = code.slice(0, end + 1);
      record("Elimină bucla inițială: celula pornește de la zero", removed, "");
      code = code.slice(end + 1);
    }
    if (code === previous) break;
  }
  return {
    original,
    optimized: code,
    changes: [...log.values()],
    before: original.length,
    after: code.length,
  };
}
export function parseComparisonInputs(text) {
  if (typeof text !== "string" || text.length > 5000)
    throw new Error("Lista de inputuri este prea mare.");
  let inputs;
  try {
    inputs = JSON.parse(text);
  } catch {
    throw new Error("Inputurile trebuie să fie o listă JSON de texte.");
  }
  if (
    !Array.isArray(inputs) ||
    !inputs.length ||
    inputs.length > 8 ||
    inputs.some(
      (value) =>
        typeof value !== "string" ||
        new TextEncoder().encode(value).length > 512,
    )
  )
    throw new Error("Alege 1–8 texte, fiecare de maximum 512 octeți UTF-8.");
  return inputs;
}
