import {
  graphicPrograms,
  decodeFrames,
  pixelBuffer,
  validateDimensions,
} from "./graphics.mjs";
import {
  $,
  node,
  message,
  source,
  runJob,
  download,
  codeUrl,
  sharedCode,
} from "./studio-common.mjs";
let frames = [],
  index = 0,
  width = 16,
  height = 16,
  timer,
  controller,
  revision = 0;
const motion = matchMedia("(prefers-reduced-motion: reduce)");
function pause() {
  clearInterval(timer);
  timer = null;
  $("graphics-play").textContent = "Redă animația";
}
function controls() {
  const ready = frames.length > 0;
  $("graphics-next").disabled = !ready || frames.length < 2;
  $("graphics-play").disabled = !ready || frames.length < 2 || motion.matches;
  $("graphics-frame").disabled = !ready;
  $("graphics-png").disabled = !ready;
  $("graphics-motion").textContent = motion.matches
    ? "Mișcare redusă activă. Schimbă cadrele manual."
    : "Animațiile pornesc numai la apăsarea butonului.";
}
function dimensions() {
  return [
    Number($("graphics-width").value),
    Number($("graphics-height").value),
    Number($("graphics-count").value),
  ];
}
function draw() {
  if (!frames.length) return;
  const canvas = $("graphics-canvas");
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(
        pixelBuffer(frames[index], $("graphics-palette").value),
        width,
        height,
      ),
      0,
      0,
    );
  $("graphics-frame").value = index;
  $("graphics-frame-label").textContent =
    `Cadrul ${index + 1} / ${frames.length} · ${width}×${height} pixeli`;
}
function invalidate() {
  pause();
  frames = [];
  controls();
  $("graphics-frame-label").textContent =
    "Codul sau configurația s-a schimbat. Rulează din nou.";
}
async function select(program, initial = false) {
  controller?.abort();
  invalidate();
  const version = ++revision;
  $("graphics-description").textContent = program.description;
  $("graphics-width").value = program.width;
  $("graphics-height").value = program.height;
  $("graphics-count").value = program.frames;
  $("graphics-input").value = "";
  try {
    const code = await source(program.file);
    if (version !== revision) return;
    $("graphics-code").value = code;
    if (initial && location.hash.startsWith("#code=")) {
      const shared = sharedCode();
      if (shared !== null) $("graphics-code").value = shared;
      const params = new URLSearchParams(location.search);
      for (const [key, id] of [
        ["w", "graphics-width"],
        ["h", "graphics-height"],
        ["frames", "graphics-count"],
      ])
        if (params.has(key)) $(id).value = params.get(key);
      message(
        "graphics-status",
        "Program partajat încărcat. Apasă Rulează pentru a genera cadrele.",
      );
    } else message("graphics-status", "Program BF încărcat. Apasă Rulează.");
  } catch (error) {
    if (version === revision) message("graphics-status", error.message, true);
  }
}
for (const program of graphicPrograms) {
  const option = node("option", program.name);
  option.value = program.id;
  $("graphics-example").append(option);
}
$("graphics-example").addEventListener("change", () =>
  select(graphicPrograms.find((p) => p.id === $("graphics-example").value)),
);
$("graphics-run").addEventListener("click", async () => {
  const dims = dimensions();
  try {
    validateDimensions(...dims);
  } catch (error) {
    message("graphics-status", error.message, true);
    return;
  }
  pause();
  controller?.abort();
  controller = new AbortController();
  const code = $("graphics-code").value,
    input = $("graphics-input").value,
    version = revision;
  $("graphics-run").disabled = true;
  $("graphics-stop").disabled = false;
  message("graphics-status", "Programul Brainfuck calculează pixelii…");
  try {
    const data = await runJob(
      { type: "run", code, input },
      { signal: controller.signal },
    );
    if (
      version !== revision ||
      code !== $("graphics-code").value ||
      input !== $("graphics-input").value ||
      dims.join() !== dimensions().join()
    ) {
      message("graphics-status", "Configurația s-a schimbat. Rulează din nou.");
      return;
    }
    frames = decodeFrames(data.output, ...dims);
    [width, height] = dims;
    index = 0;
    $("graphics-frame").max = frames.length - 1;
    draw();
    controls();
    message(
      "graphics-status",
      `${data.output.length} pixeli generați de BF · ${data.steps.toLocaleString("ro-RO")} pași · ${frames.length} cadre.`,
    );
  } catch (error) {
    message("graphics-status", error.message, true);
  } finally {
    $("graphics-run").disabled = false;
    $("graphics-stop").disabled = true;
  }
});
$("graphics-stop").addEventListener("click", () => controller?.abort());
$("graphics-next").addEventListener("click", () => {
  pause();
  index = (index + 1) % frames.length;
  draw();
});
$("graphics-frame").addEventListener("input", () => {
  pause();
  index = Number($("graphics-frame").value);
  draw();
});
$("graphics-palette").addEventListener("change", draw);
$("graphics-play").addEventListener("click", () => {
  if (timer) {
    pause();
    return;
  }
  if (motion.matches || frames.length < 2) return;
  const delay = Number($("graphics-delay").value);
  if (!Number.isInteger(delay) || delay < 100 || delay > 1000) {
    message(
      "graphics-status",
      "Durata unui cadru trebuie să fie între 100 și 1000 ms.",
      true,
    );
    return;
  }
  $("graphics-play").textContent = "Pauză";
  timer = setInterval(() => {
    index = (index + 1) % frames.length;
    draw();
  }, delay);
});
$("graphics-png").addEventListener("click", () => {
  if (frames.length)
    $("graphics-canvas").toBlob((blob) => {
      if (blob)
        download("brainfuck-frame-" + (index + 1) + ".png", blob, "image/png");
    }, "image/png");
});
$("graphics-download").addEventListener("click", () =>
  download("pixels.bf", $("graphics-code").value),
);
$("graphics-share").addEventListener("click", async () => {
  try {
    const [w, h, count] = dimensions();
    validateDimensions(w, h, count);
    const url = codeUrl(
      $("graphics-code").value,
      `/graphics?w=${w}&h=${h}&frames=${count}`,
    );
    $("graphics-share-url").value = url;
    $("graphics-share-panel").hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      message("graphics-status", "Link copiat, fără input.");
    } catch {
      $("graphics-share-url").select();
      message("graphics-status", "Copiază linkul afișat.");
    }
  } catch (error) {
    message("graphics-status", error.message, true);
  }
});
for (const id of [
  "graphics-code",
  "graphics-input",
  "graphics-width",
  "graphics-height",
  "graphics-count",
])
  $(id).addEventListener("input", () => {
    controller?.abort();
    invalidate();
  });
motion.addEventListener("change", () => {
  pause();
  controls();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => {
  pause();
  controller?.abort();
});
window.addEventListener("hashchange", () =>
  select(
    graphicPrograms.find((p) => p.id === $("graphics-example").value),
    true,
  ),
);
select(graphicPrograms[0], true);
controls();
