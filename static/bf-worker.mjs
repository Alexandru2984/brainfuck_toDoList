import { BrainfuckVM } from "./bf-vm.mjs";
let vm = null,
  running = false,
  epoch = 0,
  breakpoints = new Set(),
  batch = 10000,
  elapsed = 0,
  started = 0;
let lastBreakpoint = null;
function report(state, error = "") {
  self.postMessage({
    state,
    error,
    ...(vm ? vm.snapshot() : {}),
    ...(vm && !running ? { profile: vm.profileSnapshot() } : {}),
    elapsed: elapsed + (running ? performance.now() - started : 0),
  });
}
function pause(state = "paused") {
  if (running) elapsed += performance.now() - started;
  running = false;
  epoch++;
  report(state);
}
function run() {
  if (!vm || vm.done || running) return;
  running = true;
  started = performance.now();
  const current = ++epoch;
  let skipCurrent = lastBreakpoint === vm.pc;
  lastBreakpoint = null;
  function tick() {
    if (!running || current !== epoch) return;
    try {
      for (let i = 0; i < batch && !vm.done; i++) {
        if (!skipCurrent && breakpoints.has(vm.pc)) {
          lastBreakpoint = vm.pc;
          pause("breakpoint");
          return;
        }
        skipCurrent = false;
        vm.step();
      }
      if (vm.done) {
        pause("done");
        return;
      }
      report("running");
      setTimeout(tick, batch < 10000 ? 50 : 0);
    } catch (error) {
      pause("error");
      report("error", error.message);
    }
  }
  tick();
}
self.onmessage = ({ data }) => {
  try {
    if (data.type === "test") {
      const results = data.cases.map((test) => {
        try {
          const machine = new BrainfuckVM(data.code, test.input, {
            steps: 200000,
            output: 4096,
            history: 0,
            profiling: true,
          });
          const actual = machine.run(),
            expected = new TextEncoder().encode(test.expected);
          return {
            input: test.input,
            expected: test.expected,
            actual: Array.from(actual),
            pass:
              actual.length === expected.length &&
              actual.every((b, i) => b === expected[i]),
            steps: machine.steps,
            cells: machine.distinctCells,
            instructions: machine.code.length,
          };
        } catch (error) {
          return {
            input: test.input,
            expected: test.expected,
            pass: false,
            error: error.message,
          };
        }
      });
      self.postMessage({ state: "tests", results });
      return;
    }
    if (data.type === "load") {
      running = false;
      epoch++;
      elapsed = 0;
      vm = null;
      vm = new BrainfuckVM(data.code, data.input);
      lastBreakpoint = null;
      breakpoints = new Set(data.breakpoints || []);
      batch = data.batch === 1 ? 1 : 10000;
      report("ready");
      if (data.action === "run") run();
      else if (data.action === "step") {
        vm.step();
        report(vm.done ? "done" : "paused");
      }
    } else if (data.type === "run") run();
    else if (data.type === "step" && vm && !running) {
      vm.step();
      report(vm.done ? "done" : "paused");
    } else if (data.type === "back" && vm && !running) {
      vm.back();
      lastBreakpoint = null;
      report("paused");
    } else if (data.type === "seek" && vm && !running) {
      vm.seek(data.step);
      lastBreakpoint = null;
      report(vm.done ? "done" : "paused");
    } else if (data.type === "pause") pause();
    else if (data.type === "breakpoints") breakpoints = new Set(data.values);
  } catch (error) {
    running = false;
    epoch++;
    report("error", error.message);
  }
};
