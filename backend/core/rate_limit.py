import ipaddress
import time
from collections import deque
from threading import Lock

from fastapi import Request

from core.errors import TooManyRequestsAppError
from core.settings import get_settings


_lock = Lock()
_request_windows: dict[str, deque[float]] = {}
_bucket_last_sweep_by_id: dict[int, float] = {}


def _extract_first_valid_ip(value: str | None) -> str | None:
    if not value:
        return None

    for part in value.split(","):
        candidate = part.strip()
        if not candidate:
            continue
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            continue

    return None


def _client_identifier(request: Request) -> str:
    settings = get_settings()
    source_ip = request.client.host if request.client and request.client.host else None

    if settings.rate_limit_trust_proxy:
        forwarded_ip = _extract_first_valid_ip(request.headers.get(settings.rate_limit_ip_header))
        if forwarded_ip:
            return forwarded_ip

    if source_ip:
        return source_ip

    return "unknown"


def _prune_window(entries: deque[float], now: float, window_seconds: int) -> None:
    threshold = now - window_seconds
    while entries and entries[0] <= threshold:
        entries.popleft()


def _get_entries_for_update(*, bucket: dict[str, deque[float]], key: str, now: float, window_seconds: int) -> deque[float]:
    entries = bucket.get(key)
    if entries is None:
        entries = deque()
        bucket[key] = entries
        return entries

    _prune_window(entries, now, window_seconds)
    if not entries:
        entries = deque()
        bucket[key] = entries

    return entries


def _get_entries_for_check(
    *,
    bucket: dict[str, deque[float]],
    key: str,
    now: float,
    window_seconds: int,
) -> deque[float] | None:
    entries = bucket.get(key)
    if entries is None:
        return None

    _prune_window(entries, now, window_seconds)
    if not entries:
        bucket.pop(key, None)
        return None

    return entries


def _maybe_sweep_bucket(*, bucket: dict[str, deque[float]], now: float, window_seconds: int) -> None:
    bucket_id = id(bucket)
    interval = max(1, min(window_seconds, 30))
    last_sweep = _bucket_last_sweep_by_id.get(bucket_id)
    if last_sweep is not None and now - last_sweep < interval:
        return

    for key in list(bucket):
        entries = bucket.get(key)
        if entries is None:
            continue

        _prune_window(entries, now, window_seconds)
        if not entries:
            bucket.pop(key, None)

    _bucket_last_sweep_by_id[bucket_id] = now


def _enforce_limit(
    *,
    bucket: dict[str, deque[float]],
    key: str,
    limit: int,
    window_seconds: int,
    detail: str,
) -> None:
    now = time.monotonic()
    with _lock:
        _maybe_sweep_bucket(bucket=bucket, now=now, window_seconds=window_seconds)
        entries = _get_entries_for_update(bucket=bucket, key=key, now=now, window_seconds=window_seconds)
        if len(entries) >= limit:
            raise TooManyRequestsAppError(detail)
        entries.append(now)


def _check_limit(
    *,
    bucket: dict[str, deque[float]],
    key: str,
    limit: int,
    window_seconds: int,
    detail: str,
) -> None:
    now = time.monotonic()
    with _lock:
        _maybe_sweep_bucket(bucket=bucket, now=now, window_seconds=window_seconds)
        entries = _get_entries_for_check(bucket=bucket, key=key, now=now, window_seconds=window_seconds)
        if entries is None:
            return
        if len(entries) >= limit:
            raise TooManyRequestsAppError(detail)


def _register_event(
    *,
    bucket: dict[str, deque[float]],
    key: str,
    window_seconds: int,
) -> None:
    now = time.monotonic()
    with _lock:
        _maybe_sweep_bucket(bucket=bucket, now=now, window_seconds=window_seconds)
        entries = _get_entries_for_update(bucket=bucket, key=key, now=now, window_seconds=window_seconds)
        entries.append(now)


def enforce_request_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return

    key = _client_identifier(request)
    _enforce_limit(
        bucket=_request_windows,
        key=key,
        limit=settings.rate_limit_max_requests,
        window_seconds=settings.rate_limit_window_seconds,
        detail="Too many requests",
    )


def clear_rate_limit_state() -> None:
    with _lock:
        _request_windows.clear()
        _bucket_last_sweep_by_id.clear()
