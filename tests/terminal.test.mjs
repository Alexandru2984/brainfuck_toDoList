import test from "node:test";
import assert from "node:assert/strict";
import { BrainfuckVM } from "../static/bf-vm.mjs";
import { TerminalSession } from "../static/terminal-session.mjs";

test("interactive comma waits without changing steps, memory, history or profile", () => {
  const vm = new BrainfuckVM("+,.", "", { interactive: true });
  vm.step();
  const before = structuredClone(vm.snapshot());
  const profile = structuredClone(vm.profileSnapshot());
  for (let i = 0; i < 20; i++) assert.equal(vm.step(), false);
  assert.deepEqual(vm.snapshot(), before);
  assert.deepEqual(vm.profileSnapshot(), profile);
  vm.feedInput("A");
  assert.deepEqual([...vm.run()], [65]);
  assert.equal(vm.steps, 3);
});

test("incremental UTF-8 and explicit EOF keep zero and undo semantics", () => {
  const vm = new BrainfuckVM(",[.,]", "", { interactive: true });
  vm.feedInput("Salut, ");
  vm.run();
  assert.equal(vm.waiting, true);
  vm.feedInput("🧠");
  assert.equal(new TextDecoder().decode(vm.run()), "Salut, 🧠");
  assert.equal(vm.done, false);
  const steps = vm.steps;
  vm.feedInput("", true);
  vm.run();
  assert.equal(vm.done, true);
  assert.equal(vm.steps, steps + 2);
  vm.back();
  vm.back();
  assert.equal(vm.tape[0], 160);
  vm.run();
  assert.equal(vm.done, true);
  assert.throws(() => vm.feedInput("B"), /închis/);
  assert.deepEqual([...new BrainfuckVM(",.,.", "A").run()], [65, 0]);
});

test("input limits are cumulative UTF-8 bytes and failed feeds are atomic", () => {
  const vm = new BrainfuckVM(",", "", { interactive: true });
  vm.feedInput("🧠".repeat(1024));
  const input = vm.input;
  assert.throws(() => vm.feedInput("x", true), /cumulativ/);
  assert.equal(vm.input, input);
  assert.equal(vm.inputEnded, false);
  assert.throws(() => vm.feedInput(null), /invalid/);
  vm.feedInput("", true);
  assert.equal(vm.inputEnded, true);
  assert.throws(() => new BrainfuckVM(",").feedInput("A"), /închis/);
});

test("queued data, pauses and waiting do not advance or close the stream", () => {
  const session = new TerminalSession(",.,.");
  session.resume();
  assert.equal(session.state, "waiting");
  session.feed("A");
  session.advance();
  assert.equal(session.state, "waiting");
  assert.deepEqual(session.vm.output, [65]);
  session.feed("B");
  session.pause();
  session.advance();
  assert.equal(session.vm.steps, 2);
  session.resume();
  session.advance();
  assert.equal(session.state, "done");
  assert.deepEqual(session.vm.output, [65, 66]);
  assert.throws(() => session.feed("C"));
});

test("terminal counts only active slices and bounds previews and endless execution", () => {
  let now = 0;
  const session = new TerminalSession(",+[]", {
    clock: () => now++,
    activeMs: 3,
  });
  session.resume();
  now += 1000000;
  session.advance();
  assert.equal(session.elapsed, 0);
  session.feed("A");
  for (let i = 0; i < 3; i++) session.advance();
  assert.equal(session.state, "error");
  assert.match(session.error, /calcul activ/);
  const endless = new TerminalSession("+[]");
  endless.resume();
  for (let i = 0; i < 201; i++) endless.advance();
  assert.equal(endless.state, "error");
  assert.equal(endless.vm.steps, 2000000);
  const output = new TerminalSession("+[.]");
  output.resume();
  for (let i = 0; i < 15; i++) output.advance();
  assert.equal(output.state, "error");
  assert.equal(output.vm.output.length, 65536);
  assert.equal(output.snapshot().output.length, 8192);
  assert.equal(output.snapshot().outputBytes, 65536);
});
