def collapse_whitespace(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_name(value: str) -> str:
    return collapse_whitespace(value).casefold()
