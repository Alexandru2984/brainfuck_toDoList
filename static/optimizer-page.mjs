import { optimizeBrainfuck, parseComparisonInputs } from "./optimizer.mjs";
import {
  $,
  node,
  message,
  runJob,
  download,
  codeUrl,
} from "./studio-common.mjs";
let controller;
$("opt-transform").addEventListener("click", () => {
  try {
    const result = optimizeBrainfuck($("opt-left").value);
    $("opt-right").value = result.optimized;
    $("opt-summary").textContent =
      `${result.before} → ${result.after} instrucțiuni BF · ${result.before - result.after} eliminate.`;
    $("opt-changes").replaceChildren(
      ...result.changes.map((change) =>
        node(
          "li",
          `${change.rule} (${change.count}×): ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`,
        ),
      ),
    );
    if (!result.changes.length)
      $("opt-changes").append(
        node("li", "Nu există transformări aplicabile în setul conservator."),
      );
    message(
      "opt-status",
      "Codul B este pregătit. Compară programele pentru a măsura efectul.",
    );
  } catch (error) {
    message("opt-status", error.message, true);
  }
});
$("opt-compare").addEventListener("click", async () => {
  let inputs;
  try {
    inputs = parseComparisonInputs($("opt-inputs").value);
  } catch (error) {
    message("opt-status", error.message, true);
    return;
  }
  controller?.abort();
  controller = new AbortController();
  const left = $("opt-left").value,
    right = $("opt-right").value,
    inputText = $("opt-inputs").value;
  $("opt-compare").disabled = true;
  $("opt-stop").disabled = false;
  message("opt-status", "Compar programele în Worker…");
  try {
    const data = await runJob(
      { type: "compare", left, right, inputs },
      { signal: controller.signal },
    );
    if (
      left !== $("opt-left").value ||
      right !== $("opt-right").value ||
      inputText !== $("opt-inputs").value
    ) {
      message(
        "opt-status",
        "Codul sau inputurile s-au schimbat. Compară din nou.",
      );
      return;
    }
    $("opt-results").replaceChildren(
      ...data.rows.map((row) => {
        const tr = node("tr");
        tr.append(
          node("td", JSON.stringify(row.input)),
          node(
            "td",
            row.equal === null
              ? "Neconcludent: " + row.error
              : row.equal
                ? "Aceeași stare"
                : "Diferă: " +
                  [
                    ["output", row.output],
                    ["memorie", row.memory],
                    ["pointer", row.pointer],
                    ["input", row.consumed],
                  ]
                    .filter(([, same]) => !same)
                    .map(([name]) => name)
                    .join(", "),
          ),
          node("td", row.left ? `${row.left.steps} → ${row.right.steps}` : "—"),
          node("td", row.left ? `${row.left.cells} → ${row.right.cells}` : "—"),
        );
        return tr;
      }),
    );
    const uncertain = data.rows.some((row) => row.equal === null),
      different = data.rows.some((row) => row.equal === false);
    message(
      "opt-status",
      different
        ? "Programele au rezultate diferite pe cel puțin un caz."
        : uncertain
          ? "Comparație neconcludentă: cel puțin un caz a atins o limită sau este invalid."
          : "Aceeași stare finală pe toate cazurile testate.",
      different || uncertain,
    );
    const valid = data.rows.find((row) => row.left);
    $("opt-profile").replaceChildren();
    if (valid)
      for (const [label, profile] of [
        ["A", valid.profileA],
        ["B", valid.profileB],
      ]) {
        const section = node("section");
        section.append(node("h3", `Program ${label} · primul caz finalizat`));
        const list = node("ul");
        for (const row of profile.instructions.slice(0, 5))
          list.append(
            node("li", `#${row.index} ${row.op}: ${row.count} execuții`),
          );
        section.append(list);
        const loops = node(
          "p",
          profile.loops.length
            ? "Bucle: " +
                profile.loops
                  .map(
                    (loop) => `[${loop.start}…${loop.end}] ${loop.steps} pași`,
                  )
                  .join("; ")
            : "Fără bucle executate.",
          "studio-note",
        );
        section.append(loops);
        $("opt-profile").append(section);
      }
  } catch (error) {
    message("opt-status", error.message, true);
  } finally {
    $("opt-compare").disabled = false;
    $("opt-stop").disabled = true;
  }
});
$("opt-stop").addEventListener("click", () => controller?.abort());
$("opt-left-download").addEventListener("click", () =>
  download("A.bf", $("opt-left").value),
);
$("opt-right-download").addEventListener("click", () =>
  download("B.bf", $("opt-right").value),
);
$("opt-lab").addEventListener("click", (event) => {
  try {
    event.currentTarget.href = codeUrl($("opt-right").value);
  } catch (error) {
    event.preventDefault();
    message("opt-status", error.message, true);
  }
});
window.addEventListener("pagehide", () => controller?.abort());
