export const examples = [
  {
    id: "hello",
    name: "Hello, World!",
    level: "Primul program",
    file: "hello.bf",
    input: "",
    description:
      "Bucle imbricate construiesc valorile ASCII. Un clasic cu doar opt instrucțiuni.",
  },
  {
    id: "echo",
    name: "Ecou",
    level: "Input / output",
    file: "echo.bf",
    input: "Salut, Brainfuck!",
    description:
      "Citește și afișează fiecare octet până la EOF. Încearcă și text în română.",
  },
  {
    id: "sum",
    name: "Adună două cifre",
    level: "Aritmetică",
    file: "sum.bf",
    input: "23",
    description:
      "Două cifre ASCII intră, suma iese. Pentru rezultat de o cifră: 2 + 3 → 5.",
  },
  {
    id: "multiply",
    name: "Înmulțește",
    level: "Bucle imbricate",
    file: "multiply.bf",
    input: "23",
    description:
      "Adunare repetată, fără operator de înmulțire. Produsul trebuie să încapă într-o cifră.",
  },
  {
    id: "reverse",
    name: "Oglinda",
    level: "Bandă de memorie",
    file: "reverse.bf",
    input: "brainfuck",
    description:
      "Păstrează octeții pe bandă, apoi îi citește invers. Folosește text ASCII: inversează octeți, nu caractere Unicode.",
  },
  {
    id: "count",
    name: "Numără octeții",
    level: "Contor",
    file: "count.bf",
    input: "brainfuck",
    description:
      "Un contor pentru texte de până la 9 octeți. Vezi cum crește celula 1.",
  },
  {
    id: "upper",
    name: "Litere mari",
    level: "ASCII",
    file: "upper.bf",
    input: "brainfuck",
    description:
      "Transformă literele mici a–z în A–Z scăzând 32. Acest exemplu acceptă doar a–z.",
  },
  {
    id: "alphabet",
    name: "Alfabetul",
    level: "Output",
    file: "alphabet.bf",
    input: "",
    description: "De la a la z: un exercițiu simplu de incrementare și output.",
  },
  {
    id: "bytes",
    name: "Toți octeții",
    level: "Overflow",
    file: "bytes.bf",
    input: "",
    description:
      "Valorile de la 1 la 255, apoi overflow la 0. Comută outputul pe HEX.",
  },
  {
    id: "transfer",
    name: "Transfer de memorie",
    level: "Debugger",
    file: "transfer.bf",
    input: "",
    description:
      "Mută valoarea 8 din celula 0 în celula 1. Rulează pas cu pas și urmărește banda.",
  },
];
export const challenges = [
  {
    id: "letter",
    name: "01 / Prima literă",
    prompt: "Afișează exact A, fără input.",
    starter: "",
    hint: "ASCII pentru A este 65. Construiește 65 în celula curentă, apoi folosește punct.",
    cases: [{ input: "", expected: "A" }],
  },
  {
    id: "echo",
    name: "02 / Ecou",
    prompt: "Afișează inputul complet, octet cu octet, până la EOF.",
    starter: ",",
    hint: "Virgula citește. Punctul afișează. Pune-le într-o buclă care se oprește la zero.",
    cases: [
      { input: "Hi!", expected: "Hi!" },
      { input: "Brainfuck", expected: "Brainfuck" },
      { input: "", expected: "" },
      { input: "Salut, 🧠", expected: "Salut, 🧠" },
    ],
  },
  {
    id: "sum",
    name: "03 / Adunare",
    prompt:
      "Citește două cifre 0–9 și afișează suma lor ca o cifră. Suma este cel mult 9.",
    starter: ",>,",
    hint: "Cifrele sunt ASCII: scade 48 o dată din suma valorilor citite.",
    cases: [
      { input: "23", expected: "5" },
      { input: "00", expected: "0" },
      { input: "45", expected: "9" },
      { input: "71", expected: "8" },
    ],
  },
  {
    id: "count",
    name: "04 / Lungime",
    prompt: "Afișează numărul de octeți din input, între 0 și 9, ca o cifră.",
    starter: "",
    hint: "Folosește o celulă pentru input și alta pentru contor. Adaugă 48 înainte de afișare.",
    cases: [
      { input: "", expected: "0" },
      { input: "a", expected: "1" },
      { input: "hello", expected: "5" },
      { input: "brainfuck", expected: "9" },
    ],
  },
  {
    id: "reverse",
    name: "05 / Oglinda",
    prompt: "Inversează octeții unui text ASCII. Nu adăuga newline.",
    starter: ">,",
    hint: "Lasă celula 0 goală. Citește spre dreapta până la EOF și afișează spre stânga până la zero.",
    cases: [
      { input: "abc", expected: "cba" },
      { input: "", expected: "" },
      { input: "a", expected: "a" },
      { input: "loop", expected: "pool" },
    ],
  },
  {
    id: "multiply",
    name: "06 / Înmulțire",
    prompt: "Înmulțește două cifre și afișează produsul (maximum 9).",
    starter: "",
    hint: "Convertește cifrele din ASCII. Folosește o celulă temporară ca să refaci multiplicatorul după fiecare adunare.",
    cases: [
      { input: "23", expected: "6" },
      { input: "33", expected: "9" },
      { input: "04", expected: "0" },
      { input: "18", expected: "8" },
    ],
  },
  {
    id: "upper",
    name: "07 / Majuscule",
    prompt: "Convertește inputul din a–z în A–Z, până la EOF.",
    starter: "",
    hint: "Între a și A sunt 32 de poziții ASCII.",
    cases: [
      { input: "abc", expected: "ABC" },
      { input: "brainfuck", expected: "BRAINFUCK" },
      { input: "", expected: "" },
      { input: "z", expected: "Z" },
    ],
  },
  {
    id: "alphabet",
    name: "08 / Alfabet",
    prompt: "Afișează exact abcdefghijklmnopqrstuvwxyz.",
    starter: "",
    hint: "Pornește de la 97 și incrementează. Poți folosi un contor separat pentru 26 de iterații.",
    cases: [{ input: "", expected: "abcdefghijklmnopqrstuvwxyz" }],
  },
];
