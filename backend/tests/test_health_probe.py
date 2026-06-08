"""S15 — live-LLM reachability probe (the headline that un-gates Live).

Asserts the probe is real, cached, fast, and exception-safe; offline → never
"ok"; /health never hangs. All offline (httpx is mocked — no network).
"""
from __future__ import annotations

import threading
import time

import httpx
import pytest
from fastapi.testclient import TestClient

import app.services.health_probe as hp
from app.main import app
from app.settings import Settings


@pytest.fixture(autouse=True)
def _clean_cache():
    hp.reset_health_cache_for_tests()
    yield
    hp.reset_health_cache_for_tests()


# ── _probe_once: pure, exception-safe, contract values ──────────────────────

def test_probe_offline_is_disabled() -> None:
    assert hp._probe_once("http://x/v1", "key", offline=True) == "disabled"


def test_probe_missing_key_or_base_is_disabled() -> None:
    assert hp._probe_once("http://x/v1", "", offline=False) == "disabled"
    assert hp._probe_once("", "key", offline=False) == "disabled"


def test_probe_unreachable_on_timeout(monkeypatch) -> None:
    def boom(*_a, **_k):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(hp.httpx, "get", boom)
    assert hp._probe_once("http://x/v1", "key", offline=False, timeout=0.1) == "unreachable"


def test_probe_unreachable_on_connection_error(monkeypatch) -> None:
    def boom(*_a, **_k):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(hp.httpx, "get", boom)
    assert hp._probe_once("http://x/v1", "key", offline=False) == "unreachable"


def test_probe_ok_on_2xx(monkeypatch) -> None:
    monkeypatch.setattr(
        hp.httpx, "get",
        lambda *a, **k: httpx.Response(200, json={"data": []}),
    )
    assert hp._probe_once("http://x/v1", "key", offline=False) == "ok"


def test_probe_unreachable_on_401(monkeypatch) -> None:
    # Reachable but key rejected → NOT "ok" (Live must stay gated).
    monkeypatch.setattr(
        hp.httpx, "get", lambda *a, **k: httpx.Response(401, json={"error": "bad key"})
    )
    assert hp._probe_once("http://x/v1", "key", offline=False) == "unreachable"


def test_probe_never_raises_on_weird_error(monkeypatch) -> None:
    monkeypatch.setattr(hp.httpx, "get", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    # Must swallow ANY exception into a status, never propagate.
    assert hp._probe_once("http://x/v1", "key", offline=False) == "unreachable"


# ── get_llm_status: caching + offline + non-blocking ────────────────────────

def test_status_offline_is_disabled(monkeypatch) -> None:
    monkeypatch.setattr(hp, "settings", Settings(OFFLINE_MODE=True))
    monkeypatch.setattr(hp, "_read_endpoint", lambda: ("http://x/v1", "key"))
    assert hp.get_llm_status() == "disabled"


def test_status_blocking_caches_and_does_not_rehit(monkeypatch) -> None:
    monkeypatch.setattr(hp, "settings", Settings(OFFLINE_MODE=False, LLM_PROBE_CACHE_TTL_S=60))
    monkeypatch.setattr(hp, "_read_endpoint", lambda: ("http://x/v1", "key"))
    calls = {"n": 0}

    def counting_probe(*_a, **_k):
        calls["n"] += 1
        return "ok"

    monkeypatch.setattr(hp, "_probe_once", counting_probe)

    assert hp.get_llm_status(block=True) == "ok"
    assert hp.get_llm_status(block=True) == "ok"  # served from cache
    assert calls["n"] == 1  # probe hit exactly once within the TTL


def test_status_non_blocking_never_hangs_even_with_slow_probe(monkeypatch) -> None:
    monkeypatch.setattr(hp, "settings", Settings(OFFLINE_MODE=False, LLM_PROBE_CACHE_TTL_S=60))
    monkeypatch.setattr(hp, "_read_endpoint", lambda: ("http://x/v1", "key"))

    # The bg probe blocks until WE release it (5 s is a safety ceiling, not a
    # real wait) so we can prove /health returns without waiting on it.
    release = threading.Event()

    def slow_probe(*_a, **_k):
        release.wait(timeout=5.0)
        return "ok"

    monkeypatch.setattr(hp, "_probe_once", slow_probe)

    t0 = time.monotonic()
    status = hp.get_llm_status()  # non-blocking → returns last-known / unchecked
    elapsed = time.monotonic() - t0

    assert status == "unchecked"  # first online call, bg probe still running
    assert elapsed < 1.0  # did NOT wait on the (blocked) probe

    # Release the bg thread and wait for the refresh to fully complete BEFORE the
    # test returns, so it can't write the module-global cache after teardown
    # (otherwise a reordered run could see a stale "ok"). _refreshing flips False
    # only after _run stores the result.
    release.set()
    for _ in range(200):
        if not hp._refreshing:
            break
        time.sleep(0.01)
    assert not hp._refreshing


# ── /health endpoint: real field, offline-safe, fast ────────────────────────

def test_health_endpoint_reports_llm_field_offline() -> None:
    # conftest sets OFFLINE_MODE=true → deterministically "disabled", never "ok".
    with TestClient(app) as client:
        payload = client.get("/api/health").json()
    assert payload["llm"] in {"disabled", "unreachable", "unchecked"}
    assert payload["llm"] != "ok"


def test_health_endpoint_surfaces_ok(monkeypatch) -> None:
    # When the probe reports reachable, /health surfaces "ok" (un-gates Live).
    import app.routers.health as health_router

    monkeypatch.setattr(health_router, "get_llm_status", lambda: "ok")
    with TestClient(app) as client:
        payload = client.get("/api/health").json()
    assert payload["llm"] == "ok"
