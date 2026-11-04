import { renderDebug, resetDebug } from "./lab-debug.mjs";
import { examples, challenges } from "./catalog.mjs";
import { LIMITS } from "./bf-vm.mjs";
const $ = (id) => document.getElementById(id);
const editor = $("code"),
  input = $("stdin"),
  status = $("run-status");
let worker,
  testWorker,
  exampleLoad = null,
  loaded = "",
  snapshot = null,
  running = false,
  watchdog;
let breakpoints = new Set(),
  currentChallenge = null,
  outputMode = "text",
  lastExample = "hello";
let solved = new Set();
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    announce("Stocarea locală nu este disponibilă în acest browser.");
    return false;
  }
}
function announce(message, error = false) {
  status.textContent = message;
  status.classList.toggle("has-error", error);
}
function setRunning(value) {
  running = value;
  const blocked = value || Boolean(exampleLoad);
  $("pause").disabled = !value;
  $("step").disabled = blocked;
  $("run").disabled = blocked;
  editor.readOnly = value;
  input.readOnly = value;
  $("speed").disabled = value;
  if ($("back")) {
    $("back").disabled = blocked || !worker || !snapshot?.historyCount;
    $("timeline").disabled = blocked || !worker || !snapshot?.furthestStep;
  }
  clearTimeout(watchdog);
  if (value)
    watchdog = setTimeout(() => {
      stopWorker();
      announce(
        "Execuția a fost oprită după 10 secunde. Poți reseta și investiga bucla.",
        true,
      );
    }, 10000);
}
function newWorker() {
  worker = new Worker(new URL("./bf-worker.mjs", import.meta.url), {
    type: "module",
  });
  worker.onmessage = ({ data }) => {
    snapshot = data;
    if (data.state !== "running" && !(data.state === "ready" && running))
      setRunning(false);
    const labels = {
      ready: "Pregătit. Poți rula sau avansa un pas.",
      running: "Rulează…",
      paused: "Pauză. Continuă sau avansează un pas.",
      breakpoint: `Breakpoint la instrucțiunea ${data.pc}.`,
      done: "Execuție încheiată.",
      error: data.error || "Execuția a fost oprită.",
    };
    announce(labels[data.state] || "Pregătit.", data.state === "error");
    if (data.state === "error" && !data.cells) loaded = "";
    if (data.cells) renderSnapshot(data);
  };
  worker.onerror = () => {
    stopWorker();
    announce(
      "Workerul nu a putut porni. Reîncarcă pagina într-un browser modern.",
      true,
    );
  };
}
function stopWorker() {
  if (worker) worker.terminate();
  worker = null;
  loaded = "";
  setRunning(false);
}
function send(action) {
  if (running || exampleLoad) return;
  const identity = JSON.stringify([
    editor.value,
    input.value,
    $("speed").value,
  ]);
  if (!worker || identity !== loaded || snapshot?.done) {
    stopWorker();
    newWorker();
    loaded = identity;
    if (action === "run") setRunning(true);
    worker.postMessage({
      type: "load",
      code: editor.value,
      input: input.value,
      action,
      batch: Number($("speed").value),
      breakpoints: [...breakpoints],
    });
  } else {
    if (action === "run") setRunning(true);
    worker.postMessage({ type: action });
  }
}
function reset() {
  cancelExampleLoad();
  stopWorker();
  snapshot = null;
  $("output").textContent = "Outputul programului va apărea aici.";
  $("hex-output").textContent = "";
  $("memory").replaceChildren();
  for (const id of [
    "metric-steps",
    "metric-pointer",
    "metric-output",
    "metric-time",
  ])
    $(id).textContent = "0";
  $("trace").replaceChildren();
  resetDebug();
  announce("Resetat. Banda de memorie este goală.");
}
function renderSnapshot(data) {
  $("metric-steps").textContent = data.steps.toLocaleString("ro-RO");
  $("metric-pointer").textContent = data.ptr;
  $("metric-output").textContent = data.output.length;
  $("metric-time").textContent = Math.round(data.elapsed || 0);
  const fragment = document.createDocumentFragment();
  data.cells.forEach((value, i) => {
    const cell = document.createElement("div");
    cell.className =
      "memory-cell" +
      (data.start + i === data.ptr ? " current" : "") +
      (data.change &&
      data.change.ptr === data.start + i &&
      data.change.value !== data.change.nextValue
        ? " changed"
        : "");
    const index = document.createElement("span"),
      number = document.createElement("strong"),
      char = document.createElement("small");
    index.textContent = String(data.start + i).padStart(3, "0");
    number.textContent = String(value).padStart(3, "0");
    char.textContent =
      value >= 32 && value <= 126 ? String.fromCharCode(value) : "·";
    cell.append(index, number, char);
    fragment.append(cell);
  });
  $("memory").replaceChildren(fragment);
  const bytes = Uint8Array.from(data.output.slice(0, 8192));
  $("output").textContent = bytes.length
    ? new TextDecoder().decode(bytes)
    : "∅ — niciun octet afișat";
  $("hex-output").textContent = bytes.length
    ? Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ")
    : "∅";
  $("output-truncated").hidden = data.output.length <= 8192;
  const code = editor.value.split("").filter((c) => "><+-.,[]".includes(c));
  const start = Math.max(0, data.pc - 20),
    end = Math.min(code.length, start + 65),
    trace = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const op = document.createElement("span");
    op.textContent = code[i];
    op.title = `Instrucțiunea ${i}`;
    if (i === data.pc) op.className = "current-op";
    trace.append(op);
  }
  $("trace").replaceChildren(trace);
  $("pc-label").textContent = `${data.pc} / ${data.instructions}`;
  renderDebug(data, running);
  if (!running && data.sourceIndex >= 0)
    editor.setSelectionRange(data.sourceIndex, data.sourceIndex + 1);
}
function codeChanged() {
  if (exampleLoad) {
    cancelExampleLoad();
    setRunning(false);
    announce("Încărcarea exemplului a fost anulată. Codul tău este păstrat.");
  }
  if (snapshot || worker) reset();
  const ops = editor.value.match(/[><+\-.,\[\]]/g) || [];
  $("instruction-count").textContent = `${ops.length} instrucțiuni`;
  $("source-size").textContent =
    `${editor.value.length.toLocaleString("ro-RO")} / 20.000 caractere`;
  $("line-numbers").textContent = Array.from(
    { length: editor.value.split("\n").length },
    (_, i) => String(i + 1).padStart(2, "0"),
  ).join("\n");
  loaded = "";
  if ($("save-draft").checked) store("bf-lab-draft-v1", editor.value);
}
function replaceProgram(code, stdin = "") {
  reset();
  editor.value = code;
  input.value = stdin;
  breakpoints.clear();
  showBreakpoints();
  codeChanged();
}
async function loadExample(example) {
  reset();
  const controller = new AbortController();
  exampleLoad = controller;
  // Apply defaults before the request; subsequent user input must survive it.
  input.value = example.input || "";
  setRunning(false);
  announce(`Se încarcă: ${example.name}…`);
  try {
    const response = await fetch(`/static/programs/${example.file}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error();
    const source = await response.text();
    if (exampleLoad !== controller) return;
    exampleLoad = null;
    replaceProgram(source, input.value);
    lastExample = example.id;
    $("example-title").textContent = example.name;
    $("example-description").textContent = example.description;
    document
      .querySelectorAll(".example-button")
      .forEach((button) =>
        button.classList.toggle(
          "is-active",
          button.dataset.example === example.id,
        ),
      );
    announce(`Încărcat: ${example.name}. Apasă Rulează.`);
  } catch {
    if (exampleLoad !== controller) return;
    exampleLoad = null;
    setRunning(false);
    announce("Exemplul nu a putut fi încărcat. Încearcă din nou.", true);
  }
}
function cancelExampleLoad() {
  exampleLoad?.abort();
  exampleLoad = null;
}
function showBreakpoints() {
  $("breakpoint-list").textContent = breakpoints.size
    ? `Active: ${[...breakpoints].sort((a, b) => a - b).join(", ")}`
    : "Niciun breakpoint";
  if (worker)
    worker.postMessage({ type: "breakpoints", values: [...breakpoints] });
}
function download(name, text, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function updateProgress() {
  $("challenge-progress").textContent =
    `${solved.size} / ${challenges.length} rezolvate`;
  for (const option of $("challenge-select").options) {
    const c = challenges.find((c) => c.id === option.value);
    if (c) option.textContent = c.name + (solved.has(c.id) ? " ✓" : "");
  }
}
function selectChallenge() {
  currentChallenge = challenges.find(
    (c) => c.id === $("challenge-select").value,
  );
  $("challenge-prompt").textContent = currentChallenge.prompt;
  $("challenge-hint").textContent = currentChallenge.hint;
  $("test-results").replaceChildren();
  $("challenge-hint-details").open = false;
}
function checkChallenge() {
  if (!currentChallenge || testWorker || exampleLoad) return;
  const challenge = currentChallenge,
    testedCode = editor.value,
    button = $("verify-challenge");
  button.disabled = true;
  button.textContent = "Verific…";
  testWorker = new Worker(new URL("./bf-worker.mjs", import.meta.url), {
    type: "module",
  });
  const timeout = setTimeout(
    () => finish("Verificarea a depășit limita de timp."),
    5000,
  );
  function finish(error = "") {
    clearTimeout(timeout);
    testWorker?.terminate();
    testWorker = null;
    button.disabled = false;
    button.textContent = "Verifică soluția";
    if (error) $("test-results").textContent = error;
  }
  testWorker.onerror = () => finish("Verificarea nu a putut porni.");
  testWorker.onmessage = ({ data }) => {
    if (data.state !== "tests") return;
    if (currentChallenge.id !== challenge.id || editor.value !== testedCode) {
      finish("Codul sau provocarea s-a schimbat. Verifică din nou.");
      return;
    }
    const list = document.createDocumentFragment();
    data.results.forEach((result, i) => {
      const item = document.createElement("div");
      item.className = "test-result " + (result.pass ? "pass" : "fail");
      item.textContent = `${result.pass ? "✓" : "×"} Caz ${i + 1}: input ${JSON.stringify(result.input)} → așteptat ${JSON.stringify(result.expected)}${result.error ? " · " + result.error : ""}`;
      list.append(item);
    });
    $("test-results").replaceChildren(list);
    if (data.results.every((r) => r.pass)) {
      solved.add(challenge.id);
      store("bf-lab-solved-v1", JSON.stringify([...solved]));
      updateProgress();
      announce("Provocare rezolvată! Toate cazurile au trecut.");
    }
    finish();
  };
  testWorker.postMessage({
    type: "test",
    code: testedCode,
    cases: challenge.cases,
  });
}
function decodeShare() {
  if (!location.hash.startsWith("#code=")) return false;
  try {
    const encoded = location.hash.slice(6);
    if (encoded.length > 30000) throw new Error();
    const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      ),
    );
    if (
      value.v !== 1 ||
      typeof value.code !== "string" ||
      value.code.length > LIMITS.code
    )
      throw new Error();
    replaceProgram(value.code);
    announce(
      "Program partajat încărcat. Inspectează-l și apasă Rulează când ești gata.",
    );
    return true;
  } catch {
    announce("Linkul partajat este invalid sau prea mare.", true);
    return true;
  }
}
async function share() {
  if (editor.value.length > 6000) {
    announce(
      "Pentru programe de peste 6.000 de caractere, folosește descărcarea .bf.",
      true,
    );
    return;
  }
  const bytes = new TextEncoder().encode(
    JSON.stringify({ v: 1, code: editor.value }),
  );
  const encoded = btoa(
    Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (encoded.length > 30000) {
    announce(
      "Codul este prea mare pentru un link. Descarcă fișierul .bf.",
      true,
    );
    return;
  }
  const url = new URL(location.pathname, location.origin);
  url.hash = "code=" + encoded;
  $("share-url").value = url.href;
  $("share-dialog").showModal();
  $("share-url").select();
  try {
    await navigator.clipboard.writeText(url.href);
    $("share-message").textContent =
      "Link copiat. Include doar codul, fără input.";
  } catch {
    $("share-message").textContent =
      "Copiază linkul de mai jos. Include doar codul, fără input.";
  }
}
for (const example of examples) {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "example-button" + (example.id === lastExample ? " is-active" : "");
  button.dataset.example = example.id;
  const title = document.createElement("span"),
    detail = document.createElement("small");
  title.textContent = example.name;
  detail.textContent = example.level;
  button.append(title, detail);
  button.addEventListener("click", () => loadExample(example));
  $("example-list").append(button);
}
for (const c of challenges) {
  const option = document.createElement("option");
  option.value = c.id;
  option.textContent = c.name;
  $("challenge-select").append(option);
}
try {
  const stored = JSON.parse(readStored("bf-lab-solved-v1") || "[]");
  if (Array.isArray(stored))
    solved = new Set(
      stored.filter((id) => challenges.some((c) => c.id === id)),
    );
} catch {
  /* corrupt local progress is ignored */
}
$("run").addEventListener("click", () => send("run"));
$("step").addEventListener("click", () => send("step"));
$("pause").addEventListener("click", () =>
  worker?.postMessage({ type: "pause" }),
);
$("reset").addEventListener("click", reset);
editor.addEventListener("input", codeChanged);
input.addEventListener("input", () => {
  if (snapshot || worker) reset();
  loaded = "";
});
editor.addEventListener("scroll", () => {
  $("line-numbers").scrollTop = editor.scrollTop;
});
$("compact").addEventListener("click", () =>
  replaceProgram(editor.value.replace(/[^><+\-.,\[\]]/g, ""), input.value),
);
$("download-code").addEventListener("click", () =>
  download("program.bf", editor.value),
);
$("download-output").addEventListener("click", () => {
  const bytes = Uint8Array.from(snapshot?.output || []);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/octet-stream" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "output.bin";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("import-code").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 20000) {
    announce("Fișierul depășește 20.000 de octeți.", true);
    event.target.value = "";
    return;
  }
  try {
    replaceProgram(await file.text());
    announce("Fișier importat. Codul nu a fost executat.");
  } catch {
    announce("Fișierul nu a putut fi citit.", true);
  }
  event.target.value = "";
});
$("share").addEventListener("click", share);
$("close-share").addEventListener("click", () => $("share-dialog").close());
$("output-mode").addEventListener("change", (event) => {
  outputMode = event.target.value;
  $("output").hidden = outputMode !== "text";
  $("hex-output").hidden = outputMode !== "hex";
});
$("add-breakpoint").addEventListener("click", () => {
  const raw = $("breakpoint").value,
    index = Number(raw);
  if (!raw || !Number.isInteger(index) || index < 0 || index >= 20000) {
    announce("Alege un index de instrucțiune între 0 și 19.999.", true);
    return;
  }
  if (breakpoints.has(index)) breakpoints.delete(index);
  else breakpoints.add(index);
  showBreakpoints();
});
$("clear-breakpoints").addEventListener("click", () => {
  breakpoints.clear();
  showBreakpoints();
});
$("save-draft").addEventListener("change", () => {
  if ($("save-draft").checked) {
    store("bf-lab-draft-enabled", "1");
    store("bf-lab-draft-v1", editor.value);
  } else {
    try {
      localStorage.removeItem("bf-lab-draft-enabled");
      localStorage.removeItem("bf-lab-draft-v1");
    } catch {
      /* unavailable storage */
    }
  }
});
$("clear-draft").addEventListener("click", () => {
  $("save-draft").checked = false;
  try {
    localStorage.removeItem("bf-lab-draft-enabled");
    localStorage.removeItem("bf-lab-draft-v1");
  } catch {
    /* unavailable storage */
  }
  announce("Draftul local a fost șters.");
});
$("challenge-select").addEventListener("change", selectChallenge);
$("load-challenge").addEventListener("click", () => {
  replaceProgram(currentChallenge.starter, currentChallenge.cases[0].input);
  announce("Provocarea este în editor. Scrie soluția și verifică.");
});
$("verify-challenge").addEventListener("click", checkChallenge);
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    send("run");
  }
  if (event.key === "F10" && document.activeElement === editor) {
    event.preventDefault();
    send("step");
  }
});
window.addEventListener("hashchange", decodeShare);
window.addEventListener("pagehide", () => {
  cancelExampleLoad();
  stopWorker();
  testWorker?.terminate();
});
if (!decodeShare() && readStored("bf-lab-draft-enabled") === "1") {
  const draft = readStored("bf-lab-draft-v1");
  if (draft !== null && draft.length <= LIMITS.code) {
    editor.value = draft;
    $("save-draft").checked = true;
    announce("Draft local restaurat. Inputul nu este salvat.");
  }
}
codeChanged();
updateProgress();
selectChallenge();
showBreakpoints();

if ($("back")) {
  $("back").addEventListener("click", () => {
    if (!running) worker?.postMessage({ type: "back" });
  });
  $("timeline").addEventListener("change", () => {
    if (!running)
      worker?.postMessage({ type: "seek", step: Number($("timeline").value) });
  });
}

const requestedProgram = new URLSearchParams(location.search).get("program");
if (requestedProgram && !location.hash.startsWith("#code=")) {
  const { library } = await import("./library-data.mjs");
  const program = library.find((p) => p.id === requestedProgram);
  if (program) await loadExample({ ...program, name: program.title });
  else announce("Programul cerut nu există în bibliotecă.", true);
}
