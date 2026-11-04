export const selfDemos = [
  {
    id: "echo",
    name: "Un caracter, două interpretoare",
    code: ",.",
    input: "A",
    description:
      "Virgula și punctul sunt interpretate de programul .bf exterior. Outputul este A.",
  },
  {
    id: "transfer",
    name: "O buclă de transfer",
    code: "++[>+<-]>.",
    input: "",
    description:
      "Programul interior mută valoarea 2 în celula următoare. Outputul este octetul 02, vizibil în HEX.",
  },
  {
    id: "nested",
    name: "Paranteze imbricate",
    code: "[[]],.",
    input: "B",
    description:
      "Celula începe de la zero. Interpretorul BF caută paranteza pereche peste bucla imbricată, apoi citește și afișează B.",
  },
  {
    id: "wrap",
    name: "Overflow pe un octet",
    code: "-.",
    input: "",
    description: "Zero minus unu devine 255. Outputul binar este ff.",
  },
];
