"""Assemble interactive BF programs; no parsing or arithmetic runs in web Python."""

from pathlib import Path

from bf_builder import Program


def say(p, text):
    """Emit a literal with relative byte changes; cell 14 is scratch."""
    previous = 0
    p.clear(14)
    for byte in text.encode("utf-8"):
        p.add(14, byte - previous)
        p.output(14)
        previous = byte


def number(p):
    """Read ASCII decimal through LF/NUL: value 1, valid 2, digit count 3, EOF 5.

    Invalid lines drain through the terminator. Registers 0..10 are scratch.
    Overflow is rejected before multiplication; the number never wraps silently.
    """
    p.clear(1)
    p.set(2, 1)
    p.clear(3)
    p.clear(5)
    p.set(4, 1)
    p.read(0)

    def digit():
        p.add(0, -48)
        p.set(8, 10)
        p.greater_equal(0, 8, 7)
        p.nonzero(7, lambda: p.clear(2))

        def validate():
            p.add(3)
            p.equal(3, 4, lambda: p.clear(2))
            p.set(8, 26)
            p.greater_equal(1, 8, 7)
            p.nonzero(7, lambda: p.clear(2))

            def last_digit():
                p.set(8, 6)
                p.greater_equal(0, 8, 7)
                p.nonzero(7, lambda: p.clear(2))

            p.equal(1, 25, last_digit)

        p.nonzero(2, validate)

        def accumulate():
            p.transfer(1, 9)
            p.loop(9, lambda: (p.add(9, -1), p.add(1, 10)))
            p.transfer(0, 1, replace=False)

        p.nonzero(2, accumulate)
        p.read(0)

    def scan():
        p.equal(0, 0, lambda: (p.set(5, 1), p.clear(4)))
        p.equal(0, 10, lambda: p.clear(4))
        p.nonzero(4, digit)

    p.loop(4, scan)
    p.equal(3, 0, lambda: p.clear(2))


def decimal(p, value):
    """Print any unsigned byte; value is preserved, 0/9..13 are scratch."""
    p.copy(value, 9)
    for cell in (0, 10, 11):
        p.clear(cell)
    p.set(13, 10)

    def carry():
        p.clear(0)
        p.set(13, 10)
        p.add(10)
        p.equal(10, 10, lambda: (p.clear(10), p.add(11)))

    p.loop(9, lambda: (p.add(9, -1), p.add(0), p.add(13, -1), p.equal(13, 0, carry)))
    p.clear(12)
    p.nonzero(11, lambda: (p.set(12, 1), p.add(11, 48), p.output(11)))
    p.nonzero(10, lambda: p.set(12, 1))
    p.nonzero(12, lambda: (p.add(10, 48), p.output(10)))
    p.add(0, 48)
    p.output(0)


def echo():
    p = Program()
    say(p, "Ecou UTF-8. EOF pentru stop.\n")
    p.read(0)
    p.loop(0, lambda: (p.output(0), p.read(0)))
    say(p, "\nGata.\n")
    return p.source()


def normalize():
    p = Program()
    say(p, "Numar (0..255): ")
    number(p)
    p.copy(2, 32)
    p.copy(1, 33)
    p.nonzero(32, lambda: (say(p, "Valoare: "), decimal(p, 33), say(p, "\n")))
    p.equal(32, 0, lambda: say(p, "Input invalid.\n"))
    return p.source()


def calculator():
    p = Program()
    say(p, "A (0..255): ")
    number(p)
    p.copy(1, 32)
    p.copy(2, 35)
    p.nonzero(5, lambda: p.clear(35))

    def operator():
        say(p, "Operator (+ - *): ")
        p.read(33)
        p.clear(6)
        for op in "+-*":
            p.equal(33, ord(op), lambda: p.set(6, 1))
        p.equal(6, 0, lambda: p.clear(35))
        p.read(0)
        p.clear(6)
        p.equal(0, 10, lambda: p.set(6, 1))
        p.equal(6, 0, lambda: p.clear(35))
        p.equal(0, 10, lambda: p.clear(0))
        p.loop(0, lambda: (p.read(0), p.equal(0, 10, lambda: p.clear(0))))

    p.nonzero(35, operator)

    def operand():
        say(p, "B (0..255): ")
        number(p)
        p.copy(1, 34)
        p.copy(2, 35)

    p.nonzero(35, operand)

    def calculate():
        p.equal(33, ord("+"), lambda: p.transfer(34, 32, replace=False))
        p.equal(33, ord("-"), lambda: p.loop(34, lambda: (p.add(34, -1), p.add(32, -1))))

        def multiply():
            p.copy(32, 0)
            p.copy(34, 1)
            p.clear(2)
            p.clear(3)

            def iteration():
                p.add(1, -1)
                p.loop(0, lambda: (p.add(0, -1), p.add(2), p.add(3)))
                p.transfer(3, 0)

            p.loop(1, iteration)
            p.transfer(2, 32)

        p.equal(33, ord("*"), multiply)
        say(p, "Rezultat mod 256: ")
        decimal(p, 32)
        say(p, "\n")

    p.nonzero(35, calculate)
    p.equal(35, 0, lambda: say(p, "Input invalid sau incomplet.\n"))
    return p.source()


def byte_dump():
    p = Program()
    say(p, "Text UTF-8. EOF pentru stop.\n")
    p.read(32)
    p.loop(32, lambda: (decimal(p, 32), say(p, " "), p.read(32)))
    say(p, "\n")
    return p.source()


def guessing():
    p = Program()
    p.set(32, 5)
    p.set(33, 37)
    say(p, "Ghici numarul 0..255. Ai 5 incercari.\n")

    def attempt():
        say(p, "Numar (0..255): ")
        number(p)
        p.copy(1, 34)
        p.copy(2, 35)
        p.add(32, -1)
        p.equal(35, 0, lambda: say(p, "Input invalid.\n"))

        def compare():
            p.greater_equal(34, 33, 36)
            p.equal(36, 0, lambda: say(p, "MAI MARE\n"))
            p.nonzero(36, lambda: say(p, "MAI MIC\n"))
            # Equal is handled before the hints, so a correct guess emits only CORECT.

        p.clear(37)
        p.nonzero(35, lambda: p.equal_cells(34, 33, lambda: p.set(37, 1)))
        p.nonzero(37, lambda: (say(p, "CORECT\n"), p.clear(32)))
        p.equal(37, 0, lambda: p.nonzero(35, compare))
        p.nonzero(5, lambda: p.clear(32))

    p.loop(32, attempt)
    say(p, "Sfarsit de joc.\n")
    return p.source()


BUILDERS = {
    "terminal-echo": echo,
    "terminal-decimal": normalize,
    "terminal-calculator": calculator,
    "terminal-bytes": byte_dump,
    "terminal-guess": guessing,
}

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "static/programs"
    for name, build in BUILDERS.items():
        code = build()
        if len(code) > 20000:
            raise RuntimeError(f"{name} exceeds the source budget: {len(code)}")
        (root / (name + ".bf")).write_text(code)
        print(name, len(code.strip()))
