export const lessons = [
  {
    id: "cells",
    title: "01 / Celule și valori",
    intro:
      "Fiecare celulă este un octet: 0–255. Plus și minus schimbă celula aleasă de pointer.",
    explanation:
      "Punctul emite valoarea ca octet. Pentru A ai nevoie de 65, nu de cifra 65 ca text.",
    starter: "+++++",
    solution: "+".repeat(65) + ".",
    cases: [{ input: "", expected: "A" }],
    hint: "Construiește valoarea ASCII 65 și afișeaz-o cu punct.",
    prediction: { code: "+++++--", cell: 0 },
  },
  {
    id: "pointer",
    title: "02 / Pointerul",
    intro:
      "Semnele > și < schimbă celula activă. Valorile rămân pe bandă când pleci de lângă ele.",
    explanation:
      "Construiește A în celula 0 și B în celula 1. Afișează-le în această ordine.",
    starter: ">++<",
    solution: "+".repeat(65) + ".>" + "+".repeat(66) + ".",
    cases: [{ input: "", expected: "AB", memory: { 0: 65, 1: 66 } }],
    hint: "Folosește punct înainte de a muta pointerul spre celula următoare.",
    prediction: { code: "+++>++<", cell: 0 },
  },
  {
    id: "wrap",
    title: "03 / Overflow",
    intro: "Celulele se înfășoară: 0 − 1 devine 255, iar 255 + 1 devine 0.",
    explanation:
      "Emite octetul 255, apoi octetul 0. Sunt octeți binari; outputul nu trebuie să fie text lizibil.",
    starter: "-",
    solution: "-.+.",
    cases: [{ input: "", expectedBytes: [255, 0] }],
    hint: "Pornește de la zero, scade, afișează, crește și afișează.",
    prediction: { code: "-++", cell: 0 },
  },
  {
    id: "input",
    title: "04 / Citește un octet",
    intro:
      "Virgula ia următorul octet din input. În laborator, textul este mai întâi codificat UTF-8.",
    explanation:
      "Citește și afișează primul octet. La lipsa inputului, virgula scrie zero.",
    starter: ",",
    solution: ",.",
    cases: [
      { input: "A", expected: "A" },
      { input: "z", expected: "z" },
      { input: "", expectedBytes: [0] },
    ],
    hint: "O virgulă pentru citire, un punct pentru afișare.",
    prediction: { code: "++++,", cell: 0 },
  },
  {
    id: "loops",
    title: "05 / Prima buclă",
    intro:
      "[ sare după ] dacă celula este zero. ] revine în buclă când celula nu este zero.",
    explanation:
      "Construiește litera A folosind o buclă de multiplicare. Urmărește celula 0 ca numărător.",
    starter: "++++++++[>++++++++<-]>",
    solution: "++++++++[>++++++++<-]>+.",
    cases: [{ input: "", expected: "A" }],
    hint: "8 × 8 = 64. Mai adaugă 1 înainte de output.",
    prediction: { code: "+++[>++<-]", cell: 1 },
  },
  {
    id: "clear",
    title: "06 / Curăță o celulă",
    intro: "O buclă care scade până la zero este o rutină reutilizabilă.",
    explanation:
      "Citește un octet, curăță celula și emite zero. Trebuie să funcționeze pentru valori diferite.",
    starter: ",[",
    solution: ",[-].",
    cases: [
      { input: "A", expectedBytes: [0], memory: { 0: 0 } },
      { input: "z", expectedBytes: [0], memory: { 0: 0 } },
    ],
    hint: "Rutina de curățare este [-].",
    prediction: { code: "++++[-]", cell: 0 },
  },
  {
    id: "transfer",
    title: "07 / Mută o valoare",
    intro: "Un transfer consumă o celulă și acumulează valoarea în alta.",
    explanation:
      "Citește un caracter în celula 0, mută-l în celula 1 și afișează-l. Celula 0 trebuie să rămână zero.",
    starter: ",[>+<-]",
    solution: ",[>+<-]>.",
    cases: [
      { input: "3", expected: "3", memory: { 0: 0, 1: 51 } },
      { input: "Q", expected: "Q", memory: { 0: 0, 1: 81 } },
    ],
    hint: "La fiecare iterație adaugi în destinație și scazi din sursă.",
    prediction: { code: "++++[>+<-]", cell: 0 },
  },
  {
    id: "copy",
    title: "08 / Copiază fără pierdere",
    intro:
      "Pentru a păstra sursa, folosește o celulă temporară și reconstruiește valoarea inițială.",
    explanation:
      "Citește un caracter. Lasă o copie în celulele 0 și 1 și afișează ambele copii.",
    starter: ",[>+>+<<-]",
    solution: ",[>+>+<<-]>>[<<+>>-]<<.>.",
    cases: [
      { input: "A", expected: "AA", memory: { 0: 65, 1: 65 } },
      { input: "7", expected: "77", memory: { 0: 55, 1: 55 } },
    ],
    hint: "Mută temporarul înapoi în sursă după distribuire.",
    prediction: { code: "+++[>+>+<<-]>>[<<+>>-]", cell: 0 },
  },
  {
    id: "digits",
    title: "09 / Numere și ASCII",
    intro:
      "Cifra 3 este octetul 51. Pentru calcule trebuie să distingi cifra afișată de valoarea numerică.",
    explanation:
      "Adună două cifre. Cazurile au suma cel mult 9, astfel încât rezultatul este o singură cifră.",
    starter: ",>,",
    file: "sum.bf",
    cases: [
      { input: "23", expected: "5" },
      { input: "00", expected: "0" },
      { input: "45", expected: "9" },
    ],
    hint: "Suma codurilor ASCII conține de două ori offsetul 48; rezultatul afișat are nevoie de el o singură dată.",
    prediction: { code: "+++++[>++<-]", cell: 1 },
  },
  {
    id: "multiply",
    title: "10 / Bucle imbricate",
    intro:
      "O buclă poate conține alte bucle. Temporarele te ajută să refaci un operand.",
    explanation: "Înmulțește două cifre al căror produs este cel mult 9.",
    starter: ",",
    file: "multiply.bf",
    cases: [
      { input: "23", expected: "6" },
      { input: "33", expected: "9" },
      { input: "04", expected: "0" },
    ],
    hint: "Înlocuiește înmulțirea cu adunare repetată și păstrează o copie a multiplicatorului.",
    prediction: { code: "++[>+++[>+<-]<-]", cell: 2 },
  },
  {
    id: "reverse",
    title: "11 / O stivă pe bandă",
    intro:
      "Poți păstra câte un octet în fiecare celulă și apoi parcurge banda în sens invers.",
    explanation:
      "Inversează un text ASCII fără octeți NUL. Inputul gol trebuie să producă output gol.",
    starter: ">,",
    file: "reverse.bf",
    cases: [
      { input: "abc", expected: "cba" },
      { input: "loop", expected: "pool" },
      { input: "", expected: "" },
    ],
    hint: "Lasă celula 0 ca santinelă, citește spre dreapta și afișează spre stânga.",
    prediction: { code: ">+++>++<", cell: 1 },
  },
  {
    id: "final",
    title: "12 / Un filtru complet",
    intro:
      "Acum poți combina input, bucle și aritmetică într-un mic program de prelucrare a textului.",
    explanation:
      "Transformă toate literele mici ASCII a–z în A–Z. Inputul conține numai a–z și EOF.",
    starter: ",[",
    file: "upper.bf",
    cases: [
      { input: "abc", expected: "ABC" },
      { input: "brainfuck", expected: "BRAINFUCK" },
      { input: "", expected: "" },
    ],
    hint: "Diferența dintre a și A este 32. Repetă citirea până la zero.",
    prediction: { code: "+++[>++++<-]>--", cell: 1 },
  },
];
