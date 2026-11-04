"""Never let test-module imports initialize a developer or production database."""

import atexit
import os
import tempfile
from pathlib import Path

_state = tempfile.TemporaryDirectory(prefix="brainfuck-tests-")
atexit.register(_state.cleanup)
os.environ["BRAINFUCK_DB_FILE"] = str(Path(_state.name) / "import.db")
os.environ["BRAINFUCK_SECRET_KEY"] = "test-secret"
os.environ["BRAINFUCK_PASSWORD"] = "test-password"
os.environ["BRAINFUCK_TRUST_PROXY"] = "0"
