import { selfDemos } from "./self-data.mjs";
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
let outer = "",
  controller,
  revision = 0;
function select(demo) {
  controller?.abort();
  revision++;
  $("self-code").value = demo.code;
  $("self-input").value = demo.input;
  $("self-description").textContent = demo.description;
  message("self-status", "Program pregătit. Execuția nu a pornit.");
}
for (const demo of selfDemos) {
  const option = node("option", demo.name);
  option.value = demo.id;
  $("self-demo").append(option);
}
$("self-demo").addEventListener("change", () =>
  select(selfDemos.find((d) => d.id === $("self-demo").value)),
);
$("self-run").addEventListener("click", async () => {
  if (!outer) {
    message("self-status", "Așteaptă încărcarea sursei exterioare.", true);
    return;
  }
  controller?.abort();
  controller = new AbortController();
  const code = $("self-code").value,
    input = $("self-input").value,
    version = revision;
  $("self-run").disabled = true;
  $("self-stop").disabled = false;
  message("self-status", "Interpretorul scris în Brainfuck execută programul…");
  try {
    const data = await runJob(
      { type: "self", outer, code, input },
      { signal: controller.signal },
    );
    if (
      version !== revision ||
      code !== $("self-code").value ||
      input !== $("self-input").value
    ) {
      message("self-status", "Programul s-a schimbat. Rulează din nou.");
      return;
    }
    $("self-output").textContent = data.output.length
      ? new TextDecoder().decode(Uint8Array.from(data.output))
      : "∅ — output gol";
    $("self-hex").textContent = data.output.length
      ? data.output.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")
      : "∅";
    $("self-outer-steps").textContent = data.outerSteps.toLocaleString("ro-RO");
    if (!data.completed) {
      $("self-inner-steps").textContent = "—";
      $("self-ratio").textContent = "—";
      $("self-memory").replaceChildren();
      $("self-pointer").textContent =
        "Starea virtuală finală nu este disponibilă.";
      message(
        "self-status",
        "Execuție BF incompletă: " +
          data.error +
          " Outputul afișat este parțial.",
        true,
      );
      return;
    }
    $("self-inner-steps").textContent = data.innerSteps.toLocaleString("ro-RO");
    $("self-ratio").textContent = data.innerSteps
      ? Math.round(data.outerSteps / data.innerSteps).toLocaleString("ro-RO") +
        "×"
      : "—";
    $("self-memory").replaceChildren(
      ...data.memory.map((value, i) => node("span", `[${i}] ${value}`)),
    );
    $("self-pointer").textContent = `Pointer virtual: ${data.pointer}.`;
    message(
      "self-status",
      data.equal
        ? "Interpretorul BF a terminat. Outputul, memoria și pointerul coincid cu referința cu 16 celule."
        : "Interpretorul BF a produs o stare diferită de referință.",
      !data.equal,
    );
  } catch (error) {
    message("self-status", error.message, true);
  } finally {
    $("self-run").disabled = false;
    $("self-stop").disabled = true;
  }
});
$("self-stop").addEventListener("click", () => controller?.abort());
$("self-download").addEventListener("click", () => {
  if (outer) download("self-interpreter.bf", outer);
});
$("self-inner-download").addEventListener("click", () =>
  download("inner.bf", $("self-code").value),
);
$("self-share").addEventListener("click", async () => {
  try {
    const url = codeUrl($("self-code").value, "/self");
    $("self-share-url").value = url;
    $("self-share-panel").hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      message("self-status", "Link copiat, fără input.");
    } catch {
      $("self-share-url").select();
      message("self-status", "Copiază linkul afișat.");
    }
  } catch (error) {
    message("self-status", error.message, true);
  }
});
function loadShare() {
  try {
    const code = sharedCode();
    if (code !== null) {
      controller?.abort();
      revision++;
      $("self-code").value = code;
      $("self-input").value = "";
      message(
        "self-status",
        "Program partajat încărcat, fără execuție automată.",
      );
    }
  } catch (error) {
    message("self-status", error.message, true);
  }
}
window.addEventListener("hashchange", loadShare);
window.addEventListener("pagehide", () => controller?.abort());
select(selfDemos[0]);
loadShare();
try {
  outer = await source("self-interpreter.bf");
  $("self-source").textContent = outer;
  $("self-source-info").textContent =
    `${(outer.match(/[><+\-.,\[\]]/g) || []).length.toLocaleString("ro-RO")} instrucțiuni BF. Parserul, memoria și potrivirea buclelor sunt în această sursă.`;
} catch (error) {
  message("self-status", error.message, true);
}
