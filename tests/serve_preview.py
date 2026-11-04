"""Isolated HTTP server for browser checks; never open a production database."""

import os
import signal
import sys
import tempfile
from pathlib import Path


def main():
    def stop(_signum, _frame):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, stop)
    with tempfile.TemporaryDirectory(prefix="brainfuck-browser-") as state:
        os.environ.update(
            {
                "BRAINFUCK_DB_FILE": str(Path(state) / "preview.db"),
                "BRAINFUCK_PASSWORD": "browser-test-password",
                "BRAINFUCK_SECRET_KEY": "isolated-browser-test-secret",
                "BRAINFUCK_ENCRYPTION_KEY": "",
                "BRAINFUCK_COOKIE_SECURE": "0",
                "BRAINFUCK_SECURITY_HEADERS_ENABLED": "1",
                "BRAINFUCK_TRUST_PROXY": "0",
                "BRAINFUCK_TRUSTED_HOSTS": "127.0.0.1,localhost",
                "BRAINFUCK_MAX_TASK_LENGTH": "500",
                "BRAINFUCK_LOG_LEVEL": "WARNING",
            }
        )
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from app import app

        app.run(host="127.0.0.1", port=38173, debug=False, use_reloader=False)


if __name__ == "__main__":
    main()
