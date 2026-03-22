#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
THEME_FILE = FRONTEND_SRC / "theme.css"
HEX_PATTERN = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB_PATTERN = re.compile(r"\brgb\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)", re.IGNORECASE)
ALLOWED_EXTENSIONS = {
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".html",
}


def iter_candidate_files() -> list[Path]:
    files: list[Path] = []
    for path in FRONTEND_SRC.rglob("*"):
        if not path.is_file() or path == THEME_FILE:
            continue
        if path.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append(path)
    return files


def main() -> int:
    violations: list[str] = []

    for file_path in iter_candidate_files():
        text = file_path.read_text(encoding="utf-8")
        for line_number, line in enumerate(text.splitlines(), start=1):
            for match in HEX_PATTERN.finditer(line):
                rel_path = file_path.relative_to(REPO_ROOT)
                violations.append(
                    f"{rel_path}:{line_number}:{match.start() + 1}: "
                    f"hex color {match.group(0)} is only allowed in frontend/src/theme.css"
                )
            for match in RGB_PATTERN.finditer(line):
                rel_path = file_path.relative_to(REPO_ROOT)
                violations.append(
                    f"{rel_path}:{line_number}:{match.start() + 1}: "
                    f"rgb color {match.group(0)} is only allowed in frontend/src/theme.css"
                )

    if violations:
        print("Found disallowed hex/rgb colors outside frontend/src/theme.css:\n")
        print("\n".join(violations))
        return 1

    print("Hex/rgb color check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
