/** Advanced UI accepts snapshots only; all execution stays in the BF Worker. */
const $ = (id) => document.getElementById(id);
export function resetDebug() {
  if (!$("back")) return;
  $("back").disabled = true;
  $("timeline").disabled = true;
  $("timeline").min = 0;
  $("timeline").max = 0;
  $("timeline").value = 0;
  $("history-label").textContent = "0 / 0";
  $("step-explanation").textContent =
    "Fă un pas pentru a vedea ce s-a schimbat.";
  for (const id of [
    "profile-instructions",
    "profile-loops",
    "profile-cells",
    "profile-operations",
  ])
    $(id).replaceChildren();
  $("profile-summary").textContent =
    "Rulează un program pentru a-i vedea profilul.";
}
export function renderDebug(data, running) {
  if (!$("back")) return;
  $("back").disabled = running || !data.historyCount;
  $("timeline").disabled = running || !data.furthestStep;
  $("timeline").min = data.historyFloor || 0;
  $("timeline").max = data.furthestStep || 0;
  $("timeline").value = data.steps || 0;
  $("history-label").textContent =
    `${data.steps} / ${data.furthestStep} · disponibil de la ${data.historyFloor}`;
  const c = data.change;
  if (c) {
    const descriptions = {
      ">": `Pointer ${c.ptr} → ${c.nextPtr}.`,
      "<": `Pointer ${c.ptr} → ${c.nextPtr}.`,
      "+": `Celula ${c.ptr}: ${c.value} → ${c.nextValue}.`,
      "-": `Celula ${c.ptr}: ${c.value} → ${c.nextValue}.`,
      ",": `Input în celula ${c.ptr}: ${c.value} → ${c.nextValue}.`,
      ".": `Output: octetul ${c.value}.`,
      "[": "Testează celula și intră în buclă sau sare după paranteza pereche.",
      "]": "Repetă bucla dacă celula nu este zero.",
    };
    $("step-explanation").textContent = c.undo
      ? `Revenire înainte de instrucțiunea ${c.pc} (${c.op}). Inputul, outputul și memoria au fost restaurate.`
      : `Instrucțiunea ${c.pc} (${c.op}). ${descriptions[c.op]}`;
  }
  if (!data.profile) return;
  const p = data.profile;
  $("profile-summary").textContent =
    `${p.distinctCells} celule distincte · ${data.steps.toLocaleString("ro-RO")} pași. Bugetul măsoară instrucțiuni BF, nu viteza dispozitivului.`;
  function rows(id, items, format) {
    const list = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement("li");
      row.textContent = format(item);
      list.append(row);
    }
    $(id).replaceChildren(list);
  }
  rows(
    "profile-instructions",
    p.instructions,
    (row) => `#${row.index} ${row.op} — ${row.count} execuții`,
  );
  rows(
    "profile-loops",
    p.loops,
    (row) => `[${row.start} … ${row.end}] — ${row.steps} pași în interval`,
  );
  rows(
    "profile-operations",
    Object.entries(p.operations),
    ([op, count]) => `${op} — ${count}`,
  );
  const fragment = document.createDocumentFragment(),
    max = Math.max(1, ...p.cells.map((c) => c.count));
  for (const cell of p.cells) {
    const item = document.createElement("div");
    item.className = `heat-cell heat-${Math.max(1, Math.ceil((cell.count / max) * 5))}`;
    const label = document.createElement("strong"),
      count = document.createElement("span");
    label.textContent = `[${cell.index}] = ${cell.value}`;
    count.textContent = `${cell.count} vizite`;
    item.append(label, count);
    fragment.append(item);
  }
  $("profile-cells").replaceChildren(fragment);
}
