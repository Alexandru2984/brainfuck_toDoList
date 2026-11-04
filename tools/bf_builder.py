"""Small build-time assembler. Generated .bf files execute all algorithm logic.

Registers are physical BF cells. Structured helpers emit only the eight BF
instructions; they are never called by the web runtime.
"""

from contextlib import contextmanager


class Program:
    def __init__(self):
        self.parts = []
        self.ptr = 0
        self.used = set()

    def move(self, cell):
        delta = cell - self.ptr
        self.parts.append(">" * delta if delta >= 0 else "<" * -delta)
        self.ptr = cell

    def raw(self, code):
        self.parts.append(code)

    def add(self, cell, amount=1):
        self.move(cell)
        n = amount % 256
        self.raw("+" * n if n <= 128 else "-" * (256 - n))

    def clear(self, cell):
        self.move(cell)
        self.raw("[-]")

    def set(self, cell, value):
        self.clear(cell)
        self.add(cell, value)

    @contextmanager
    def temporary(self, count=1):
        cells = [i for i in range(16, 30) if i not in self.used][:count]
        if len(cells) != count:
            raise RuntimeError("Temporary register budget exceeded")
        self.used.update(cells)
        try:
            yield cells
        finally:
            for cell in cells:
                self.clear(cell)
            self.used.difference_update(cells)

    def transfer(self, source, target, replace=True):
        if source == target:
            raise ValueError("Distinct registers required")
        if replace:
            self.clear(target)
        self.move(source)
        self.raw("[")
        self.add(source, -1)
        self.add(target)
        self.move(source)
        self.raw("]")

    def copy(self, source, target):
        if source == target:
            return
        with self.temporary() as (temp,):
            self.clear(target)
            self.clear(temp)
            self.move(source)
            self.raw("[")
            self.add(source, -1)
            self.add(target)
            self.add(temp)
            self.move(source)
            self.raw("]")
            self.transfer(temp, source, replace=False)

    def loop(self, cell, body):
        self.move(cell)
        self.raw("[")
        body()
        self.move(cell)
        self.raw("]")

    def equal(self, source, value, body):
        with self.temporary(2) as (check, flag):
            self.copy(source, check)
            self.add(check, -value)
            self.set(flag, 1)
            self.loop(check, lambda: (self.clear(check), self.clear(flag)))
            self.loop(flag, lambda: (self.clear(flag), body(), self.clear(flag)))

    def nonzero(self, source, body):
        with self.temporary() as (flag,):
            self.copy(source, flag)
            self.loop(flag, lambda: (self.clear(flag), body(), self.clear(flag)))

    def greater_equal(self, left, right, target):
        """Unsigned byte comparison; operands remain unchanged."""
        with self.temporary(2) as (a, b):
            self.copy(left, a)
            self.copy(right, b)
            self.set(target, 1)

            def compare():
                self.equal(a, 0, lambda: (self.clear(target), self.clear(b)))
                self.nonzero(a, lambda: (self.add(a, -1), self.add(b, -1)))

            self.loop(b, compare)

    def equal_cells(self, left, right, body):
        with self.temporary(2) as (a, b):
            self.copy(left, a)
            self.copy(right, b)
            self.loop(b, lambda: (self.add(b, -1), self.add(a, -1)))
            self.equal(a, 0, body)

    def read(self, cell):
        self.move(cell)
        self.raw(",")

    def output(self, cell):
        self.move(cell)
        self.raw(".")

    def literal(self, text, cell=14):
        for byte in text.encode("utf-8"):
            self.set(cell, byte)
            self.output(cell)

    def array(self, base, index, value, write=False):
        """Indexed access using BF counters, breadcrumbs and a carried byte.

        Slots: counter, value, breadcrumb, carrier. Cells base-2/base-1 must
        remain zero. The return walk drains its counters and breadcrumbs.
        """
        self.copy(index, base)
        if write:
            self.copy(value, base + 3)
        self.move(base)
        walk = "[-[->>>>+<<<<]>>+>[->>>>+<<<<]>]"
        access = ">[-]>>[-<<+>>]<<<" if write else ">[<+>>+<-]>[<+>-]<<"
        back = "<<[[-]>>[-<<<<+>>>>]<<<<<<]>>"
        self.raw(walk + access + back)
        self.ptr = base
        if not write:
            self.transfer(base, value)

    def source(self):
        # Adjacent pointer runs can cancel between build-time helpers.
        code = "".join(self.parts)
        while "><" in code or "<>" in code:
            code = code.replace("><", "").replace("<>", "")
        return code + "\n"
