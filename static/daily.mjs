export function utcDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Data trebuie să fie YYYY-MM-DD.");
  const time = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new Error("Dată invalidă.");
  return Math.floor(time / 86400000);
}
export function dailyPuzzle(date) {
  const day = utcDay(date);
  let seed = (day ^ 0x5bf17a9) >>> 0;
  const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  const kind = ((day % 8) + 8) % 8;
  const letters = (n) =>
    Array.from({ length: n }, () => String.fromCharCode(97 + random(26))).join(
      "",
    );
  const base = {
    date,
    id: `bf-daily-v1-${date}`,
    starter: "",
    hint: "Rulează pe fiecare caz, apoi urmărește memoria în debugger.",
  };
  if (kind === 0) {
    const char = String.fromCharCode(65 + random(26));
    return {
      ...base,
      title: `Litera ${char}`,
      prompt: `Afișează exact ${char}, fără input și fără newline.`,
      cases: [{ input: "", expected: char }],
      reference: "+".repeat(char.charCodeAt(0)) + ".",
    };
  }
  if (kind === 1) {
    const inputs = [
      "",
      letters(1),
      letters(4),
      letters(8),
      "Salut, 🧠",
      letters(3),
    ];
    return {
      ...base,
      title: "Ecou fidel",
      prompt:
        "Afișează inputul UTF-8 complet până la EOF. Niciun caz nu conține NUL.",
      cases: inputs.map((input) => ({ input, expected: input })),
      file: "echo.bf",
    };
  }
  if (kind === 2) {
    const pairs = [
      [0, 0],
      [4, 5],
      ...Array.from({ length: 5 }, () => {
        const a = random(10);
        return [a, random(10 - a)];
      }),
    ];
    return {
      ...base,
      title: "Două cifre, o sumă",
      prompt:
        "Adună cele două cifre din input. Suma este între 0 și 9; afișează o singură cifră.",
      starter: ",>,",
      cases: pairs.map(([a, b]) => ({
        input: `${a}${b}`,
        expected: String(a + b),
      })),
      file: "sum.bf",
    };
  }
  if (kind === 3) {
    const inputs = [
      "",
      letters(1),
      letters(9),
      ...Array.from({ length: 4 }, () => letters(random(10))),
    ];
    return {
      ...base,
      title: "Câți octeți?",
      prompt: "Afișează lungimea inputului ASCII, între 0 și 9, ca o cifră.",
      cases: inputs.map((input) => ({ input, expected: String(input.length) })),
      file: "count.bf",
    };
  }
  if (kind === 4) {
    const inputs = [
      "",
      letters(1),
      letters(8),
      ...Array.from({ length: 4 }, () => letters(2 + random(9))),
    ];
    return {
      ...base,
      title: "Oglinda zilei",
      prompt: "Inversează octeții inputului ASCII. Nu adăuga newline.",
      starter: ">,",
      cases: inputs.map((input) => ({
        input,
        expected: [...input].reverse().join(""),
      })),
      file: "reverse.bf",
    };
  }
  if (kind === 5) {
    const pairs = [
      [0, 7],
      [3, 3],
      [1, 9],
      ...Array.from({ length: 4 }, () => {
        const a = 1 + random(9);
        return [a, random(Math.floor(9 / a) + 1)];
      }),
    ];
    return {
      ...base,
      title: "Produs mic, idee mare",
      prompt:
        "Înmulțește cele două cifre. Produsul este între 0 și 9; afișează-l ca o cifră.",
      cases: pairs.map(([a, b]) => ({
        input: `${a}${b}`,
        expected: String(a * b),
      })),
      file: "multiply.bf",
    };
  }
  if (kind === 6) {
    const inputs = ["", "z", "abc", letters(6), letters(8)];
    return {
      ...base,
      title: "Majusculele zilei",
      prompt: "Transformă toate literele mici ASCII a–z în A–Z.",
      cases: inputs.map((input) => ({ input, expected: input.toUpperCase() })),
      file: "upper.bf",
    };
  }
  const start = random(2) ? 65 : 97;
  const expected = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(start + i),
  ).join("");
  return {
    ...base,
    title: start === 65 ? "Alfabet cu majuscule" : "Alfabet cu minuscule",
    prompt: `Afișează exact ${expected}, fără newline.`,
    cases: [{ input: "", expected }],
    reference: "+".repeat(start) + "." + "+.".repeat(25),
  };
}
export function scoreSubmission(code, results) {
  if (
    !results.length ||
    !results.every(
      (row) =>
        row.pass &&
        Number.isInteger(row.steps) &&
        row.steps >= 0 &&
        row.steps <= 500000 &&
        Number.isInteger(row.cells) &&
        row.cells >= 1 &&
        row.cells <= 30000,
    )
  )
    throw new Error("Scorul necesită toate cazurile trecute.");
  return {
    length: (code.match(/[><+\-.,\[\]]/g) || []).length,
    steps: results.reduce((sum, row) => sum + row.steps, 0),
    cells: Math.max(...results.map((row) => row.cells)),
  };
}
export function improveRecord(previous, score) {
  const valid =
    previous &&
    ["length", "steps", "cells"].every(
      (key) =>
        Number.isInteger(previous[key]) &&
        previous[key] >= 0 &&
        previous[key] <= 4000000,
    );
  return Object.fromEntries(
    ["length", "steps", "cells"].map((key) => [
      key,
      valid ? Math.min(previous[key], score[key]) : score[key],
    ]),
  );
}
