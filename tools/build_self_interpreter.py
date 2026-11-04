"""Build a Brainfuck self-interpreter with 16 virtual cells and 31 commands.

Protocol: compact source + ! + input bytes. All parsing, dispatch, virtual
memory accesses and bracket matching below become Brainfuck instructions.
The browser supplies the framed bytes and enforces resource bounds only.
"""

from pathlib import Path

from bf_builder import Program


def build():
    p = Program()
    run, ip, dp, op, value, depth, scan, char = range(8)
    code, memory = 32, 164
    p.read(char)
    p.copy(char, scan)
    p.add(scan, -33)

    def load():
        p.array(code, ip, char, write=True)
        p.add(ip)
        p.read(char)
        p.copy(char, scan)
        p.add(scan, -33)

    p.loop(scan, load)
    p.clear(ip)
    p.set(run, 1)

    def execute():
        p.array(code, ip, op)
        p.equal(op, 0, lambda: p.clear(run))

        def right():
            p.add(dp)
            p.equal(dp, 16, lambda: p.clear(dp))

        def left():
            p.equal(dp, 0, lambda: p.set(dp, 16))
            p.add(dp, -1)

        p.equal(op, ord(">"), right)
        p.equal(op, ord("<"), left)
        for command, delta in [("+", 1), ("-", -1)]:

            def arithmetic(delta=delta):
                p.array(memory, dp, value)
                p.add(value, delta)
                p.array(memory, dp, value, write=True)

            p.equal(op, ord(command), arithmetic)

        def output():
            p.array(memory, dp, value)
            p.output(value)

        def input_byte():
            p.read(value)
            p.array(memory, dp, value, write=True)

        def matching(direction):
            p.set(depth, 1)

            def search():
                p.add(ip, direction)
                p.array(code, ip, scan)
                p.equal(scan, ord("[" if direction == 1 else "]"), lambda: p.add(depth))
                p.equal(scan, ord("]" if direction == 1 else "["), lambda: p.add(depth, -1))

            p.loop(depth, search)

        def opening():
            p.array(memory, dp, value)
            p.equal(value, 0, lambda: matching(1))

        def closing():
            p.array(memory, dp, value)
            p.nonzero(value, lambda: matching(-1))

        p.equal(op, ord("."), output)
        p.equal(op, ord(","), input_byte)
        p.equal(op, ord("["), opening)
        p.equal(op, ord("]"), closing)
        p.add(ip)

    p.loop(run, execute)
    return p.source()


if __name__ == "__main__":
    target = Path(__file__).resolve().parents[1] / "static/programs/self-interpreter.bf"
    source = build()
    target.write_text(source)
    print(f"Self-interpreter: {len(source.strip())} BF commands")
