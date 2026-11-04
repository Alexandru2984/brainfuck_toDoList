import { BrainfuckVM } from "./bf-vm.mjs";

export class TerminalSession {
  constructor(
    code,
    { clock = () => performance.now(), activeMs = 10000 } = {},
  ) {
    this.vm = new BrainfuckVM(code, "", {
      interactive: true,
      history: 0,
      profiling: false,
    });
    this.clock = clock;
    this.activeMs = activeMs;
    this.elapsed = 0;
    this.state = this.vm.done ? "done" : "paused";
    this.error = "";
  }
  resume() {
    if (["done", "error"].includes(this.state)) return;
    this.state = this.vm.waiting ? "waiting" : "running";
  }
  pause() {
    if (this.state === "running") this.state = "paused";
  }
  feed(text, end = false) {
    if (["done", "error"].includes(this.state))
      throw new Error("Pornește o sesiune nouă înainte de a trimite input.");
    this.vm.feedInput(text, end);
    if (this.state === "waiting") this.resume();
  }
  advance() {
    if (this.state !== "running") return;
    const started = this.clock();
    try {
      for (let i = 0; i < 10000 && this.vm.step(); i++) {
        // Fixed-size slices let the Worker receive pause/input/stop commands.
      }
      if (this.vm.done) this.state = "done";
      else if (this.vm.waiting) this.state = "waiting";
    } catch (error) {
      this.state = "error";
      this.error = error.message;
    } finally {
      this.elapsed += Math.max(0, this.clock() - started);
    }
    if (this.elapsed >= this.activeMs) {
      this.state = "error";
      this.error = "Limita de 10 secunde de calcul activ a fost atinsă.";
    }
  }
  snapshot() {
    return {
      ...this.vm.snapshot(),
      output: this.vm.output.slice(0, 8192),
      outputBytes: this.vm.output.length,
      elapsed: Math.round(this.elapsed),
      state: this.state,
      error: this.error,
    };
  }
}
