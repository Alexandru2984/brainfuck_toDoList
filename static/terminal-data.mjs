export const terminalPrograms = [
  {
    id: "terminal-echo",
    title: "Ecou în conversație",
    category: "Terminal",
    file: "terminal-echo.bf",
    lineMode: false,
    input: "Salut, 🧠",
    description:
      "Trimite text în mai multe reprize; Brainfuck îl afișează imediat.",
    domain:
      "Text UTF-8 fără NUL. EOF sau NUL încheie ecoul. Fără LF automat implicit.",
    memory: ["0: octet citit", "14: prompt și mesaj final"],
    explanation: [
      "Promptul este emis de instrucțiunile . din fișierul BF, apoi , așteaptă următorul octet.",
      "UTF-8 trece octet cu octet; închiderea fluxului scrie zero și încheie bucla.",
    ],
    cases: [
      {
        input: "Salut, 🧠",
        expected: "Ecou UTF-8. EOF pentru stop.\nSalut, 🧠\nGata.\n",
      },
    ],
  },
  {
    id: "terminal-decimal",
    title: "De la cifre la octet",
    category: "Terminal",
    file: "terminal-decimal.bf",
    lineMode: true,
    input: "007\n",
    description:
      "Parsează și afișează un număr zecimal complet, exclusiv în BF.",
    domain:
      "1–3 cifre ASCII, valoare 0–255, urmate de LF sau EOF. Spațiile și CR sunt invalide.",
    memory: [
      "0: caracter",
      "1: valoare",
      "2: validare",
      "3: cifre",
      "33: valoare păstrată",
    ],
    explanation: [
      "Fiecare cifră actualizează valoarea prin înmulțire cu zece și adunare, numai după validare.",
      "Overflow-ul este respins înainte de calcul. Afișarea separă sute, zeci și unități în BF.",
    ],
    cases: [
      { input: "007\n", expected: "Numar (0..255): Valoare: 7\n" },
      { input: "255\n", expected: "Numar (0..255): Valoare: 255\n" },
      { input: "256\n", expected: "Numar (0..255): Input invalid.\n" },
    ],
  },
  {
    id: "terminal-calculator",
    title: "Calculator pe octeți",
    category: "Terminal",
    file: "terminal-calculator.bf",
    lineMode: true,
    input: "255\n+\n1\n",
    description: "Răspunde pe rând la trei prompturi: A, operator și B.",
    domain:
      "A și B: 0–255, 1–3 cifre ASCII. Operator: +, - sau *. Fiecare răspuns pe o linie LF. Rezultatul este modulo 256.",
    memory: [
      "32: A / rezultat",
      "33: operator",
      "34: B",
      "35: validare",
      "0–3: înmulțire",
    ],
    explanation: [
      "Cele trei prompturi, selecția operatorului, înmulțirea și conversia în cifre rulează în BF.",
      "Celulele sunt octeți: 255 + 1 devine 0, iar 0 - 1 devine 255. Inputul invalid oprește calculul.",
    ],
    cases: [
      {
        input: "255\n+\n1\n",
        expected:
          "A (0..255): Operator (+ - *): B (0..255): Rezultat mod 256: 0\n",
      },
      {
        input: "12\n*\n3\n",
        expected:
          "A (0..255): Operator (+ - *): B (0..255): Rezultat mod 256: 36\n",
      },
      {
        input: "256\n",
        expected: "A (0..255): Input invalid sau incomplet.\n",
      },
    ],
  },
  {
    id: "terminal-bytes",
    title: "Ce octeți are textul?",
    category: "Terminal",
    file: "terminal-bytes.bf",
    lineMode: false,
    input: "🧠",
    description:
      "Vezi cum textul UTF-8 devine numere zecimale, câte unul pentru fiecare octet.",
    domain:
      "Text fără NUL; EOF sau NUL încheie fluxul. Textele lungi pot atinge bugetul de pași înaintea limitei de input.",
    memory: [
      "32: octet păstrat",
      "0: unități",
      "10: zeci",
      "11: sute",
      "13: contor",
    ],
    explanation: [
      "Browserul codifică textul în UTF-8. Programul BF face conversia fiecărui octet în cifre zecimale.",
      "Un caracter poate avea mai mulți octeți: 🧠 devine 240 159 167 160.",
    ],
    cases: [
      {
        input: "🧠",
        expected: "Text UTF-8. EOF pentru stop.\n240 159 167 160 \n",
      },
    ],
  },
  {
    id: "terminal-guess",
    title: "Cinci încercări în BF",
    category: "Terminal",
    file: "terminal-guess.bf",
    lineMode: true,
    input: "2\n100\n37\n",
    description:
      "Un joc text cu numere 0–255 și feedback după fiecare încercare.",
    domain:
      "Cel mult cinci linii cu 1–3 cifre ASCII. Ținta este 37 în sursa BF. Inputul invalid consumă o încercare; EOF/NUL încheie jocul.",
    memory: [
      "32: încercări rămase",
      "33: ținta 37",
      "34: încercare",
      "35: validare",
      "37: egalitate",
    ],
    explanation: [
      "Brainfuck validează linia, compară numerele și alege MAI MARE, MAI MIC sau CORECT.",
      "Ținta este vizibilă și poate fi schimbată în sursă. Jocul se oprește la răspuns corect, EOF sau cinci încercări.",
    ],
    cases: [
      {
        input: "37\n",
        expected:
          "Ghici numarul 0..255. Ai 5 incercari.\nNumar (0..255): CORECT\nSfarsit de joc.\n",
      },
    ],
  },
];
