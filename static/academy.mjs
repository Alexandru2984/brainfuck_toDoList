import { lessons } from "./curriculum.mjs";
import {
  $,
  node,
  message,
  read,
  save,
  runJob,
  source,
  download,
  codeUrl,
} from "./studio-common.mjs";
const key = "bf-academy-v1";
const stored = read(key, []);
let completed = new Set(
  Array.isArray(stored)
    ? stored.filter((id) => lessons.some((l) => l.id === id))
    : [],
);
let current,
  solution = "",
  revision = 0,
  controller;
function progress() {
  $("lesson-progress").textContent =
    `${completed.size} / ${lessons.length} lecții rezolvate`;
  for (const button of $("lesson-nav").children) {
    const lesson = lessons.find((l) => l.id === button.dataset.lesson);
    button.textContent = lesson.title + (completed.has(lesson.id) ? " ✓" : "");
    button.setAttribute("aria-current", String(current?.id === lesson.id));
  }
}
async function select(lesson) {
  controller?.abort();
  const id = ++revision;
  current = lesson;
  solution = "";
  $("lesson-title").textContent = lesson.title;
  $("lesson-copy").replaceChildren(
    node("p", lesson.intro),
    node("p", lesson.explanation),
  );
  $("lesson-code").value = lesson.starter;
  $("lesson-hint").textContent = lesson.hint;
  $("lesson-results").replaceChildren();
  $("lesson-status").textContent = "";
  $("prediction-status").textContent = "";
  $("prediction-answer").value = "";
  $("prediction-code").textContent = lesson.prediction.code;
  $("prediction-question").textContent =
    `După acest program, ce valoare are celula ${lesson.prediction.cell}? Inputul este gol.`;
  $("lesson-next").disabled = lessons.indexOf(lesson) === lessons.length - 1;
  for (const details of document.querySelectorAll(".studio-panel details"))
    details.open = false;
  const url = new URL(location.href);
  url.searchParams.set("lesson", lesson.id);
  history.replaceState(null, "", url.pathname + url.search);
  progress();
  try {
    const result = lesson.solution ?? (await source(lesson.file));
    if (revision !== id) return;
    solution = result;
    $("lesson-solution").textContent = result;
  } catch (error) {
    if (id === revision) message("lesson-status", error.message, true);
  }
}
for (const lesson of lessons) {
  const button = node("button", lesson.title);
  button.type = "button";
  button.dataset.lesson = lesson.id;
  button.addEventListener("click", () => select(lesson));
  $("lesson-nav").append(button);
}
$("lesson-check").addEventListener("click", async () => {
  const lesson = current,
    code = $("lesson-code").value,
    version = revision;
  controller?.abort();
  controller = new AbortController();
  const button = $("lesson-check");
  button.disabled = true;
  message("lesson-status", "Verific programul pe toate cazurile…");
  try {
    const data = await runJob(
      { type: "evaluate", code, cases: lesson.cases },
      { signal: controller.signal },
    );
    if (version !== revision || code !== $("lesson-code").value) return;
    const { showCases } = await import("./studio-common.mjs");
    showCases($("lesson-results"), data.results);
    if (data.pass) {
      completed.add(lesson.id);
      save(key, [...completed]);
      progress();
      message("lesson-status", "Exercițiu rezolvat. Toate cazurile au trecut.");
    } else
      message(
        "lesson-status",
        "Mai există cazuri care nu trec. Încearcă indiciul sau debuggerul.",
        true,
      );
  } catch (error) {
    if (version === revision) message("lesson-status", error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("prediction-check").addEventListener("click", async () => {
  const raw = $("prediction-answer").value,
    answer = Number(raw),
    lesson = current,
    version = revision;
  if (raw === "" || !Number.isInteger(answer) || answer < 0 || answer > 255) {
    message("prediction-status", "Alege un întreg între 0 și 255.", true);
    return;
  }
  try {
    const data = await runJob({
      type: "inspect",
      code: lesson.prediction.code,
      input: "",
    });
    if (version !== revision) return;
    const actual = data.memory[lesson.prediction.cell];
    message(
      "prediction-status",
      answer === actual
        ? `Corect! Celula ${lesson.prediction.cell} conține ${actual}.`
        : `Celula ${lesson.prediction.cell} conține ${actual}. Urmărește programul pas cu pas în debugger.`,
      answer !== actual,
    );
  } catch (error) {
    message("prediction-status", error.message, true);
  }
});
$("lesson-reset").addEventListener("click", () => {
  $("lesson-code").value = current.starter;
  $("lesson-results").replaceChildren();
  message("lesson-status", "Exercițiul a fost resetat.");
});
$("lesson-solution-load").addEventListener("click", () => {
  $("lesson-code").value = solution;
  message(
    "lesson-status",
    "Soluție de referință încărcată. Urmărește-o și în debugger.",
  );
});
$("lesson-download").addEventListener("click", () =>
  download(current.id + ".bf", solution),
);
$("lesson-lab").addEventListener("click", (event) => {
  try {
    event.currentTarget.href = codeUrl($("lesson-code").value);
  } catch (error) {
    event.preventDefault();
    message("lesson-status", error.message, true);
  }
});
$("lesson-next").addEventListener("click", () => {
  const next = lessons[lessons.indexOf(current) + 1];
  if (next) select(next);
});
$("lesson-clear-progress").addEventListener("click", () => {
  completed.clear();
  save(key, []);
  progress();
  message("lesson-status", "Progresul local a fost resetat.");
});
window.addEventListener("pagehide", () => controller?.abort());
select(
  lessons.find(
    (l) => l.id === new URLSearchParams(location.search).get("lesson"),
  ) || lessons[0],
);
