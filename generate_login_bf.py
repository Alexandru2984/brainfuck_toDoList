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

    bf_code = generate_login_bf(password)

    # SECURITY: the generated Brainfuck encodes each password character as a run
    # of '-' equal to its ASCII code, so the file is a plaintext-equivalent of the
    # password. Default to stdout and require an explicit path to write a file, so
    # the verifier is never accidentally committed. The app generates this code in
    # memory at startup; no file is needed at runtime.
    if len(argv) > 2:
        Path(argv[2]).write_text(bf_code)
        print(
            f"WARNING: wrote login verifier to {argv[2]}. It reveals the password — "
            "do not commit it (login.bf is git-ignored).",
            file=sys.stderr,
        )
    else:
        sys.stdout.write(bf_code)


if __name__ == "__main__":
    main(sys.argv)
