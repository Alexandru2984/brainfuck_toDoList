import os
import sys
from pathlib import Path


def generate_login_bf(password):
    if not password:
        raise ValueError("password must not be empty")

    bf = ""
    # Cell 0: result (49 = '1'), Cell 1: is_wrong (0), Cell 2: temp_input (0)
    bf += "+" * 49 + "\n"
    bf += ">\n"  # move to Cell 1 (is_wrong)

    for char in password:
        ascii_val = ord(char)
        bf += "> , "  # move to Cell 2 and read
        bf += "-" * ascii_val + " "
        bf += "[ < + > [-] ]\n"  # if Cell 2 != 0, increment Cell 1 and zero Cell 2
        bf += "<\n"  # move back to Cell 1 so next loop "> ," works correctly

    # Now at Cell 1. Check if there are more characters (password too long).
    bf += "> , "  # move to Cell 2 and read
    bf += "[ < + > , ]\n"  # if Cell 2 != 0, increment Cell 1, move back, read next char

    # Now at Cell 2. Move to Cell 1.
    bf += "<\n"

    # Now at Cell 1. If not 0, subtract 1 from Cell 0.
    bf += "[ < - > [-] ]\n"

    # Move to Cell 0 and print.
    bf += "< .\n"
    return bf


def main(argv):
    password = argv[1] if len(argv) > 1 else os.environ.get("BRAINFUCK_PASSWORD")
    if not password:
        raise SystemExit("Usage: generate_login_bf.py <password> [output_path]")

    output_path = Path(argv[2]) if len(argv) > 2 else Path("login.bf")
    output_path.write_text(generate_login_bf(password))


if __name__ == "__main__":
    main(sys.argv)
