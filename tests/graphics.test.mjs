import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  graphicPrograms,
  decodeFrames,
  pixelBuffer,
} from "../static/graphics.mjs";
import { BrainfuckVM } from "../static/bf-vm.mjs";
for (const p of graphicPrograms)
  test("BF computes pixels for " + p.id, () => {
    const code = readFileSync(
      new URL("../static/programs/" + p.file, import.meta.url),
      "utf8",
    );
    const vm = new BrainfuckVM(code, "", { history: 0 });
    const bytes = vm.run();
    const frames = decodeFrames([...bytes], p.width, p.height, p.frames);
    for (let f = 0; f < p.frames; f++)
      for (let y = 0; y < p.height; y++)
        for (let x = 0; x < p.width; x++) {
          const expected = {
            gradient: x * 16,
            checker: (x + y) % 2 ? 255 : 0,
            diagonal: x === y ? 255 : 0,
            pulse: f * 32,
            scanline: y === f ? 255 : 0,
          }[p.id];
          assert.equal(frames[f][y * p.width + x], expected);
        }
  });
test("frame decoding rejects malformed dimensions and payloads", () => {
  for (const [output, w, h, n] of [
    [[], 0, 8, 1],
    [[], 33, 8, 1],
    [[], 8, 8, 9],
    [[], 8, 8, 1],
    [[999], 1, 1, 1],
  ])
    assert.throws(() => decodeFrames(output, w, h, n));
  assert.deepEqual(
    [...pixelBuffer(Uint8Array.from([0, 255]))],
    [0, 0, 0, 255, 255, 255, 255, 255],
  );
});
