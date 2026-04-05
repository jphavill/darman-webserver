import pytest
from fastapi import Request

from core import rate_limit
from core.errors import TooManyRequestsAppError


def _build_request(
    *,
    client_host: str,
    forwarded_ip: str | None = None,
    method: str = "GET",
    path: str = "/v1/sprints",
) -> Request:
    headers: list[tuple[bytes, bytes]] = []
    if forwarded_ip is not None:
        headers.append((b"cf-connecting-ip", forwarded_ip.encode("utf-8")))

    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("utf-8"),
            "query_string": b"",
            "headers": headers,
            "client": (client_host, 12345),
            "server": ("testserver", 80),
        }
    )


def test_client_identifier_ignores_forwarded_header_when_proxy_trust_disabled(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "false")

    request = _build_request(client_host="10.0.0.2", forwarded_ip="203.0.113.9")

    assert rate_limit._client_identifier(request) == "10.0.0.2"


def test_client_identifier_uses_forwarded_header_when_proxy_trust_enabled(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "true")

    request = _build_request(client_host="10.0.0.2", forwarded_ip="203.0.113.9")

    assert rate_limit._client_identifier(request) == "203.0.113.9"


def test_client_identifier_falls_back_to_client_host_on_invalid_forwarded_header(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "true")

    request = _build_request(client_host="10.0.0.2", forwarded_ip="not-an-ip")

    assert rate_limit._client_identifier(request) == "10.0.0.2"


def test_request_limit_keying_changes_when_proxy_trust_enabled(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "true")

    first = _build_request(client_host="10.0.0.2", forwarded_ip="203.0.113.9")
    second = _build_request(client_host="10.0.0.2", forwarded_ip="198.51.100.4")

    rate_limit.enforce_request_limit(first)
    rate_limit.enforce_request_limit(second)


def test_request_limit_is_per_client_not_per_path(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")

    first = _build_request(client_host="10.0.0.2", path="/v1/sprints")
    second = _build_request(client_host="10.0.0.2", path="/v1/people")

    rate_limit.enforce_request_limit(first)
    with pytest.raises(TooManyRequestsAppError):
        rate_limit.enforce_request_limit(second)


def test_stale_request_keys_are_cleaned_up(monkeypatch):
    clock = {"value": 0.0}
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock["value"])

    bucket: dict[str, rate_limit.deque[float]] = {}
    rate_limit._register_event(bucket=bucket, key="stale", window_seconds=1)
    assert "stale" in bucket

    clock["value"] = 2.0
    rate_limit._check_limit(bucket=bucket, key="stale", limit=1, window_seconds=1, detail="test")

    assert "stale" not in bucket
