"""Reproducibly build the task presentation program, implemented in Brainfuck."""

from pathlib import Path


def literal(text):
    current = 0
    code = ["[-]"]
    for byte in text.encode("utf-8"):
        delta = (byte - current) % 256
        code.append("+" * delta if delta <= 128 else "-" * (256 - delta))
        code.append(".")
        current = byte
    return "".join(code) + "[-]"


def build():
    return (
        literal(
            '<div class="task-item"><span class="bf-label">🧠 Brainfuck</span>'
            '<div class="task-title">'
        )
        + ",[-.,]"
        + literal("</div></div>")
        + "\n"
    )


if __name__ == "__main__":
    (Path(__file__).resolve().parents[1] / "format_task.bf").write_text(build())
