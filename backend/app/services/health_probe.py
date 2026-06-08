"""S15 — real, fast, cached live-LLM reachability probe for ``GET /health``.

Replaces the old hardcoded ``"llm": "unchecked"``. The probe reads the AI-Grid
endpoint + key from ``akn_rlm.config`` (READ-ONLY — never edits the package) and
does the cheapest reliable reachability check: a short-timeout GET on the
OpenAI-compatible ``{base}/models`` (the AI-Grid gateway is litellm, port 4000,
which answers 200 there). Contract values:

    "ok"          — endpoint reachable AND usable (2xx). Live un-gates on this.
    "unreachable" — a real probe failed (timeout / connection / non-2xx / bad key).
    "disabled"    — deterministic, no network: OFFLINE_MODE, or no key / base url.
    "unchecked"   — never probed yet (first online call, before the bg probe lands).

Design guarantees (offline-first is sacred):
  * NEVER raises — any error/timeout/missing-key/offline → a status string.
  * NEVER hangs ``/health`` — the cheap "disabled" verdict is computed inline and
    is instant; the actual HTTP probe runs on a background thread and ``/health``
    returns the last-known value (or ``"unchecked"`` the very first time).
  * Cached with a short TTL so /health is instant and the endpoint isn't hammered.

Only ``2xx`` counts as ``"ok"`` — a ``401``/``403`` (reachable but key rejected)
stays ``"unreachable"`` so Live never un-gates against an endpoint that would then
fail every query.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Literal

import httpx

from ..settings import settings

LlmStatus = Literal["ok", "unreachable", "disabled", "unchecked"]

_lock = threading.Lock()
_cache_value: LlmStatus | None = None
_cache_expiry: float = 0.0
_refreshing: bool = False


def _read_endpoint() -> tuple[str, str]:
    """Read ``(base_url, api_key)`` from ``akn_rlm.config`` (read-only).

    Falls back to ``os.environ`` if the import fails, so a packaging hiccup can
    never crash the probe. ``os.getenv`` is also consulted as a freshness
    override (the config module snapshots env at import time; a server that sets
    the key after import would otherwise read the stale empty default).
    """
    base_url, api_key = "", ""
    try:
        from akn_rlm import config as akn_config

        base_url = getattr(akn_config, "AI_GRID_BASE_URL", "") or ""
        api_key = getattr(akn_config, "AI_GRID_API_KEY", "") or ""
    except Exception:
        pass
    base_url = os.getenv("AI_GRID_BASE_URL", base_url) or base_url
    api_key = os.getenv("AI_GRID_API_KEY", api_key) or api_key
    return base_url, api_key


def _probe_once(
    base_url: str,
    api_key: str,
    *,
    offline: bool,
    timeout: float | None = None,
) -> LlmStatus:
    """Synchronous, exception-safe single probe. Pure (all inputs explicit) so it
    is directly unit-testable. Returns a contract status; never raises."""
    if offline:
        return "disabled"
    if not api_key or not base_url:
        return "disabled"

    if timeout is None:
        timeout = float(settings.LLM_PROBE_TIMEOUT_S)
    url = base_url.rstrip("/") + "/models"
    try:
        resp = httpx.get(
            url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )
    except Exception:
        return "unreachable"
    # Only a clean 2xx means reachable AND usable. 401/403/404/5xx → not "ok"
    # (reachable-but-broken would only fail every live query, so keep Live gated).
    return "ok" if resp.is_success else "unreachable"


def _store(status: LlmStatus) -> LlmStatus:
    global _cache_value, _cache_expiry
    with _lock:
        _cache_value = status
        _cache_expiry = time.monotonic() + float(settings.LLM_PROBE_CACHE_TTL_S)
    return status


def _spawn_refresh(base_url: str, api_key: str, offline: bool) -> None:
    """Refresh the cached status off the request path. At most one in flight."""
    global _refreshing
    with _lock:
        if _refreshing:
            return
        _refreshing = True

    def _run() -> None:
        global _refreshing
        try:
            status = _probe_once(base_url, api_key, offline=offline)
        except Exception:
            status = "unreachable"
        with _lock:
            _store_locked(status)
            _refreshing = False

    threading.Thread(target=_run, name="llm-health-probe", daemon=True).start()


def _store_locked(status: LlmStatus) -> None:
    global _cache_value, _cache_expiry
    _cache_value = status
    _cache_expiry = time.monotonic() + float(settings.LLM_PROBE_CACHE_TTL_S)


def get_llm_status(*, block: bool = False) -> LlmStatus:
    """Return the cached live-LLM status. Request-path safe (never blocks unless
    ``block=True``).

    * OFFLINE_MODE / no key / no base url → ``"disabled"`` instantly (no network).
    * cache fresh → the cached value.
    * cache stale + ``block`` → run the probe synchronously (startup warm / tests).
    * cache stale + not ``block`` → spawn a background refresh, return last-known
      (or ``"unchecked"`` the first time) so ``/health`` never hangs.
    """
    base_url, api_key = _read_endpoint()
    offline = bool(settings.OFFLINE_MODE)

    # Cheap deterministic verdict — exact and instant, no network.
    if offline or not api_key or not base_url:
        return _store("disabled")

    now = time.monotonic()
    with _lock:
        fresh = _cache_value is not None and now < _cache_expiry
        if fresh:
            return _cache_value  # type: ignore[return-value]
        last_known = _cache_value

    if block:
        return _store(_probe_once(base_url, api_key, offline=offline))

    _spawn_refresh(base_url, api_key, offline)
    return last_known if last_known is not None else "unchecked"


def reset_health_cache_for_tests() -> None:
    """Clear the module-level cache so a test starts from a known state."""
    global _cache_value, _cache_expiry, _refreshing
    with _lock:
        _cache_value = None
        _cache_expiry = 0.0
        _refreshing = False
