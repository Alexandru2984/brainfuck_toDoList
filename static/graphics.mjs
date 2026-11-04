export const graphicPrograms = [
  {
    id: "gradient",
    name: "Gradient",
    file: "pixels-gradient.bf",
    width: 16,
    height: 16,
    frames: 1,
    description:
      "Două bucle emit 16×16 valori. Fiecare pixel adaugă 16; overflow reconstruiește gradientul pe rândul următor.",
  },
  {
    id: "checker",
    name: "Tablă de șah",
    file: "pixels-checker.bf",
    width: 8,
    height: 8,
    frames: 1,
    description:
      "Un indicator BF alternează între 0 și 1; outputul devine 0 sau 255. La final de rând, faza se inversează.",
  },
  {
    id: "diagonal",
    name: "Diagonală",
    file: "pixels-diagonal.bf",
    width: 16,
    height: 16,
    frames: 1,
    description:
      "Brainfuck compară indicii rândului și coloanei și emite 255 numai când sunt egali.",
  },
  {
    id: "pulse",
    name: "Puls de lumină",
    file: "pixels-pulse.bf",
    width: 8,
    height: 8,
    frames: 8,
    description:
      "Opt cadre, fiecare cu 64 de pixeli. Intensitatea crește cu 32 între cadre, printr-un contor BF.",
  },
  {
    id: "scanline",
    name: "Linie în mișcare",
    file: "pixels-scanline.bf",
    width: 8,
    height: 8,
    frames: 8,
    description:
      "Indicele cadrului selectează rândul luminos. Toate cele 512 valori sunt calculate și emise în BF.",
  },
];
export function validateDimensions(width, height, count) {
  if (
    ![width, height, count].every(Number.isInteger) ||
    width < 1 ||
    height < 1 ||
    width > 32 ||
    height > 32 ||
    count < 1 ||
    count > 8
  )
    throw new Error("Dimensiuni permise: 1–32 × 1–32 pixeli, 1–8 cadre.");
  return width * height * count;
}
export function decodeFrames(output, width, height, count) {
  validateDimensions(width, height, count);
  const size = width * height,
    total = size * count;
  if (output.length !== total)
    throw new Error(
      `Programul a emis ${output.length} octeți; configurația cere exact ${total}.`,
    );
  if (
    output.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  )
    throw new Error("Outputul trebuie să conțină octeți.");
  return Array.from({ length: count }, (_, i) =>
    Uint8Array.from(output.slice(i * size, (i + 1) * size)),
  );
}
export function pixelBuffer(frame, palette = "gray") {
  const rgba = new Uint8ClampedArray(frame.length * 4);
  for (let i = 0; i < frame.length; i++) {
    const value = frame[i];
    rgba[i * 4] = palette === "green" ? Math.round(value * 0.45) : value;
    rgba[i * 4 + 1] = value;
    rgba[i * 4 + 2] = palette === "green" ? Math.round(value * 0.2) : value;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
