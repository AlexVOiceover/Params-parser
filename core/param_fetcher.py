"""Fetch and cache ArduCopter parameter definitions from ArduPilot's autotest server.

Source: https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json
This file is auto-generated daily from ArduPilot source code.

The JSON is a two-level structure:
    { "GROUP_PREFIX_": { "PARAM_NAME": { metadata... }, ... }, ... }

We cache both the flat {param_name: metadata} dict AND the ordered list of
group prefixes so the UI can group params the same way ArduPilot does.
"""

import json
import time
from pathlib import Path

PDEF_URL = "https://autotest.ardupilot.org/Parameters/ArduCopter/apm.pdef.json"
CACHE_TTL_SECONDS = 24 * 3600  # 24 hours

_DATA_DIR  = Path(__file__).parent.parent / "data"
CACHE_FILE = _DATA_DIR / "apm_pdef_cache.json"


# ── Cache helpers ──────────────────────────────────────────────────────────────

def _load_cache() -> dict | None:
    """Return the full cache dict if it is fresh, else None."""
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cached = json.load(f)
        if time.time() - cached.get("_cached_at", 0) < CACHE_TTL_SECONDS:
            return cached
    except (json.JSONDecodeError, OSError):
        pass
    return None


def _load_cache_any() -> dict | None:
    """Return the cache dict regardless of age (stale fallback)."""
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def _save_cache(params: dict, groups: list[str]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "_cached_at": time.time(),
        "params": params,
        "groups": groups,       # ordered list of pdef group prefixes
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f)


# ── pdef parsing ───────────────────────────────────────────────────────────────

def _parse_pdef(raw: dict) -> tuple[dict, list[str]]:
    """Parse raw apm.pdef.json into (flat_params, ordered_group_prefixes).

    group_prefixes are the top-level keys of the JSON, e.g.
        ["", "ADSB_", "AFS_", "AHRS_", "ATC_", "AUTOTUNE_", ...]
    They define ArduPilot's official subsystem groupings.
    """
    flat   = {}
    groups = []
    for group_key, members in raw.items():
        if not isinstance(members, dict):
            continue
        groups.append(group_key)
        for name, meta in members.items():
            if isinstance(meta, dict):
                flat[name] = meta
    return flat, groups


# ── Public API ─────────────────────────────────────────────────────────────────

def fetch_param_definitions(force_refresh: bool = False) -> dict:
    """Return flat {param_name: metadata} dict.

    Uses a 24-hour local cache.  Pass force_refresh=True to bypass it.
    """
    if not force_refresh:
        cached = _load_cache()
        if cached is not None:
            return cached.get("params", {})

    try:
        import requests
        response = requests.get(PDEF_URL, timeout=30)
        response.raise_for_status()
        params, groups = _parse_pdef(response.json())
        _save_cache(params, groups)
        return params
    except Exception as exc:
        stale = _load_cache_any()
        if stale:
            return stale.get("params", {})
        raise RuntimeError(f"Failed to fetch param definitions: {exc}") from exc


def get_param_groups(force_refresh: bool = False) -> list[str]:
    """Return the ordered list of ArduPilot pdef group prefixes from cache.

    E.g. ["", "ADSB_", "AFS_", "AHRS_", "ATC_", ...]
    Returns [] if no cache exists yet.
    """
    if force_refresh:
        fetch_param_definitions(force_refresh=True)

    cached = _load_cache() or _load_cache_any()
    if cached:
        return cached.get("groups", [])
    return []


def get_cached_timestamp() -> float | None:
    cached = _load_cache_any()
    return cached.get("_cached_at") if cached else None


def cache_age_str() -> str:
    ts = get_cached_timestamp()
    if ts is None:
        return "No cache"
    age = int(time.time() - ts)
    if age < 60:
        return f"{age}s ago"
    if age < 3600:
        return f"{age // 60}m ago"
    h, m = age // 3600, (age % 3600) // 60
    return f"{h}h {m}m ago"
