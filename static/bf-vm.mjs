/** Byte-accurate Brainfuck machine. No DOM, network, eval, or native execution. */
export const LIMITS = Object.freeze({
  code: 20000,
  input: 4096,
  steps: 2000000,
  output: 65536,
  cells: 30000,
  history: 20000,
});
export class BrainfuckVM {
  constructor(source, input = "", limits = {}) {
    this.limits = { ...LIMITS, ...limits };
    if (typeof source !== "string" || source.length > this.limits.code)
      throw new Error("Codul depășește limita de 20.000 de caractere.");
    this.input = new TextEncoder().encode(input);
    if (this.input.length > this.limits.input)
      throw new Error("Inputul depășește limita de 4.096 de octeți.");
    this.code = [];
    this.positions = [];
    this.jumps = new Map();
    const stack = [];
    for (let i = 0; i < source.length; i++) {
      const op = source[i];
      if (!"><+-.,[]".includes(op)) continue;
      const pc = this.code.length;
      this.code.push(op);
      this.positions.push(i);
      if (op === "[") stack.push(pc);
      if (op === "]") {
        if (!stack.length)
          throw new Error(`Paranteză ] fără pereche la caracterul ${i + 1}.`);
        const start = stack.pop();
        this.jumps.set(start, pc);
        this.jumps.set(pc, start);
      }
    }
    if (stack.length)
      throw new Error(
        `Paranteză [ fără pereche la caracterul ${this.positions[stack.pop()] + 1}.`,
      );
    this.tape = new Uint8Array(this.limits.cells);
    this.ptr = 0;
    this.pc = 0;
    this.steps = 0;
    this.inputPtr = 0;
    this.output = [];
    this.highWater = 0;
    this.history = new Array(this.limits.history);
    this.historyHead = 0;
    this.historyCount = 0;
    this.furthestStep = 0;
    this.lastChange = null;
    this.profiling = limits.profiling !== false;
    this.instructionVisits = new Uint32Array(this.code.length);
    this.cellVisits = new Uint32Array(this.tape.length);
    this.cellVisits[0] = 1;
    this.distinctCells = 1;
    this.operationCounts = Object.fromEntries(
      [..."><+-.,[]"].map((op) => [op, 0]),
    );
  }
  get done() {
    return this.pc >= this.code.length;
  }
  step() {
    if (this.done) return false;
    if (this.steps >= this.limits.steps)
      throw new Error(
        `Limita de ${this.limits.steps.toLocaleString("ro-RO")} de pași a fost atinsă. Verifică buclele.`,
      );
    const op = this.code[this.pc];
    if (op === "." && this.output.length >= this.limits.output)
      throw new Error(
        `Limita de output: ${this.limits.output.toLocaleString("ro-RO")} de octeți.`,
      );
    const oldPc = this.pc;
    const delta = this.limits.history
      ? {
          pc: this.pc,
          ptr: this.ptr,
          value: this.tape[this.ptr],
          inputPtr: this.inputPtr,
          outputLength: this.output.length,
          highWater: this.highWater,
          op,
        }
      : null;
    switch (op) {
      case ">":
        this.ptr = (this.ptr + 1) % this.tape.length;
        break;
      case "<":
        this.ptr = (this.ptr + this.tape.length - 1) % this.tape.length;
        break;
      case "+":
        this.tape[this.ptr]++;
        break;
      case "-":
        this.tape[this.ptr]--;
        break;
      case ".":
        this.output.push(this.tape[this.ptr]);
        break;
      case ",":
        this.tape[this.ptr] = this.input[this.inputPtr++] ?? 0;
        break;
      case "[":
        if (!this.tape[this.ptr]) this.pc = this.jumps.get(this.pc);
        break;
      case "]":
        if (this.tape[this.ptr]) this.pc = this.jumps.get(this.pc);
        break;
    }
    if (this.profiling) {
      this.instructionVisits[oldPc]++;
      this.operationCounts[op]++;
      if (this.cellVisits[this.ptr]++ === 0) this.distinctCells++;
    }
    if (delta) {
      delta.nextPtr = this.ptr;
      delta.nextValue = this.tape[delta.ptr];
      this.history[this.historyHead] = delta;
      this.historyHead = (this.historyHead + 1) % this.history.length;
      this.historyCount = Math.min(this.historyCount + 1, this.history.length);
      this.lastChange = delta;
    }
    this.highWater = Math.max(this.highWater, this.ptr);
    this.pc++;
    this.steps++;
    this.furthestStep = Math.max(this.furthestStep, this.steps);
    return true;
  }
  back() {
    if (!this.historyCount) return false;
    this.historyHead =
      (this.historyHead + this.history.length - 1) % this.history.length;
    const delta = this.history[this.historyHead];
    this.history[this.historyHead] = undefined;
    this.historyCount--;
    if (this.profiling) {
      this.instructionVisits[delta.pc]--;
      this.operationCounts[delta.op]--;
      if (--this.cellVisits[this.ptr] === 0) this.distinctCells--;
    }
    this.tape[delta.ptr] = delta.value;
    this.ptr = delta.ptr;
    this.pc = delta.pc;
    this.inputPtr = delta.inputPtr;
    this.output.length = delta.outputLength;
    this.highWater = delta.highWater;
    this.steps--;
    this.lastChange = { ...delta, undo: true };
    return true;
  }
  seek(target) {
    if (
      !Number.isInteger(target) ||
      target < this.steps - this.historyCount ||
      target > this.furthestStep
    )
      throw new RangeError("Pasul nu mai este în istoricul disponibil.");
    while (this.steps > target) this.back();
    while (this.steps < target) this.step();
  }
  profileSnapshot() {
    const instructions = Array.from(this.instructionVisits, (count, index) => ({
      index,
      count,
      op: this.code[index],
      sourceIndex: this.positions[index],
    }))
      .filter((row) => row.count)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 10);
    const cells = Array.from(this.cellVisits, (count, index) => ({
      index,
      count,
      value: this.tape[index],
    }))
      .filter((row) => row.count)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 16);
    const prefix = new Float64Array(this.code.length + 1);
    for (let i = 0; i < this.code.length; i++)
      prefix[i + 1] = prefix[i] + this.instructionVisits[i];
    const loops = [];
    for (const [start, end] of this.jumps)
      if (start < end && prefix[end + 1] > prefix[start])
        loops.push({ start, end, steps: prefix[end + 1] - prefix[start] });
    loops.sort((a, b) => b.steps - a.steps || a.start - b.start);
    return {
      instructions,
      cells,
      loops: loops.slice(0, 8),
      operations: this.operationCounts,
      distinctCells: this.distinctCells,
    };
  }
  snapshot() {
    const start = Math.max(0, Math.min(this.ptr - 7, this.tape.length - 16));
    return {
      pc: this.pc,
      sourceIndex: this.positions[this.pc] ?? -1,
      instructions: this.code.length,
      ptr: this.ptr,
      steps: this.steps,
      inputPtr: Math.min(this.inputPtr, this.input.length),
      output: this.output,
      done: this.done,
      cells: Array.from(this.tape.slice(start, start + 16)),
      start,
      historyFloor: this.steps - this.historyCount,
      historyCount: this.historyCount,
      furthestStep: this.furthestStep,
      distinctCells: this.distinctCells,
      change: this.lastChange,
    };
  }
  run() {
    while (this.step()) {
      /* bounded by step and output limits */
    }
    return Uint8Array.from(this.output);
  }
}
