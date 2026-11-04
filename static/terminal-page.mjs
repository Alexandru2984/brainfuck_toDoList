import {
  $,
  node,
  message,
  codeUrl,
  sharedCode,
  download,
} from "./studio-common.mjs";
import { terminalPrograms } from "./terminal-data.mjs";

const editor = $("terminal-code"),
  input = $("terminal-input");
let worker = null,
  fetchController = null,
  revision = 0,
  state = "idle",
  snapshot = null;
let watchdog = null,
  pending = null,
  nextId = 0,
  original = null;
const labels = {
  idle: "Pregătit",
  running: "Rulează",
  waiting: "Așteaptă input",
  paused: "Pauză",
  done: "Încheiat",
  error: "Oprit cu eroare",
  stopped: "Oprit",
  sending: "Se trimite…",
};
const active = () =>
  ["running", "waiting", "paused", "sending"].includes(state);
function controls() {
  $("terminal-state").textContent = fetchController
    ? "Se încarcă…"
    : labels[state];
  $("terminal-start").disabled =
    Boolean(fetchController) || active() || !editor.value;
  $("terminal-pause").disabled = state !== "running";
  $("terminal-resume").disabled = state !== "paused";
  $("terminal-stop").disabled = !active();
  const canSend = state === "waiting" && !pending && !snapshot?.inputEnded;
  $("terminal-send").disabled = !canSend;
  input.disabled = !canSend;
  $("terminal-eof").disabled =
    !active() || !worker || Boolean(pending) || snapshot?.inputEnded;
  $("terminal-output-download").disabled =
    !snapshot?.outputBytes ||
    (!worker && snapshot.outputBytes > snapshot.output.length);
}
function terminate() {
  worker?.terminate();
  worker = null;
  pending = null;
  clearTimeout(watchdog);
  watchdog = null;
}
function cancelSource() {
  fetchController?.abort();
  fetchController = null;
  revision++;
}
function clearExecution() {
  terminate();
  snapshot = null;
  state = "idle";
  input.value = "";
  $("terminal-output").textContent = "Outputul programului va apărea aici.";
  $("terminal-truncated").hidden = true;
  $("terminal-memory").replaceChildren();
  $("terminal-sent").replaceChildren();
  for (const id of [
    "terminal-steps",
    "terminal-output-bytes",
    "terminal-pointer",
  ])
    $(id).textContent = "0";
  $("terminal-input-bytes").textContent = "0 / 0";
  $("terminal-share-panel").hidden = true;
  controls();
}
function armWatchdog() {
  if (watchdog) return;
  watchdog = setTimeout(() => {
    terminate();
    state = "error";
    controls();
    message(
      "terminal-status",
      "Workerul a depășit timpul de răspuns și a fost oprit. Pornește din nou cu un program mai scurt.",
      true,
    );
  }, 12000);
}
function output() {
  if (!snapshot) return;
  const bytes = Uint8Array.from(snapshot.output || []);
  $("terminal-output").textContent = bytes.length
    ? $("terminal-view").value === "hex"
      ? [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ")
      : new TextDecoder().decode(bytes)
    : "∅ — niciun octet afișat";
  $("terminal-truncated").hidden = snapshot.outputBytes <= bytes.length;
}
function render(data) {
  if (!data.cells) return;
  snapshot = data;
  output();
  $("terminal-steps").textContent = data.steps.toLocaleString("ro-RO");
  $("terminal-input-bytes").textContent =
    `${data.inputPtr} / ${data.inputBytes}`;
  $("terminal-output-bytes").textContent =
    data.outputBytes.toLocaleString("ro-RO");
  $("terminal-pointer").textContent = data.ptr;
  $("terminal-memory").replaceChildren(
    ...data.cells.map((value, i) => {
      const cell = node(
        "span",
        String(data.start + i),
        data.start + i === data.ptr ? "current" : "",
      );
      cell.append(node("strong", String(value).padStart(3, "0")));
      return cell;
    }),
  );
}
function start() {
  if (fetchController || active()) return;
  clearExecution();
  const current = new Worker(
    new URL("./terminal-worker.mjs", import.meta.url),
    { type: "module" },
  );
  worker = current;
  state = "running";
  controls();
  armWatchdog();
  message("terminal-status", "Programul BF pornește…");
  $("terminal-status").scrollIntoView({ block: "center", behavior: "instant" });
  current.onmessage = ({ data }) => {
    if (worker !== current) return;
    if (data.type === "download") {
      download(
        "output.bin",
        new Uint8Array(data.output),
        "application/octet-stream",
      );
      return;
    }
    if (pending && data.ack === pending.id) {
      if (!data.notice) {
        const text = pending.end
          ? "EOF — input închis"
          : JSON.stringify(pending.text);
        $("terminal-sent").append(node("li", text));
        while ($("terminal-sent").children.length > 16)
          $("terminal-sent").firstElementChild.remove();
        input.value = "";
      }
      pending = null;
    }
    const previous = state;
    state = data.state;
    render(data);
    if (state === "running") armWatchdog();
    else {
      clearTimeout(watchdog);
      watchdog = null;
    }
    controls();
    if (state === "waiting" && previous !== "waiting")
      input.focus({ preventScroll: true });
    const messages = {
      waiting:
        "Programul BF așteaptă input la instrucțiunea «,». Trimite un răspuns sau EOF.",
      running: "Programul BF rulează…",
      paused: "Pauză. Continuă când ești gata.",
      done: "Execuție încheiată. Poți descărca outputul sau porni o sesiune nouă.",
      error: data.error || "Execuția a fost oprită.",
    };
    message(
      "terminal-status",
      data.notice || messages[state],
      Boolean(data.notice) || state === "error",
    );
  };
  current.onerror = () => {
    terminate();
    state = "error";
    controls();
    message(
      "terminal-status",
      "Workerul nu a putut executa programul. Reîncearcă într-un browser modern.",
      true,
    );
  };
  current.postMessage({ type: "load", code: editor.value });
}
function feed(end = false) {
  if (
    !worker ||
    pending ||
    snapshot?.inputEnded ||
    (!end && state !== "waiting")
  )
    return;
  const text = end
    ? ""
    : input.value + ($("terminal-line").checked ? "\n" : "");
  if (!end && !text) {
    message("terminal-status", "Scrie un răspuns sau folosește EOF.", true);
    return;
  }
  const size = new TextEncoder().encode(text).length;
  if ((snapshot?.inputBytes || 0) + size > 4096) {
    message(
      "terminal-status",
      "Inputul cumulativ depășește limita de 4.096 de octeți. Poți închide fluxul cu EOF.",
      true,
    );
    return;
  }
  pending = { id: ++nextId, text, end };
  controls();
  armWatchdog();
  worker.postMessage({ type: "feed", ...pending });
}
function describe(program) {
  $("terminal-description").textContent = program.description;
  $("terminal-domain").textContent = program.domain;
  $("terminal-line").checked = program.lineMode;
  $("terminal-map").replaceChildren(
    ...program.memory.map((text) => node("span", text)),
  );
  $("terminal-explanation").replaceChildren(
    ...program.explanation.map((text) => node("p", text)),
  );
}
function describeCustom() {
  original = null;
  $("terminal-example").value = "custom";
  $("terminal-description").textContent =
    "Program personalizat. Prompturile și regulile depind de sursa BF.";
  $("terminal-domain").textContent =
    "Input UTF-8, LF opțional la trimitere și EOF explicit. Inspectează codul înainte de pornire.";
  $("terminal-map").replaceChildren();
  $("terminal-explanation").replaceChildren(
    node(
      "p",
      "Poți deschide sursa în debugger pentru a urmări fiecare instrucțiune.",
    ),
  );
}
async function select(program) {
  cancelSource();
  clearExecution();
  original = null;
  describe(program);
  const controller = new AbortController(),
    version = revision;
  fetchController = controller;
  controls();
  message("terminal-status", "Se încarcă sursa BF…");
  try {
    const response = await fetch("/static/programs/" + program.file, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Sursa BF nu a putut fi încărcată.");
    const code = await response.text();
    if (version !== revision || fetchController !== controller) return;
    if (code.length > 20000)
      throw new Error("Programul depășește limita de cod.");
    editor.value = code;
    original = { program, code };
    fetchController = null;
    controls();
    message("terminal-status", "Program BF încărcat. Apasă Pornește.");
  } catch (error) {
    if (version !== revision || fetchController !== controller) return;
    fetchController = null;
    describeCustom();
    controls();
    message("terminal-status", error.message, true);
  }
}
for (const program of terminalPrograms) {
  const option = node("option", program.title);
  option.value = program.id;
  $("terminal-example").append(option);
}
const customOption = node("option", "Cod personalizat");
customOption.value = "custom";
customOption.disabled = true;
$("terminal-example").append(customOption);
$("terminal-example").addEventListener("change", () =>
  select(terminalPrograms.find((p) => p.id === $("terminal-example").value)),
);
editor.addEventListener("input", () => {
  cancelSource();
  clearExecution();
  describeCustom();
  message(
    "terminal-status",
    "Cod editat. Apasă Pornește pentru o sesiune nouă.",
  );
});
$("terminal-start").addEventListener("click", start);
$("terminal-pause").addEventListener("click", () =>
  worker?.postMessage({ type: "pause" }),
);
$("terminal-resume").addEventListener("click", () => {
  armWatchdog();
  worker?.postMessage({ type: "resume" });
});
$("terminal-stop").addEventListener("click", () => {
  terminate();
  state = "stopped";
  controls();
  message(
    "terminal-status",
    "Sesiune oprită. Outputul vizibil rămâne aici; Pornește creează o sesiune nouă.",
  );
});
$("terminal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  feed();
});
input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    feed();
  }
});
$("terminal-eof").addEventListener("click", () => feed(true));
$("terminal-view").addEventListener("change", output);
$("terminal-download").addEventListener("click", () =>
  download("program.bf", editor.value),
);
$("terminal-output-download").addEventListener("click", () => {
  if (worker) worker.postMessage({ type: "download" });
  else if (snapshot)
    download(
      "output.bin",
      new Uint8Array(snapshot.output),
      "application/octet-stream",
    );
});
$("terminal-share").addEventListener("click", () => {
  try {
    const url =
      original?.code === editor.value
        ? new URL("/terminal?program=" + original.program.id, location.origin)
            .href
        : codeUrl(editor.value, "/terminal");
    $("terminal-share-url").value = url;
    $("terminal-share-panel").hidden = false;
    $("terminal-share-url").select();
    message(
      "terminal-status",
      "Link pregătit. Include doar programul, fără input și fără autorun.",
    );
  } catch (error) {
    message("terminal-status", error.message, true);
  }
});
$("terminal-lab").addEventListener("click", (event) => {
  try {
    event.currentTarget.href =
      original?.code === editor.value
        ? "/lab?program=" + original.program.id
        : codeUrl(editor.value);
  } catch (error) {
    event.preventDefault();
    message("terminal-status", error.message, true);
  }
});
$("terminal-import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 20000) {
    message("terminal-status", "Fișierul depășește 20.000 de octeți.", true);
    event.target.value = "";
    return;
  }
  cancelSource();
  clearExecution();
  const version = revision;
  const controller = new AbortController();
  fetchController = controller;
  controls();
  message("terminal-status", "Se citește fișierul BF…");
  try {
    const code = await file.text();
    if (version !== revision || fetchController !== controller) return;
    editor.value = code;
    describeCustom();
    message("terminal-status", "Fișier importat. Apasă Pornește.");
  } catch {
    if (version === revision)
      message("terminal-status", "Fișierul nu a putut fi citit.", true);
  } finally {
    if (fetchController === controller) {
      fetchController = null;
      controls();
    }
    event.target.value = "";
  }
});
window.addEventListener("pagehide", () => {
  const interrupted = active() || Boolean(fetchController);
  if (fetchController) describeCustom();
  cancelSource();
  terminate();
  if (interrupted) {
    state = "stopped";
    controls();
    message(
      "terminal-status",
      editor.value
        ? "Sesiune închisă la părăsirea paginii. Apasă Pornește pentru o sesiune nouă."
        : "Încărcarea a fost oprită. Selectează din nou un program.",
    );
  }
});
function loadShare() {
  if (!location.hash.startsWith("#code=")) return false;
  cancelSource();
  clearExecution();
  describeCustom();
  try {
    editor.value = sharedCode();
    message(
      "terminal-status",
      "Cod partajat încărcat. Inspectează-l și apasă Pornește.",
    );
  } catch (error) {
    state = "error";
    controls();
    message("terminal-status", error.message, true);
  }
  return true;
}
window.addEventListener("hashchange", loadShare);
function initialize() {
  const requested = new URLSearchParams(location.search).get("program");
  const program =
    terminalPrograms.find((p) => p.id === requested) || terminalPrograms[0];
  $("terminal-example").value = program.id;
  describe(program);
  if (!loadShare()) select(program);
}
initialize();
