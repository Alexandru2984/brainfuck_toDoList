import { library } from "./library-data.mjs";
import {
  $,
  node,
  message,
  source,
  runJob,
  download,
  showCases,
} from "./studio-common.mjs";
let current,
  code = "",
  revision = 0,
  controller;
function cards() {
  const query = $("library-search").value.trim().toLocaleLowerCase("ro"),
    category = $("library-category").value;
  const selected = library.filter(
    (p) =>
      (category === "Toate" || p.category === category) &&
      `${p.title} ${p.description}`.toLocaleLowerCase("ro").includes(query),
  );
  $("library-count").textContent =
    `${selected.length} / ${library.length} programe Brainfuck`;
  $("library-cards").replaceChildren(
    ...selected.map((p) => {
      const card = node("article", undefined, "library-card");
      const button = node("button", "Explorează →", "ghost-button");
      button.type = "button";
      button.dataset.program = p.id;
      button.addEventListener("click", () => select(p, true));
      card.append(
        node("p", p.category, "eyebrow"),
        node("h2", p.title),
        node("p", p.description),
        button,
      );
      return card;
    }),
  );
}
async function select(program, scroll = false) {
  controller?.abort();
  current = program;
  code = "";
  const version = ++revision;
  $("library-title").textContent = program.title;
  $("library-domain").textContent = program.domain;
  $("library-explanation").replaceChildren(
    ...program.explanation.map((text) => node("p", text)),
  );
  $("library-memory").replaceChildren(
    ...program.memory.map((text) => node("span", text)),
  );
  $("library-input").value = program.input;
  $("library-results").replaceChildren();
  $("library-output").textContent = "Outputul va apărea aici.";
  message("library-status", "Încarc sursa…");
  $("library-lab").href = "/lab?program=" + program.id;
  $("library-terminal-panel").hidden = program.category !== "Terminal";
  $("library-terminal").href = "/terminal?program=" + program.id;
  const url = new URL(location.href);
  url.searchParams.set("program", program.id);
  history.replaceState(null, "", url.pathname + url.search);
  try {
    const value = await source(program.file);
    if (version !== revision) return;
    code = value;
    $("library-source").textContent = code;
    message(
      "library-status",
      `${(code.match(/[><+\-.,\[\]]/g) || []).length} instrucțiuni BF. Pregătit.`,
    );
    if (scroll)
      $("library-detail").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  } catch (error) {
    if (version === revision) message("library-status", error.message, true);
  }
}
async function execute(testing) {
  if (!code) return;
  const version = revision;
  controller?.abort();
  controller = new AbortController();
  $("library-run").disabled = true;
  $("library-test").disabled = true;
  $("library-stop").disabled = false;
  message("library-status", testing ? "Verific exemplele…" : "Rulează…");
  try {
    const result = await runJob(
      testing
        ? { type: "evaluate", code, cases: current.cases }
        : { type: "run", code, input: $("library-input").value },
      { signal: controller.signal },
    );
    if (version !== revision) return;
    if (testing) {
      showCases($("library-results"), result.results);
      message(
        "library-status",
        result.pass ? "Toate exemplele au trecut." : "Un exemplu nu a trecut.",
        !result.pass,
      );
    } else {
      $("library-output").textContent = result.output.length
        ? new TextDecoder().decode(Uint8Array.from(result.output))
        : "∅ — output gol";
      message(
        "library-status",
        `${result.steps.toLocaleString("ro-RO")} pași · ${result.cells} celule distincte · ${result.output.length} octeți.`,
      );
    }
  } catch (error) {
    if (version === revision) message("library-status", error.message, true);
  } finally {
    $("library-run").disabled = false;
    $("library-test").disabled = false;
    $("library-stop").disabled = true;
  }
}
$("library-search").addEventListener("input", cards);
$("library-category").addEventListener("change", cards);
$("library-run").addEventListener("click", () => execute(false));
$("library-test").addEventListener("click", () => execute(true));
$("library-stop").addEventListener("click", () => controller?.abort());
$("library-download").addEventListener("click", () => {
  if (code) download(current.file, code);
});
window.addEventListener("pagehide", () => controller?.abort());
cards();
select(
  library.find(
    (p) => p.id === new URLSearchParams(location.search).get("program"),
  ) || library[0],
);
