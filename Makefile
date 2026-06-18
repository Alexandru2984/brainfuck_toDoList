.PHONY: install install-dev lint format test check

PYTHON ?= python3

install:
	$(PYTHON) -m pip install -r requirements.txt

install-dev:
	$(PYTHON) -m pip install -r requirements-dev.txt

lint:
	$(PYTHON) -m ruff check .

format:
	$(PYTHON) -m ruff format .

test:
	PYTHONWARNINGS=error $(PYTHON) -m unittest

check: lint test
