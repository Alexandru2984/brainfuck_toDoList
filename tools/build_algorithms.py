"""Generate runnable BF algorithms and graphic programs, not precomputed output."""

from pathlib import Path

from bf_builder import Program


def fibonacci():
    p = Program()
    p.read(0)
    p.add(0, -48)
    p.set(2, 1)

    def iteration():
        p.add(0, -1)
        p.copy(2, 3)
        p.copy(1, 4)
        p.transfer(4, 2, replace=False)
        p.transfer(3, 1)

    p.loop(0, iteration)
    p.add(1, 48)
    p.output(1)
    return p.source()


def division():
    p = Program()
    p.read(0)
    p.read(1)
    p.add(0, -48)
    p.add(1, -48)
    p.equal(1, 0, lambda: p.literal("?"))

    def divide():
        p.greater_equal(0, 1, 5)

        def subtract():
            p.copy(1, 3)
            p.loop(3, lambda: (p.add(3, -1), p.add(0, -1)))
            p.add(2)
            p.greater_equal(0, 1, 5)

        p.loop(5, subtract)
        p.add(2, 48)
        p.output(2)
        p.literal(" ")
        p.add(0, 48)
        p.output(0)

    p.nonzero(1, divide)
    return p.source()


def sort_pair():
    p = Program()
    p.read(0)
    p.read(1)
    p.add(0, -48)
    p.add(1, -48)
    p.greater_equal(0, 1, 5)
    p.nonzero(5, lambda: (p.transfer(0, 3), p.transfer(1, 0), p.transfer(3, 1)))
    for cell in (0, 1):
        p.add(cell, 48)
        p.output(cell)
    return p.source()


def calculator():
    p = Program()
    p.read(0)
    p.read(1)
    p.read(2)
    p.add(0, -48)
    p.add(2, -48)
    p.equal(1, ord("+"), lambda: (p.transfer(2, 0, replace=False), p.set(6, 1)))

    def subtract():
        p.loop(2, lambda: (p.add(2, -1), p.add(0, -1)))
        p.set(6, 1)

    def multiply():
        def iteration():
            p.add(0, -1)
            p.copy(2, 4)
            p.transfer(4, 3, replace=False)

        p.loop(0, iteration)
        p.transfer(3, 0)
        p.set(6, 1)

    p.equal(1, ord("-"), subtract)
    p.equal(1, ord("*"), multiply)
    p.nonzero(6, lambda: (p.add(0, 48), p.output(0)))
    p.equal(6, 0, lambda: p.literal("?"))
    return p.source()


def rot13():
    p = Program()
    base = 32
    # Read-only lookup triples: counter, mapped byte, breadcrumb. The table
    # is built in BF memory at runtime; each input byte is indexed in BF.
    for byte in range(32, 128):
        mapped = byte
        if 65 <= byte <= 90:
            mapped = 65 + (byte - 65 + 13) % 26
        elif 97 <= byte <= 122:
            mapped = 97 + (byte - 97 + 13) % 26
        p.set(base + 3 * (byte - 32) + 1, mapped)
    p.read(0)

    def letter():
        p.copy(0, 2)
        p.add(2, -32)
        p.copy(2, base)
        p.move(base)
        p.raw("[-[->>>+<<<]>>+>]>[<+>>+<-]>[<+>-]<<<[[-]>[-<<<+>>>]<<<<]>")
        p.ptr = base
        p.transfer(base, 1)
        # Bytes outside ASCII map to zero in the initially empty tail; copy
        # the original byte so arbitrary UTF-8 sequences remain unchanged.
        p.equal(1, 0, lambda: p.copy(0, 1))
        p.output(1)
        p.read(0)

    p.loop(0, letter)
    return p.source()


def guessing():
    p = Program()
    p.set(1, 7)
    p.read(0)

    def guess():
        p.add(0, -48)
        p.greater_equal(0, 1, 2)
        p.equal(2, 0, lambda: p.literal("MAI MARE\n"))

        def higher():
            p.equal(0, 7, lambda: p.literal("CORECT\n"))
            p.copy(0, 3)
            p.add(3, -7)
            p.nonzero(3, lambda: p.literal("MAI MIC\n"))

        p.nonzero(2, higher)
        p.read(0)

    p.loop(0, guess)
    return p.source()


def parity():
    p = Program()
    p.read(0)
    p.add(0, -48)
    p.loop(0, lambda: (p.add(0, -1), p.equal(1, 0, lambda: p.set(1, 2)), p.add(1, -1)))
    p.equal(1, 0, lambda: p.literal("PAR"))
    p.equal(1, 1, lambda: p.literal("IMPAR"))
    return p.source()


def caesar():
    p = Program()
    p.read(0)
    p.loop(0, lambda: (p.equal(0, 122, lambda: p.set(0, 96)), p.add(0), p.output(0), p.read(0)))
    return p.source()


def gradient():
    p = Program()
    p.set(0, 16)
    p.loop(
        0,
        lambda: (
            p.set(1, 16),
            p.loop(1, lambda: (p.output(2), p.add(2, 16), p.add(1, -1))),
            p.add(0, -1),
        ),
    )
    return p.source()


def checker():
    p = Program()
    p.set(0, 8)

    def toggle():
        p.equal(2, 0, lambda: p.set(2, 2))
        p.add(2, -1)

    def pixel():
        p.clear(3)
        p.nonzero(2, lambda: p.add(3, -1))
        p.output(3)
        toggle()
        p.add(1, -1)

    p.loop(0, lambda: (p.set(1, 8), p.loop(1, pixel), toggle(), p.add(0, -1)))
    return p.source()


def diagonal():
    p = Program()
    p.set(0, 16)

    def row():
        p.set(1, 16)
        p.clear(3)

        def pixel():
            p.clear(4)
            p.equal_cells(2, 3, lambda: p.add(4, -1))
            p.output(4)
            p.add(3)
            p.add(1, -1)

        p.loop(1, pixel)
        p.add(2)
        p.add(0, -1)

    p.loop(0, row)
    return p.source()


def pulse():
    p = Program()
    p.set(0, 8)
    p.loop(
        0,
        lambda: (
            p.set(1, 64),
            p.loop(1, lambda: (p.output(2), p.add(1, -1))),
            p.add(2, 32),
            p.add(0, -1),
        ),
    )
    return p.source()


def scanline():
    p = Program()
    p.set(0, 8)

    def frame():
        p.clear(2)
        p.set(1, 8)

        def row():
            p.clear(5)
            p.equal_cells(2, 3, lambda: p.add(5, -1))
            p.set(4, 8)
            p.loop(4, lambda: (p.output(5), p.add(4, -1)))
            p.add(2)
            p.add(1, -1)

        p.loop(1, row)
        p.add(3)
        p.add(0, -1)

    p.loop(0, frame)
    return p.source()


BUILDERS = {
    "fibonacci": fibonacci,
    "division": division,
    "sort-pair": sort_pair,
    "calculator": calculator,
    "rot13": rot13,
    "guess": guessing,
    "parity": parity,
    "caesar": caesar,
    "pixels-gradient": gradient,
    "pixels-checker": checker,
    "pixels-diagonal": diagonal,
    "pixels-pulse": pulse,
    "pixels-scanline": scanline,
}

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "static/programs"
    for name, builder in BUILDERS.items():
        source = builder()
        if len(source) > 20000:
            raise RuntimeError(f"{name} exceeds the source budget")
        (root / (name + ".bf")).write_text(source)
        print(name, len(source.strip()))
