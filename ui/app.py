"""Main application window for the AIR6 Param Filter tool."""

import threading
import datetime
import tkinter as tk
import tkinter.ttk as ttk
from tkinter import filedialog, messagebox
from pathlib import Path

import customtkinter as ctk

from core.param_parser import parse_param_file, write_param_file
from core.param_fetcher import (
    fetch_param_definitions, get_param_groups, cache_age_str,
)
from core.filter_engine import load_protection_lists, apply_filter

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

_FONT_MONO_SM    = ("Consolas", 11)
_FONT_LABEL      = ("Segoe UI", 12)
_FONT_LABEL_BOLD = ("Segoe UI", 12, "bold")
_FONT_TITLE      = ("Segoe UI", 11)
_DRAG_THRESHOLD  = 6

# Checkbox glyphs
_CHK_NONE    = "☐"
_CHK_ALL     = "☑"
_CHK_PARTIAL = "▪"   # indeterminate / some checked

# Sentinel value injected at the bottom of the protection-list dropdown
_EDIT_LISTS_OPTION = "✏  Edit Lists…"


def _setup_ttk_styles():
    s = ttk.Style()
    s.theme_use("default")
    s.configure("Param.Treeview",
        background="#1a1a2e", foreground="#dde0ee",
        fieldbackground="#1a1a2e", rowheight=24,
        font=("Consolas", 11), borderwidth=0, relief="flat",
    )
    s.configure("Param.Treeview.Heading",
        background="#252535", foreground="#8888aa",
        font=("Segoe UI", 9), relief="flat", borderwidth=0,
    )
    s.map("Param.Treeview",
        background=[("selected", "#2a4a6b")],
        foreground=[("selected", "#ffffff")],
    )
    s.configure("Param.Vertical.TScrollbar",
        background="#252535", troughcolor="#1a1a2e",
        arrowcolor="#8888aa", borderwidth=0,
    )
    s.map("Param.Vertical.TScrollbar",
        background=[("active", "#3a3a5a")],
    )


# ── Grouping helpers ──────────────────────────────────────────────────────────

def _resolve_group(name: str, pdef_groups: list[str]) -> str:
    """Find which ArduPilot pdef group a param belongs to.

    Matches the longest pdef group prefix (e.g. "BARO1_" beats "BARO_").
    Falls back to the first underscore-delimited segment if no pdef match.
    """
    best_len = 0
    best     = ""
    for g in pdef_groups:
        g_prefix = g.rstrip("_")
        if not g_prefix:
            continue
        # Exact match or proper prefix (followed by underscore or digit)
        if name == g_prefix or name.startswith(g_prefix + "_"):
            if len(g_prefix) > best_len:
                best_len = len(g_prefix)
                best     = g_prefix
    if best:
        return best
    # Fallback: first underscore segment, or whole name if no underscore
    return name.split("_")[0] if "_" in name else name


def _build_groups(
    params: list[tuple[str, str]],
    pdef_groups: list[str],
) -> dict[str, list[tuple[str, str]]]:
    """Return OrderedDict {group_label: [(name, value), ...]} sorted alpha."""
    result: dict[str, list] = {}
    for name, value in params:
        g = _resolve_group(name, pdef_groups)
        result.setdefault(g, []).append((name, value))
    return dict(sorted(result.items()))


# ── Drag proxy ────────────────────────────────────────────────────────────────

class _DragProxy:
    __slots__ = ("_name", "_value")
    def __init__(self, name: str, value: str):
        self._name  = name
        self._value = value


# ── Param Panel ───────────────────────────────────────────────────────────────

