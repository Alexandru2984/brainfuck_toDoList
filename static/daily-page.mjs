import {
  dailyPuzzle,
  scoreSubmission,
  improveRecord,
  utcDay,
} from "./daily.mjs";
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
  sharedCode,
  showCases,
} from "./studio-common.mjs";
const today = () => new Date().toISOString().slice(0, 10),
  key = "bf-daily-records-v1";
let puzzle,
  reference = "",
  controller,
  revision = 0;
const stored = read(key, {});
let records = {};
if (stored && typeof stored === "object" && !Array.isArray(stored))
  for (const [date, record] of Object.entries(stored).sort().slice(-365))
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) records[date] = record;
function renderRecords() {
  const record = records[puzzle.date];
  for (const metric of ["length", "steps", "cells"])
    $("record-" + metric).textContent =
      record &&
      Number.isInteger(record[metric]) &&
      record[metric] >= 0 &&
      record[metric] <= 4000000
        ? record[metric].toLocaleString("ro-RO")
        : "—";
}
async function select(date, fromShare = false) {
  try {
    utcDay(date);
    if (date < "2000-01-01" || date > today())
      throw new Error("Alege o zi între 2000-01-01 și astăzi (UTC).");
  } catch (error) {
    message("daily-status", error.message, true);
    return;
  }
  controller?.abort();
  const version = ++revision;
  puzzle = dailyPuzzle(date);
  reference = "";
  $("daily-date").value = date;
  $("daily-title").textContent = puzzle.title;
  $("daily-prompt").textContent = puzzle.prompt;
  $("daily-hint").textContent = puzzle.hint;
  $("daily-code").value = puzzle.starter;
  $("daily-results").replaceChildren();
  $("daily-status").textContent = "";
  $("daily-share-panel").hidden = true;
  $("daily-cases").replaceChildren(
    ...puzzle.cases.map((c) =>
      node(
        "p",
        `${JSON.stringify(c.input)} → ${JSON.stringify(c.expected)}`,
        "studio-note",
      ),
    ),
  );
  const url = new URL(location.href);
  url.searchParams.set("date", date);
  if (!fromShare) url.hash = "";
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  renderRecords();
  try {
    const code = puzzle.reference ?? (await source(puzzle.file));
    if (version !== revision) return;
    reference = code;
    $("daily-reference").textContent = code;
    if (fromShare) {
      const shared = sharedCode();
      if (shared !== null) {
        $("daily-code").value = shared;
        message(
          "daily-status",
          "Soluție partajată încărcată. Apasă Verifică pentru a o executa.",
        );
      }
    }
  } catch (error) {
    if (version === revision) message("daily-status", error.message, true);
  }
}
$("daily-date").max = today();
$("daily-date").addEventListener("change", () => select($("daily-date").value));
$("daily-check").addEventListener("click", async () => {
  const version = revision,
    code = $("daily-code").value;
  controller?.abort();
  controller = new AbortController();
  $("daily-check").disabled = true;
  $("daily-stop").disabled = false;
  message("daily-status", "Execut cazurile în Worker…");
  try {
    const data = await runJob(
      { type: "evaluate", code, cases: puzzle.cases },
      { signal: controller.signal },
    );
    if (version !== revision || code !== $("daily-code").value) return;
    showCases($("daily-results"), data.results);
    if (data.pass) {
      const score = scoreSubmission(code, data.results);
      records[puzzle.date] = improveRecord(records[puzzle.date], score);
      records = Object.fromEntries(Object.entries(records).sort().slice(-365));
      const saved = save(key, records);
      renderRecords();
      message(
        "daily-status",
        `Toate cazurile au trecut: ${score.length} instrucțiuni, ${score.steps} pași, ${score.cells} celule.${saved ? " Recordurile sunt actualizate." : " Stocarea locală nu este disponibilă."}`,
      );
    } else
      message(
        "daily-status",
        "Soluția nu trece toate cazurile; recordurile nu au fost schimbate.",
        true,
      );
  } catch (error) {
    if (version === revision) message("daily-status", error.message, true);
  } finally {
    $("daily-check").disabled = false;
    $("daily-stop").disabled = true;
  }
});
$("daily-stop").addEventListener("click", () => controller?.abort());
$("daily-reference-load").addEventListener("click", () => {
  $("daily-code").value = reference;
  message(
    "daily-status",
    "Soluție de referință încărcată; nu a fost executată.",
  );
});
$("daily-download").addEventListener("click", () =>
  download("daily-" + puzzle.date + ".bf", $("daily-code").value),
);
$("daily-lab").addEventListener("click", (event) => {
  try {
    event.currentTarget.href = codeUrl($("daily-code").value);
  } catch (error) {
    event.preventDefault();
    message("daily-status", error.message, true);
  }
});
$("daily-share").addEventListener("click", async () => {
  try {
    const url = codeUrl(
      $("daily-code").value,
      "/challenges?date=" + puzzle.date,
    );
    $("daily-share-url").value = url;
    $("daily-share-panel").hidden = false;
    $("daily-share-url").select();
    try {
      await navigator.clipboard.writeText(url);
      message("daily-status", "Link copiat. Include numai codul.");
    } catch {
      message("daily-status", "Copiază linkul afișat.");
    }
  } catch (error) {
    message("daily-status", error.message, true);
  }
});
$("daily-clear").addEventListener("click", () => {
  delete records[puzzle.date];
  save(key, records);
  renderRecords();
  message("daily-status", "Recordul zilei a fost șters.");
});
function countdown() {
  const seconds = Math.max(
    0,
    Math.floor(
      (Date.parse(today() + "T00:00:00Z") + 86400000 - Date.now()) / 1000,
    ),
  );
  $("daily-countdown").textContent =
    `Ziua se schimbă la 00:00 UTC · ${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m până la următorul puzzle`;
  $("daily-date").max = today();
}
const clock = setInterval(countdown, 30000);
countdown();
window.addEventListener("pagehide", () => {
  controller?.abort();
  clearInterval(clock);
});
async function loadFromUrl() {
  let date = new URLSearchParams(location.search).get("date") || today(),
    invalid = false;
  try {
    utcDay(date);
    if (date < "2000-01-01" || date > today()) throw new Error();
  } catch {
    date = today();
    invalid = true;
  }
  await select(date, true);
  if (invalid)
    message(
      "daily-status",
      "Data linkului este invalidă; este afișată provocarea de astăzi.",
      true,
    );
}
loadFromUrl();
window.addEventListener("hashchange", loadFromUrl);
