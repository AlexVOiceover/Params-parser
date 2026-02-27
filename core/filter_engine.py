"""Apply protection rules to a list of parameters.

Protection list JSON format:
{
    "name": "Human-readable name",
    "description": "What this list protects",
    "rules": [
        {"type": "exact",  "value": "PARAM_NAME"},
        {"type": "prefix", "value": "COMPASS_OFS"}
    ]
}

Rule types:
  exact  — param name must match exactly
  prefix — param name must start with the given string
"""

import json
import os
from pathlib import Path

_DATA_DIR = Path(__file__).parent.parent / "data" / "protection_lists"


def load_protection_lists() -> list[dict]:
    """Load all protection list JSON files from the protection_lists directory."""
    lists = []
    if not _DATA_DIR.exists():
        return lists
    for path in sorted(_DATA_DIR.glob("*.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["_file"] = str(path)
            lists.append(data)
        except (json.JSONDecodeError, OSError):
            pass
    return lists


def save_protection_list(plist: dict) -> None:
    """Save a protection list back to its file."""
    path = plist.get("_file")
    if not path:
        raise ValueError("Protection list has no _file path")
    payload = {k: v for k, v in plist.items() if not k.startswith("_")}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def create_protection_list(name: str, description: str = "") -> dict:
    """Create and persist a new empty protection list, return it."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Derive filename from name
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name).lower()
    path = _DATA_DIR / f"{safe}.json"
    # Avoid collisions
    counter = 1
    while path.exists():
        path = _DATA_DIR / f"{safe}_{counter}.json"
        counter += 1
    plist = {"name": name, "description": description, "rules": [], "_file": str(path)}
    save_protection_list(plist)
    return plist


def delete_protection_list(plist: dict) -> None:
    """Delete a protection list file."""
    path = plist.get("_file")
    if path and os.path.exists(path):
        os.remove(path)


def matches_rule(param_name: str, rule: dict) -> bool:
    """Return True if param_name matches the given rule."""
    rule_type = rule.get("type", "exact")
    value = rule.get("value", "")
    if rule_type == "exact":
        return param_name == value
    if rule_type == "prefix":
        return param_name.startswith(value)
    return False


def apply_filter(
    params: list[tuple[str, str]],
    rules: list[dict],
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Split params into (protected, remaining) based on rules.

    Returns:
        protected  — params that matched at least one rule (will be removed)
        remaining  — params that did not match any rule (will be kept)
    """
    protected = []
    remaining = []
    for param in params:
        name = param[0]
        if any(matches_rule(name, rule) for rule in rules):
            protected.append(param)
        else:
            remaining.append(param)
    return protected, remaining