class ParamPanel(ctk.CTkFrame):
    """
    Grouped, collapsible param list.

    Tree structure (ttk.Treeview, show="tree headings"):
        ▶ ATC  (38)          [☐]
            ATC_ACCEL_P_MAX  [☐]  110000
            ATC_ACCEL_R_MAX  [☐]  110000
            ...
        ▶ COMPASS  (24)      [☐]
            ...

    Checkboxes:
        ☐  none in group checked
        ▪  some in group checked
        ☑  all in group checked
    """

    def __init__(self, master, title: str, header_color: str,
                 on_info, on_drag_start, on_check_change=None, **kwargs):
        super().__init__(master, **kwargs)
        self._header_color    = header_color
        self._on_info         = on_info
        self._app_drag_cb     = on_drag_start
        self._on_check_change = on_check_change  # called whenever checked set changes

        # Data
        self._params: list[tuple[str, str]] = []
        self._checked: set[str]             = set()   # param names
        self._pdef_groups: list[str]        = []      # from ArduPilot, set by App

        # iid maps (rebuilt on every tree rebuild)
        self._iid_param: dict[str, tuple[str, str]] = {}  # iid → (name, value)
        self._iid_group: dict[str, str]             = {}  # param-iid → group-iid
        self._name_iid:  dict[str, str]             = {}  # name → iid
        self._group_iids: dict[str, str]            = {}  # group_label → iid

        # Drag-tracking
        self._press_xy:     tuple | None = None
        self._press_iid:    str   | None = None
        self._drag_started:  bool        = False

        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        # ── Header ──────────────────────────────────────────────────────────
        hdr = ctk.CTkFrame(self, fg_color=header_color, corner_radius=6)
        hdr.grid(row=0, column=0, sticky="ew", padx=4, pady=(4, 2))
        hdr.columnconfigure(1, weight=1)

        self._all_var = tk.BooleanVar(value=False)
        ctk.CTkCheckBox(
            hdr, variable=self._all_var, text="",
            width=20, checkbox_width=16, checkbox_height=16,
            command=self._toggle_all,
        ).grid(row=0, column=0, padx=(6, 4), pady=4)

        self._hdr_label = ctk.CTkLabel(
            hdr, text=title, font=_FONT_LABEL_BOLD, anchor="w"
        )
        self._hdr_label.grid(row=0, column=1, sticky="ew", padx=(0, 8), pady=4)

        # ── Treeview ─────────────────────────────────────────────────────────
        tree_wrap = tk.Frame(self, bg="#1a1a2e", bd=0, highlightthickness=0)
        tree_wrap.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))
        tree_wrap.rowconfigure(0, weight=1)
        tree_wrap.columnconfigure(0, weight=1)

        # show="tree headings": #0 is the tree column (with expand arrow).
        # The checkbox glyph is embedded directly in the #0 text so it
        # always sits right next to the label — no separate chk column.
        self._tree = ttk.Treeview(
            tree_wrap,
            columns=("value",),
            show="tree headings",
            style="Param.Treeview",
            selectmode="browse",
        )
        self._tree.heading("#0",    text="Parameter", anchor="w")
        self._tree.heading("value", text="Value",     anchor="w")
        # #0 is fixed-width so names never push values to the far right.
        # value stretches to fill the rest but is left-aligned, so the
        # value text always appears immediately after the name column.
        self._tree.column("#0",    width=250, minwidth=160, stretch=False, anchor="w")
        self._tree.column("value", width=100, minwidth=50,  stretch=True,  anchor="w")

        # Tag styles
        self._tree.tag_configure("group", font=("Segoe UI", 11, "bold"),
                                 foreground="#a8b8d0")
        self._tree.tag_configure("param", font=("Consolas", 11),
                                 foreground="#dde0ee")

        vsb = ttk.Scrollbar(tree_wrap, orient="vertical",
                             command=self._tree.yview,
                             style="Param.Vertical.TScrollbar")
        self._tree.configure(yscrollcommand=vsb.set)
        self._tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")

        self._tree.bind("<ButtonPress-1>",   self._on_press)
        self._tree.bind("<B1-Motion>",       self._on_motion)
        self._tree.bind("<ButtonRelease-1>", self._on_release)

    # ── Public API ─────────────────────────────────────────────────────────

    def set_pdef_groups(self, groups: list[str]):
        """Called by App when pdef group data is available / refreshed."""
        self._pdef_groups = groups

    def load(self, params: list[tuple[str, str]]):
        self._params = list(params)
        self._checked.clear()
        self._all_var.set(False)
        self._rebuild_tree(open_groups=set())

    def get_all_params(self) -> list[tuple[str, str]]:
        return list(self._params)

    def get_checked_params(self) -> list[tuple[str, str]]:
        return [(n, v) for n, v in self._params if n in self._checked]

    def remove_params(self, names: set[str]):
        for n in names:
            self._checked.discard(n)
        self._params = [(n, v) for n, v in self._params if n not in names]
        self._rebuild_tree(preserve_open=True)

    def add_params(self, params: list[tuple[str, str]]):
        existing = {n for n, _ in self._params}
        for p in params:
            if p[0] not in existing:
                self._params.append(p)
                existing.add(p[0])
        self._rebuild_tree(preserve_open=True)

    def update_title(self, text: str):
        self._hdr_label.configure(text=text)

    def highlight_drop_target(self, on: bool):
        color = ("#1a3a1a", "#1a3a1a") if on else ("transparent", "transparent")
        self.configure(fg_color=color)

    # ── Tree rebuild ───────────────────────────────────────────────────────

    def _open_group_labels(self) -> set[str]:
        """Return labels of currently expanded group rows."""
        open_labels = set()
        for iid in self._tree.get_children(""):
            if self._tree.item(iid, "open"):
                # Format: "{glyph}  {label}  ({count})" — strip glyph first
                text = self._tree.item(iid)["text"]
                if text and text[0] in (_CHK_NONE, _CHK_ALL, _CHK_PARTIAL):
                    text = text[1:].lstrip()
                label = text.split("  (")[0].strip()
                open_labels.add(label)
        return open_labels

    def _rebuild_tree(self, open_groups: set[str] | None = None,
                      preserve_open: bool = False):
        if preserve_open and open_groups is None:
            open_groups = self._open_group_labels()
        if open_groups is None:
            open_groups = set()

        # Clear
        self._tree.delete(*self._tree.get_children(""))
        self._iid_param.clear()
        self._iid_group.clear()
        self._name_iid.clear()
        self._group_iids.clear()

        groups = _build_groups(self._params, self._pdef_groups)

        for label, members in groups.items():
            n_total   = len(members)
            n_checked = sum(1 for n, _ in members if n in self._checked)

            if n_checked == 0:
                grp_chk = _CHK_NONE
            elif n_checked == n_total:
                grp_chk = _CHK_ALL
            else:
                grp_chk = _CHK_PARTIAL

            g_iid = self._tree.insert(
                "", "end",
                text=f"{grp_chk}  {label}  ({n_total})",
                values=("",),
                open=(label in open_groups),
                tags=("group",),
            )
            self._group_iids[label] = g_iid

            for name, value in members:
                chk = _CHK_ALL if name in self._checked else _CHK_NONE
                p_iid = self._tree.insert(
                    g_iid, "end",
                    text=f"{chk}  {name}",
                    values=(value,),
                    tags=("param",),
                )
                self._iid_param[p_iid] = (name, value)
                self._iid_group[p_iid] = g_iid
                self._name_iid[name]   = p_iid

    # ── Checkbox logic ─────────────────────────────────────────────────────

    def _update_glyph(self, iid: str, glyph: str):
        """Replace the leading checkbox glyph in an item's #0 text."""
        current = self._tree.item(iid)["text"]
        if current and current[0] in (_CHK_NONE, _CHK_ALL, _CHK_PARTIAL):
            rest = current[1:].lstrip()
        else:
            rest = current
        self._tree.item(iid, text=f"{glyph}  {rest}")

    def _toggle_all(self):
        v   = self._all_var.get()
        chk = _CHK_ALL if v else _CHK_NONE
        if v:
            self._checked = {n for n, _ in self._params}
        else:
            self._checked.clear()
        for g_iid in self._tree.get_children(""):
            self._update_glyph(g_iid, chk)
            for p_iid in self._tree.get_children(g_iid):
                self._update_glyph(p_iid, chk)
        if self._on_check_change:
            self._on_check_change()

    def _toggle_group(self, g_iid: str):
        """Check or uncheck all params in a group; update group glyph."""
        children   = self._tree.get_children(g_iid)
        child_names = [
            self._iid_param[c][0] for c in children if c in self._iid_param
        ]
        # If all are checked → uncheck; otherwise → check all
        all_checked = all(n in self._checked for n in child_names)
        if all_checked:
            for n in child_names:
                self._checked.discard(n)
            chk = _CHK_NONE
        else:
            for n in child_names:
                self._checked.add(n)
            chk = _CHK_ALL
        self._update_glyph(g_iid, chk)
        for c in children:
            self._update_glyph(c, chk)
        if self._on_check_change:
            self._on_check_change()

    def _toggle_param(self, p_iid: str):
        """Toggle one param's checkbox and sync the parent group glyph."""
        info = self._iid_param.get(p_iid)
        if not info:
            return
        name = info[0]
        if name in self._checked:
            self._checked.discard(name)
            self._update_glyph(p_iid, _CHK_NONE)
        else:
            self._checked.add(name)
            self._update_glyph(p_iid, _CHK_ALL)
        self._sync_group_glyph(self._iid_group.get(p_iid))
        if self._on_check_change:
            self._on_check_change()

    def _sync_group_glyph(self, g_iid: str | None):
        if not g_iid:
            return
        children    = self._tree.get_children(g_iid)
        child_names = [
            self._iid_param[c][0] for c in children if c in self._iid_param
        ]
        n_checked = sum(1 for n in child_names if n in self._checked)
        if n_checked == 0:
            glyph = _CHK_NONE
        elif n_checked == len(child_names):
            glyph = _CHK_ALL
        else:
            glyph = _CHK_PARTIAL
        self._update_glyph(g_iid, glyph)

    # ── Event handlers ─────────────────────────────────────────────────────

    def _on_press(self, event):
        region = self._tree.identify_region(event.x, event.y)
        iid    = self._tree.identify_row(event.y)
        elem   = self._tree.identify_element(event.x, event.y)

        self._press_iid    = None
        self._press_xy     = (event.x_root, event.y_root)
        self._drag_started = False

        if not iid or region in ("heading", "separator", "nothing"):
            return

        is_group = "group" in self._tree.item(iid, "tags")

        # ── Group row → expand/collapse or toggle checkbox ───────────────
        if is_group:
            # identify_element("indicator") is unreliable on some themes/platforms;
            # use an x-position fallback: groups are always at depth 0, so the
            # ▶/▼ indicator sits in the leftmost ~25 px of the row.
            if elem == "indicator" or event.x < 20:
                self._tree.item(iid, open=not self._tree.item(iid, "open"))
            else:
                self._toggle_group(iid)
            return "break"

        # ── Param row → toggle checkbox + track for drag / info ──────────
        self._toggle_param(iid)
        self._press_iid = iid
        return "break"

    def _on_motion(self, event):
        if not self._press_iid or self._drag_started:
            return
        dx = abs(event.x_root - self._press_xy[0])
        dy = abs(event.y_root - self._press_xy[1])
        if dx > _DRAG_THRESHOLD or dy > _DRAG_THRESHOLD:
            self._drag_started = True
            info = self._iid_param.get(self._press_iid)
            if info:
                self._app_drag_cb(event, _DragProxy(*info), self)

    def _on_release(self, event):
        if not self._drag_started and self._press_iid:
            info = self._iid_param.get(self._press_iid)
            if info:
                self._on_info(*info)
        self._press_xy     = None
        self._press_iid    = None
        self._drag_started = False


