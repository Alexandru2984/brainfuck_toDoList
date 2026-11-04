"""Generate a Brainfuck comparator for a fixed-length SHA-256 hex digest.

The digest prevents plaintext-prefix timing leaks. The sticky mismatch flag
cannot wrap back to a successful match. The generated verifier is sensitive.
"""

import hashlib
import os
import sys


def generate_login_bf(password):
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    code = ["+>"]  # cell 0 = success (1), cell 1 = mismatch (0)
    for char in digest:
        code.append(">," + "-" * ord(char) + "[<[-]+>[-]]<")
    code.append(">,[<[-]+>,]<[<[-]>[-]]<" + "+" * 48 + ".")
    return "".join(code)


def main(argv):
    password = os.environ.get("BRAINFUCK_PASSWORD")
    if not password:
        raise SystemExit("Set BRAINFUCK_PASSWORD; optionally pass an output path.")
    code = generate_login_bf(password)
    if len(argv) > 1:
        # Exclusive creation and mode 600 avoid clobbering files or exposing a verifier.
        fd = os.open(argv[1], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as output:
            output.write(code)
        print("Sensitive verifier written; never commit it.", file=sys.stderr)
    else:
        sys.stdout.write(code)


if __name__ == "__main__":
    main(sys.argv)
