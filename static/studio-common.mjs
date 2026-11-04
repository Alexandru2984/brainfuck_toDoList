import { LIMITS } from "./bf-vm.mjs";
export const $ = (id) => document.getElementById(id);
export function node(tag, text, className = "") {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
export function message(id, text, error = false) {
  const target = $(id);
  target.textContent = text;
  target.classList.toggle("has-error", error);
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function runJob(data, { timeout = 8000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./studio-worker.mjs", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("Operație oprită."));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Rularea a depășit limita de timp. Verifică buclele."));
    }, timeout);
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.ok) resolve(data);
      else reject(new Error(data.error));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("Workerul nu a putut executa programul."));
    };
    worker.postMessage(data);
  });
}
export async function source(file) {
  if (!/^[a-z0-9-]+\.bf$/.test(file)) throw new Error("Fișier invalid.");
  const response = await fetch("/static/programs/" + file);
  if (!response.ok) throw new Error("Programul nu a putut fi încărcat.");
  const code = await response.text();
  if (code.length > LIMITS.code) throw new Error("Program prea mare.");
  return code;
}
export function download(name, body, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = node("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function codeUrl(code, path = "/lab") {
  if (typeof code !== "string" || code.length > 6000)
    throw new Error("Pentru programe mari folosește descărcarea .bf.");
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, code }));
  const encoded = btoa(
    Array.from(bytes, (b) => String.fromCharCode(b)).join(""),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (encoded.length > 30000) throw new Error("Cod prea mare pentru un link.");
  const url = new URL(path, location.origin);
  url.hash = "code=" + encoded;
  return url.href;
}
export function sharedCode() {
  if (!location.hash.startsWith("#code=")) return null;
  const encoded = location.hash.slice(6);
  if (encoded.length > 30000) throw new Error("Link prea mare.");
  const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  const object = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    ),
  );
  if (
    object.v !== 1 ||
    typeof object.code !== "string" ||
    object.code.length > LIMITS.code
  )
    throw new Error("Link invalid.");
  return object.code;
}
export function showCases(target, results) {
  target.replaceChildren(
    ...results.map((result, i) => {
      const row = node(
        "div",
        undefined,
        `test-result ${result.pass ? "pass" : "fail"}`,
      );
      row.append(
        node(
          "p",
          `${result.pass ? "✓" : "×"} Caz ${i + 1} · input ${JSON.stringify(result.input)}${result.error ? " · " + result.error : ` · ${result.steps} pași · ${result.cells} celule`}`,
        ),
      );
      if (!result.pass && result.actual && result.expected) {
        const format = (bytes) =>
          `${JSON.stringify(new TextDecoder().decode(Uint8Array.from(bytes)))} · HEX ${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ") || "∅"}`;
        row.append(
          node(
            "pre",
            `Așteptat: ${format(result.expected)}\nObținut: ${format(result.actual)}`,
            "studio-note",
          ),
        );
      }
      if (result.memoryMatch === false)
        row.append(
          node(
            "p",
            "Condițiile de memorie ale exercițiului nu sunt îndeplinite.",
            "studio-note",
          ),
        );
      return row;
    }),
  );
}

export function attachCodeTools(editorId, prefix) {
  const editor = $(editorId);
  $(prefix + "-download")?.addEventListener("click", () =>
    download("program.bf", editor.value),
  );
  $(prefix + "-lab")?.addEventListener("click", (event) => {
    try {
      event.currentTarget.href = codeUrl(editor.value);
    } catch (error) {
      event.preventDefault();
      alert(error.message);
    }
  });
}
