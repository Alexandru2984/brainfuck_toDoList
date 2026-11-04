import { TerminalSession } from "./terminal-session.mjs";

let session, timer;
function emit(extra = {}) {
  self.postMessage({ ...session.snapshot(), ...extra });
}
function schedule() {
  clearTimeout(timer);
  if (session.state === "running") timer = setTimeout(tick, 0);
}
function tick() {
  session.advance();
  emit();
  schedule();
}
self.onmessage = ({ data }) => {
  try {
    if (data.type === "load") {
      clearTimeout(timer);
      session = null;
      session = new TerminalSession(data.code);
      session.resume();
    } else {
      if (!session) throw new Error("Pornește mai întâi un program.");
      if (data.type === "feed") session.feed(data.text, data.end);
      else if (data.type === "pause") session.pause();
      else if (data.type === "resume") session.resume();
      else if (data.type === "download") {
        self.postMessage({ type: "download", output: session.vm.output });
        return;
      } else throw new Error("Comandă necunoscută.");
    }
    emit(data.type === "feed" ? { ack: data.id } : {});
    schedule();
  } catch (error) {
    if (session) emit({ notice: error.message, ack: data.id });
    else self.postMessage({ state: "error", error: error.message });
  }
};
