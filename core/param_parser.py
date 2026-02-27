"""Parse and write Mission Planner .param files.

Format: PARAM_NAME,VALUE  (one per line, # for comments)
"""


def parse_param_file(path: str) -> list[tuple[str, str]]:
    """Read a .param file and return ordered list of (name, value) tuples."""
    params = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "," not in line:
                continue
            name, _, value = line.partition(",")
            name = name.strip()
            value = value.strip()
            if name:
                params.append((name, value))
    return params


def write_param_file(path: str, params: list[tuple[str, str]]) -> None:
    """Write a list of (name, value) tuples to a .param file."""
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        for name, value in params:
            f.write(f"{name},{value}\n")
