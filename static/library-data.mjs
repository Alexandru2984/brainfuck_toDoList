import { examples } from "./catalog.mjs";
import { terminalPrograms } from "./terminal-data.mjs";
const known = {
  hello: "Hello World!\n",
  echo: "Salut, Brainfuck!",
  sum: "5",
  multiply: "6",
  reverse: "kcufniarb",
  count: "9",
  upper: "BRAINFUCK",
  alphabet: "abcdefghijklmnopqrstuvwxyz",
  transfer: "",
};
const originals = examples.map((e) => ({
  id: e.id,
  title: e.name,
  file: e.file,
  input: e.input,
  category: ["sum", "multiply", "count"].includes(e.id)
    ? "Aritmetică"
    : "Fundamente",
  description: e.description,
  domain:
    e.id === "bytes"
      ? "Fără input; output binar 1–255."
      : "Inputul de exemplu și semantica descrisă în fișa programului.",
  explanation: [
    e.description,
    "Deschide sursa în debugger și urmărește pointerul, celulele și buclele.",
  ],
  memory: ["0: celulă de lucru", "Celule vecine: contoare sau temporare"],
  cases: [
    e.id === "bytes"
      ? {
          input: "",
          expectedBytes: Array.from({ length: 255 }, (_, i) => i + 1),
        }
      : { input: e.input, expected: known[e.id] },
  ],
}));
export const algorithms = [
  {
    id: "fibonacci",
    title: "Fibonacci",
    category: "Aritmetică",
    file: "fibonacci.bf",
    input: "6",
    description:
      "Calculează F(n) prin adunare repetată și schimbarea registrelor.",
    domain:
      "O cifră n între 0 și 6. F(0)=0, F(1)=1; rezultatul încape într-o cifră.",
    memory: ["0: n rămas", "1: F(n)", "2: următorul termen", "3–4: temporare"],
    explanation: [
      "Două celule păstrează termenii consecutivi. Fiecare iterație construiește suma și schimbă rolurile valorilor.",
      "La final se adaugă offsetul ASCII 48 pentru afișare.",
    ],
    cases: [
      { input: "0", expected: "0" },
      { input: "1", expected: "1" },
      { input: "4", expected: "3" },
      { input: "6", expected: "8" },
    ],
  },
  {
    id: "division",
    title: "Împărțire cu rest",
    category: "Aritmetică",
    file: "division.bf",
    input: "92",
    description: "Scade divizorul cât timp restul îl poate acoperi.",
    domain:
      "Două cifre: deîmpărțit 0–9, divizor 1–9. Output: cât, spațiu, rest. Divizorul zero produce ?.",
    memory: ["0: rest", "1: divizor", "2: cât", "5: comparație"],
    explanation: [
      "Comparația păstrează operanzii. Fiecare scădere mărește câtul cu unu.",
      "O ramură separată tratează divizorul zero fără buclă infinită.",
    ],
    cases: [
      { input: "92", expected: "4 1" },
      { input: "03", expected: "0 0" },
      { input: "99", expected: "1 0" },
      { input: "10", expected: "?" },
    ],
  },
  {
    id: "sort-pair",
    title: "Sortarea a două cifre",
    category: "Aritmetică",
    file: "sort-pair.bf",
    input: "72",
    description: "Compară și schimbă două cifre pentru ordine crescătoare.",
    domain:
      "Exact două cifre ASCII 0–9. Outputul păstrează ambele cifre, inclusiv zero.",
    memory: [
      "0: prima cifră",
      "1: a doua cifră",
      "3: schimb temporar",
      "5: rezultat comparație",
    ],
    explanation: [
      "Cifrele sunt convertite în valori numerice și comparate fără distrugerea operanzilor.",
      "Dacă prima este mai mare sau egală, un registru temporar permite schimbul.",
    ],
    cases: [
      { input: "72", expected: "27" },
      { input: "00", expected: "00" },
      { input: "97", expected: "79" },
      { input: "70", expected: "07" },
    ],
  },
  {
    id: "calculator",
    title: "Calculator cu o cifră",
    category: "Aritmetică",
    file: "calculator.bf",
    input: "2*3",
    description: "Parsează o expresie și execută +, − sau × în Brainfuck.",
    domain:
      "Format a+b, a-b sau a*b, cu cifre 0–9 și rezultat 0–9. Operatorul necunoscut produce ?.",
    memory: [
      "0: operand / rezultat",
      "1: operator ASCII",
      "2: al doilea operand",
      "3–4: acumulare",
      "6: operator recunoscut",
    ],
    explanation: [
      "Operatorul selectează o ramură BF. Înmulțirea folosește adunare repetată.",
      "Nu este parser de expresii generale: domeniul este intenționat mic și vizibil.",
    ],
    cases: [
      { input: "2+3", expected: "5" },
      { input: "8-3", expected: "5" },
      { input: "2*3", expected: "6" },
      { input: "0*9", expected: "0" },
      { input: "1/2", expected: "?" },
    ],
  },
  {
    id: "rot13",
    title: "ROT13",
    category: "Text",
    file: "rot13.bf",
    input: "Hello, World!",
    description:
      "Transformă literele ASCII printr-o tabelă de substituție parcursă în BF.",
    domain:
      "Texte scurte, fără NUL. A–Z și a–z sunt rotite; ceilalți octeți se păstrează. Bugetul de pași limitează lungimea.",
    memory: [
      "0: input",
      "1: output",
      "2: index normalizat",
      "32+: tabelă, contoare și marcaje",
    ],
    explanation: [
      "Programul construiește tabela în memorie la pornire și face căutarea fiecărui octet numai în Brainfuck.",
      "ROT13 este o substituție reversibilă, nu criptografie. UTF-8 din afara ASCII se păstrează octet cu octet.",
    ],
    cases: [
      { input: "Ab", expected: "No" },
      { input: "Nn", expected: "Aa" },
      { input: "!?", expected: "!?" },
      { input: "Zz", expected: "Mm" },
    ],
  },
  {
    id: "guess",
    title: "Ghicește cifra",
    category: "Jocuri",
    file: "guess.bf",
    input: "1579",
    description: "Un mic joc text cu feedback pentru fiecare încercare.",
    domain:
      "Cifre consecutive 0–9, fără separatori. Ținta din sursa BF este 7. EOF încheie rundele.",
    memory: ["0: încercare", "1: ținta 7", "2: comparație", "14: text afișat"],
    explanation: [
      "Brainfuck compară fiecare cifră cu ținta și alege feedbackul: MAI MARE, MAI MIC sau CORECT.",
      "Ținta este vizibilă în sursă: acesta este un exercițiu de ramificare, nu un concurs cu secret ascuns.",
    ],
    cases: [
      { input: "5", expected: "MAI MARE\n" },
      { input: "7", expected: "CORECT\n" },
      { input: "9", expected: "MAI MIC\n" },
      { input: "", expected: "" },
    ],
  },
  {
    id: "parity",
    title: "Par sau impar?",
    category: "Aritmetică",
    file: "parity.bf",
    input: "9",
    description: "Un bit alternant urmărește paritatea unei cifre.",
    domain: "O cifră ASCII 0–9; output PAR sau IMPAR.",
    memory: ["0: contor", "1: paritate", "14: text"],
    explanation: [
      "La fiecare decrementare se inversează un indicator 0/1.",
      "După consumarea cifrei, indicatorul selectează mesajul.",
    ],
    cases: [
      { input: "0", expected: "PAR" },
      { input: "2", expected: "PAR" },
      { input: "7", expected: "IMPAR" },
      { input: "9", expected: "IMPAR" },
    ],
  },
  {
    id: "caesar",
    title: "Caesar +1",
    category: "Text",
    file: "caesar.bf",
    input: "xyz",
    description: "Deplasează literele mici cu o poziție, cu revenire z → a.",
    domain: "Numai litere ASCII a–z, până la EOF. Fără NUL în text.",
    memory: ["0: caracter", "16+: temporare de comparație"],
    explanation: [
      "O comparație tratează z separat, apoi incrementarea produce caracterul următor.",
      "Este un exemplu de filtru BF, nu o metodă de protecție a datelor.",
    ],
    cases: [
      { input: "xyz", expected: "yza" },
      { input: "abc", expected: "bcd" },
      { input: "z", expected: "a" },
      { input: "", expected: "" },
    ],
  },
];
export const library = [...algorithms, ...originals, ...terminalPrograms];
