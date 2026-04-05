def collapse_whitespace(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_name(value: str) -> str:
    return collapse_whitespace(value).casefold()


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = collapse_whitespace(value)
    return normalized or None