# ── Detail + Console panel ────────────────────────────────────────────────────

class DetailPanel(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self._param_defs: dict = {}

        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)

        # Vertical PanedWindow — draggable sash between Info and Console
        self._paned = tk.PanedWindow(
            self, orient="vertical",
            sashwidth=6, sashpad=0,
            bg="#2a2a4a",
            opaqueresize=True,
            relief="flat",
        )
        self._paned.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)

        # ── Top pane: Parameter Info ──────────────────────────────────────
        info_frame = tk.Frame(self._paned, bg="#1a1a2e")
        info_frame.rowconfigure(1, weight=1)
        info_frame.columnconfigure(0, weight=1)

        ctk.CTkLabel(
            info_frame, text="Parameter Info", font=_FONT_LABEL_BOLD, anchor="w",
            bg_color="#1a1a2e",
        ).grid(row=0, column=0, sticky="ew", padx=8, pady=(8, 2))

        self._info_text = ctk.CTkTextbox(
            info_frame, font=_FONT_MONO_SM, wrap="word",
            state="disabled", fg_color=("#111122", "#111122"),
        )
        self._info_text.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))

        self._paned.add(info_frame, stretch="always", minsize=60)

        # ── Bottom pane: Console ──────────────────────────────────────────
        con_frame = tk.Frame(self._paned, bg="#1a1a2e")
        con_frame.rowconfigure(1, weight=1)
        con_frame.columnconfigure(0, weight=1)

        chdr = ctk.CTkFrame(con_frame, fg_color="transparent", bg_color="#1a1a2e")
        chdr.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 2))
        chdr.columnconfigure(0, weight=1)
        ctk.CTkLabel(chdr, text="Console", font=_FONT_LABEL_BOLD, anchor="w"
                     ).grid(row=0, column=0, sticky="w")
        ctk.CTkButton(
            chdr, text="Clear", width=50, height=22,
            fg_color="transparent", border_width=1, border_color="gray40",
            text_color="gray60", hover_color="#2a2a3e",
            command=self._clear_console,
        ).grid(row=0, column=1, sticky="e")

        self._console = ctk.CTkTextbox(
            con_frame, font=("Consolas", 10), wrap="word",
            state="disabled", fg_color=("#0d0d1a", "#0d0d1a"),
            text_color="#88cc88",
        )
        self._console.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))

        self._paned.add(con_frame, stretch="always", minsize=60)

        # Set 50/50 sash position after layout is computed
        self._paned.bind("<Configure>", self._on_paned_configure)
        self._sash_set = False

    def _on_paned_configure(self, event=None):
        if not self._sash_set:
            h = self._paned.winfo_height()
            if h > 1:
                self._paned.sash_place(0, 0, h // 2)
                self._sash_set = True

    def set_param_defs(self, defs: dict):
        self._param_defs = defs

    def show(self, name: str, value: str):
        meta  = self._param_defs.get(name, {})
        lines = [f"Name:    {name}", f"Value:   {value}"]
        if meta.get("DisplayName"):
            lines.append(f"Label:   {meta['DisplayName']}")
        if meta.get("Description"):
            lines += ["", meta["Description"]]
        if meta.get("Units"):
            lines.append(f"\nUnits:   {meta['Units']}")
        if meta.get("Range"):
            r = meta["Range"]
            lines.append(f"Range:   {r.get('low','?')} – {r.get('high','?')}")
        if meta.get("Values"):
            lines.append("\nValues:")
            for k, v in meta["Values"].items():
                lines.append(f"  {k} = {v}")
        if meta.get("Bitmask"):
            lines.append("\nBitmask:")
            for bit, lbl in meta["Bitmask"].items():
                lines.append(f"  bit {bit}: {lbl}")
        if meta.get("RebootRequired") == "True":
            lines.append("\n⚠ Reboot required after change")
        if not meta:
            lines.append("\n(No definition found in ArduPilot database)")
        self._info_text.configure(state="normal")
        self._info_text.delete("1.0", "end")
        self._info_text.insert("1.0", "\n".join(lines))
        self._info_text.configure(state="disabled")

    def clear_info(self):
        self._info_text.configure(state="normal")
        self._info_text.delete("1.0", "end")
        self._info_text.configure(state="disabled")

    def log(self, line: str):
        self._console.configure(state="normal")
        self._console.insert("end", line + "\n")
        self._console.see("end")
        self._console.configure(state="disabled")

    def _clear_console(self):
        self._console.configure(state="normal")
        self._console.delete("1.0", "end")
        self._console.configure(state="disabled")


# ── Main App ──────────────────────────────────────────────────────────────────

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("AIR6 Param Filter")
        self.geometry("1340x780")
        self.minsize(960, 600)

        self._params: list[tuple[str, str]] = []
        self._param_defs: dict              = {}
        self._pdef_groups: list[str]        = []
        self._protection_lists: list[dict]  = []
        self._current_file: str             = ""

        # DnD state
        self._drag_proxy:  _DragProxy    | None = None
        self._drag_source: ParamPanel    | None = None
        self._drag_ghost:  ctk.CTkLabel  | None = None
        self._drag_target: ParamPanel    | None = None

        _setup_ttk_styles()
        self._build_ui()
        self._reload_protection_lists()

        self.bind("<B1-Motion>",       self._dnd_move)
        self.bind("<ButtonRelease-1>", self._dnd_release)
        self.bind("<Control-q>",       lambda _: self._quit())
        self.protocol("WM_DELETE_WINDOW", self._quit)

        self._log("AIR6 Param Filter started")
        self._status("Loading parameter definitions…")
        threading.Thread(target=self._bg_load_defs, daemon=True).start()

    # ── UI ────────────────────────────────────────────────────────────────

    def _build_ui(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        # Toolbar
        toolbar = ctk.CTkFrame(self, height=50, corner_radius=0)
        toolbar.grid(row=0, column=0, sticky="ew")
        toolbar.columnconfigure(2, weight=1)   # spacer between file label and list

        ctk.CTkButton(toolbar, text="Open .param File", width=140,
                       command=self._open_file
                       ).grid(row=0, column=0, padx=(10, 6), pady=8)

        self._lbl_file = ctk.CTkLabel(
            toolbar, text="No file loaded", font=_FONT_TITLE,
            text_color="gray60", anchor="w")
        self._lbl_file.grid(row=0, column=1, sticky="w", padx=6)

        # col 2 is the spacer (weight=1)
        ctk.CTkLabel(toolbar, text="").grid(row=0, column=2, sticky="ew")

        ctk.CTkLabel(toolbar, text="Protection list:", font=_FONT_LABEL
                     ).grid(row=0, column=3, padx=(0, 6))
        self._list_var = tk.StringVar(value="")
        # "✏ Edit Lists…" is appended as the last dropdown item by
        # _reload_protection_lists; selecting it opens the editor dialog.
        self._list_dropdown = ctk.CTkOptionMenu(
            toolbar, variable=self._list_var, values=[""],
            command=self._on_list_changed, width=220)
        self._list_dropdown.grid(row=0, column=4, padx=(0, 10), pady=8)

        self._btn_refresh = ctk.CTkButton(
            toolbar, text="↻ Refresh Params", width=130,
            fg_color="#2d5a27", hover_color="#3a7232",
            command=self._refresh_defs)
        self._btn_refresh.grid(row=0, column=5, padx=(0, 10), pady=8)

        # Content
        content = ctk.CTkFrame(self, fg_color="transparent")
        content.grid(row=1, column=0, sticky="nsew", padx=6)
        content.columnconfigure(0, weight=1)
        content.columnconfigure(1, weight=0)
        content.columnconfigure(2, weight=1)
        content.columnconfigure(3, weight=0)
        content.rowconfigure(0, weight=1)

        self._panel_protected = ParamPanel(
            content,
            title="PROTECTED — will be removed (0)",
            header_color="#6b2a2a",
            on_info=self._on_param_info,
            on_drag_start=self._dnd_start,
            on_check_change=self._sync_move_buttons,
        )
        self._panel_protected.grid(row=0, column=0, sticky="nsew", padx=(0, 2))

        # Centre move buttons
        center = ctk.CTkFrame(content, width=86, fg_color="transparent")
        center.grid(row=0, column=1, sticky="ns", padx=2)
        center.rowconfigure(0, weight=1)
        center.rowconfigure(3, weight=1)
        ctk.CTkLabel(center, text="").grid(row=0)
        self._btn_protect = ctk.CTkButton(
            center, text="←\nProtect",
            width=78, height=54,
            fg_color="#6b2a2a", hover_color="#8b3a3a",
            font=_FONT_LABEL_BOLD,
            state="disabled",
            command=self._move_checked_to_protected,
        )
        self._btn_protect.grid(row=1, padx=4, pady=(0, 6))
        self._btn_apply = ctk.CTkButton(
            center, text="Apply\n→",
            width=78, height=54,
            fg_color="#2a5a2a", hover_color="#3a7232",
            font=_FONT_LABEL_BOLD,
            state="disabled",
            command=self._move_checked_to_remaining,
        )
        self._btn_apply.grid(row=2, padx=4)
        ctk.CTkLabel(center, text="").grid(row=3)

        self._panel_remaining = ParamPanel(
            content,
            title="WILL BE APPLIED (0)",
            header_color="#2a5a2a",
            on_info=self._on_param_info,
            on_drag_start=self._dnd_start,
            on_check_change=self._sync_move_buttons,
        )
        self._panel_remaining.grid(row=0, column=2, sticky="nsew", padx=(2, 2))

        self._detail = DetailPanel(content, width=270)
        self._detail.grid(row=0, column=3, sticky="nsew", padx=(2, 0))

        # Bottom bar
        bottom = ctk.CTkFrame(self, height=40, corner_radius=0)
        bottom.grid(row=2, column=0, sticky="ew")
        bottom.columnconfigure(1, weight=1)

        self._btn_save = ctk.CTkButton(
            bottom, text="Save Filtered File", width=160,
            state="disabled", command=self._save_file)
        self._btn_save.grid(row=0, column=0, padx=(10, 10), pady=6)

        self._lbl_status = ctk.CTkLabel(
            bottom, text="Ready", font=_FONT_TITLE,
            text_color="gray60", anchor="w")
        self._lbl_status.grid(row=0, column=1, sticky="w")

        self._lbl_cache = ctk.CTkLabel(
            bottom, text="Cache: —", font=_FONT_TITLE,
            text_color="gray50", anchor="e")
        self._lbl_cache.grid(row=0, column=2, sticky="e", padx=(0, 12))

    # ── Logging ───────────────────────────────────────────────────────────

    def _log(self, msg: str, level: str = "INFO"):
        ts   = datetime.datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {level}: {msg}"
        self.after(0, lambda: self._detail.log(line))

    # ── File actions ──────────────────────────────────────────────────────

    def _open_file(self):
        path = filedialog.askopenfilename(
            title="Open Mission Planner .param file",
            filetypes=[("Param files", "*.param *.parm"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            self._params = parse_param_file(path)
            self._current_file = path
            fname = Path(path).name
            self._lbl_file.configure(text=fname, text_color="white")
            self._log(f"Opened '{fname}' — {len(self._params)} params loaded")
            self._apply_filter()
            self._btn_save.configure(state="normal")
        except Exception as exc:
            self._log(f"Failed to open: {exc}", "ERROR")
            messagebox.showerror("Error", f"Failed to read file:\n{exc}")

    def _save_file(self):
        remaining = self._panel_remaining.get_all_params()
        if not remaining:
            messagebox.showwarning("Nothing to save", "No parameters remain after filtering.")
            return
        default_name = ""
        if self._current_file:
            p = Path(self._current_file)
            default_name = str(p.parent / f"{p.stem}_filtered{p.suffix}")
        path = filedialog.asksaveasfilename(
            title="Save filtered .param file",
            initialfile=Path(default_name).name if default_name else "",
            defaultextension=".param",
            filetypes=[("Param files", "*.param *.parm"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            protected = self._panel_protected.get_all_params()
            write_param_file(path, remaining)
            fname = Path(path).name
            self._log(
                f"Saved '{fname}' — {len(remaining)} written, "
                f"{len(protected)} protected/removed"
            )
            self._status(f"Saved {len(remaining)} params ({len(protected)} removed)")
        except Exception as exc:
            self._log(f"Save failed: {exc}", "ERROR")
            messagebox.showerror("Error", f"Failed to save:\n{exc}")

    # ── Move buttons ──────────────────────────────────────────────────────

    def _move_checked_to_protected(self):
        items = self._panel_remaining.get_checked_params()
        if not items:
            return
        names = {n for n, _ in items}
        self._panel_remaining.remove_params(names)
        self._panel_protected.add_params(items)
        self._sync_titles()
        self._sync_move_buttons()
        preview = ", ".join(n for n, _ in items[:4]) + (" …" if len(items) > 4 else "")
        self._log(f"Moved {len(items)} param(s) → Protected: {preview}")

    def _move_checked_to_remaining(self):
        items = self._panel_protected.get_checked_params()
        if not items:
            return
        names = {n for n, _ in items}
        self._panel_protected.remove_params(names)
        self._panel_remaining.add_params(items)
        self._sync_titles()
        self._sync_move_buttons()
        preview = ", ".join(n for n, _ in items[:4]) + (" …" if len(items) > 4 else "")
        self._log(f"Moved {len(items)} param(s) → Will Be Applied: {preview}")

    # ── Drag and drop ─────────────────────────────────────────────────────

    def _dnd_start(self, event, proxy: _DragProxy, source: ParamPanel):
        if self._drag_proxy is not None:
            return
        self._drag_proxy  = proxy
        self._drag_source = source
        self._drag_target = None
        self._drag_ghost  = ctk.CTkLabel(
            self, text=f"  {proxy._name}  ",
            font=_FONT_MONO_SM, fg_color="#2a4a6b", corner_radius=4)
        self._drag_ghost.place(
            x=event.x_root - self.winfo_rootx(),
            y=event.y_root - self.winfo_rooty() - 14)

    def _dnd_move(self, event):
        if self._drag_proxy is None:
            return
        self._drag_ghost.place(
            x=event.x_root - self.winfo_rootx(),
            y=event.y_root - self.winfo_rooty() - 14)
        new_target = self._panel_at(event.x_root, event.y_root)
        if new_target is not self._drag_target:
            if self._drag_target:
                self._drag_target.highlight_drop_target(False)
            self._drag_target = new_target
            if self._drag_target and self._drag_target is not self._drag_source:
                self._drag_target.highlight_drop_target(True)

    def _dnd_release(self, event):
        if self._drag_proxy is None:
            return
        self._drag_ghost.destroy()
        self._drag_ghost = None
        if self._drag_target:
            self._drag_target.highlight_drop_target(False)
        target = self._panel_at(event.x_root, event.y_root)
        if target and target is not self._drag_source:
            name, value = self._drag_proxy._name, self._drag_proxy._value
            src = "Protected" if self._drag_source is self._panel_protected else "Will Be Applied"
            dst = "Protected" if target is self._panel_protected else "Will Be Applied"
            self._drag_source.remove_params({name})
            target.add_params([(name, value)])
            self._sync_titles()
            self._log(f"Dragged '{name}'  {src} → {dst}")
        self._drag_proxy  = None
        self._drag_source = None
        self._drag_target = None

    def _panel_at(self, x_root: int, y_root: int) -> "ParamPanel | None":
        for panel in (self._panel_protected, self._panel_remaining):
            px, py = panel.winfo_rootx(), panel.winfo_rooty()
            if px <= x_root <= px + panel.winfo_width() and \
               py <= y_root <= py + panel.winfo_height():
                return panel
        return None

    # ── Filter & state ────────────────────────────────────────────────────

    def _push_pdef_groups(self):
        """Send the latest pdef group list to both panels."""
        self._panel_protected.set_pdef_groups(self._pdef_groups)
        self._panel_remaining.set_pdef_groups(self._pdef_groups)

    def _apply_filter(self):
        if not self._params:
            return
        selected_name = self._list_var.get()
        rules = []
        for pl in self._protection_lists:
            if pl["name"] == selected_name:
                rules = pl.get("rules", [])
                break
        protected, remaining = apply_filter(self._params, rules)
        self._panel_protected.load(protected)
        self._panel_remaining.load(remaining)
        self._detail.clear_info()
        self._sync_titles()
        self._sync_move_buttons()
        self._log(
            f"Filter '{selected_name}' — "
            f"{len(protected)} protected, {len(remaining)} will be applied"
        )
        self._status(f"{len(protected)} protected · {len(remaining)} will be applied")

    def _sync_titles(self):
        p = len(self._panel_protected.get_all_params())
        r = len(self._panel_remaining.get_all_params())
        self._panel_protected.update_title(f"PROTECTED — will be removed ({p})")
        self._panel_remaining.update_title(f"WILL BE APPLIED ({r})")

    def _sync_move_buttons(self):
        """Enable/disable move buttons based on what is checked in each panel."""
        has_for_protect = bool(self._panel_remaining.get_checked_params())
        has_for_apply   = bool(self._panel_protected.get_checked_params())
        self._btn_protect.configure(state="normal" if has_for_protect else "disabled")
        self._btn_apply.configure(state="normal"   if has_for_apply   else "disabled")

    def _on_param_info(self, name: str, value: str):
        self._detail.show(name, value)

    # ── Protection lists ──────────────────────────────────────────────────

    def _reload_protection_lists(self):
        self._protection_lists = load_protection_lists()
        names = [pl["name"] for pl in self._protection_lists] or ["(No lists defined)"]
        self._list_dropdown.configure(values=names + [_EDIT_LISTS_OPTION])
        if self._list_var.get() not in names:
            self._list_var.set(names[0])

    def _on_list_changed(self, selected=None):
        if selected == _EDIT_LISTS_OPTION:
            # Revert dropdown to first valid name before opening dialog
            valid = [pl["name"] for pl in self._protection_lists]
            self._list_var.set(valid[0] if valid else "")
            self._open_list_editor()
            return
        self._apply_filter()

    def _open_list_editor(self):
        from ui.list_editor import ListEditorDialog
        dialog = ListEditorDialog(self)
        self.wait_window(dialog)
        self._reload_protection_lists()
        self._apply_filter()

    # ── Param definitions ─────────────────────────────────────────────────

    def _refresh_defs(self):
        self._btn_refresh.configure(state="disabled", text="Fetching…")
        self._log("Fetching latest parameter definitions from ArduPilot…")
        threading.Thread(target=self._bg_refresh_defs, daemon=True).start()

    def _bg_refresh_defs(self):
        try:
            defs = fetch_param_definitions(force_refresh=True)
            groups = get_param_groups()
            self._param_defs   = defs
            self._pdef_groups  = groups
            self._detail.set_param_defs(defs)
            self.after(0, self._push_pdef_groups)
            self._log(
                f"Definitions updated — {len(defs)} params, "
                f"{len(groups)} groups from ArduPilot"
            )
            self.after(0, lambda: self._status(f"Definitions updated ({len(defs)} params)"))
        except Exception as exc:
            self._log(f"Fetch failed: {exc}", "ERROR")
            self.after(0, lambda: self._status("Fetch failed"))
        finally:
            self.after(0, lambda: (
                self._btn_refresh.configure(state="normal", text="↻ Refresh Params"),
                self._update_cache_label(),
            ))

    def _bg_load_defs(self):
        try:
            defs   = fetch_param_definitions(force_refresh=False)
            groups = get_param_groups()
            self._param_defs  = defs
            self._pdef_groups = groups
            self._detail.set_param_defs(defs)
            self.after(0, self._push_pdef_groups)
            age = cache_age_str()
            self._log(
                f"Definitions loaded — {len(defs)} params, "
                f"{len(groups)} groups  (cache: {age})"
            )
            self.after(0, lambda: self._status(f"Ready — {len(defs)} param definitions loaded"))
        except Exception as exc:
            self._log(f"Could not load definitions: {exc}", "WARN")
            self.after(0, lambda: self._status("Could not load param definitions"))
        finally:
            self.after(0, self._update_cache_label)

    def _update_cache_label(self):
        self._lbl_cache.configure(text=f"Cache: {cache_age_str()}")

    def _quit(self):
        self._log("Shutting down…")
        self.after(50, self.destroy)   # let the log line render first

    def _status(self, msg: str):
        self._lbl_status.configure(text=msg)
