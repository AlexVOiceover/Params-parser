"""Protection list editor dialog."""

import tkinter as tk
from tkinter import messagebox, simpledialog
from pathlib import Path

import customtkinter as ctk

from core.filter_engine import (
    load_protection_lists,
    save_protection_list,
    create_protection_list,
    delete_protection_list,
)

_FONT_MONO = ("Consolas", 12)
_FONT_LABEL = ("Segoe UI", 12)
_FONT_LABEL_BOLD = ("Segoe UI", 12, "bold")
_FONT_SMALL = ("Segoe UI", 11)


class ListEditorDialog(ctk.CTkToplevel):
    """Top-level dialog for managing protection lists and their rules."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Edit Protection Lists")
        self.geometry("980x620")
        self.minsize(780, 480)
        self.grab_set()  # modal

        self._lists: list[dict] = load_protection_lists()
        self._selected_list_idx: int = -1
        self._selected_rule_idx: int = -1

        self._build_ui()
        if self._lists:
            self._select_list(0)

    # ── Build UI ──────────────────────────────────────────────────────────

    def _build_ui(self):
        self.columnconfigure(0, weight=0)
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        # ── Left: list of protection lists ──
        left = ctk.CTkFrame(self, width=220)
        left.grid(row=0, column=0, sticky="nsew", padx=(8, 4), pady=8)
        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)

        ctk.CTkLabel(left, text="Protection Lists", font=_FONT_LABEL_BOLD).grid(
            row=0, column=0, sticky="ew", padx=6, pady=(6, 4)
        )

        self._list_frame = ctk.CTkScrollableFrame(left, fg_color="transparent")
        self._list_frame.grid(row=1, column=0, sticky="nsew", padx=4, pady=(0, 4))
        self._list_frame.columnconfigure(0, weight=1)

        btn_row = ctk.CTkFrame(left, fg_color="transparent")
        btn_row.grid(row=2, column=0, sticky="ew", padx=4, pady=(0, 6))
        btn_row.columnconfigure(0, weight=1)
        btn_row.columnconfigure(1, weight=1)

        ctk.CTkButton(
            btn_row, text="+ New List", height=28,
            command=self._new_list,
        ).grid(row=0, column=0, padx=(0, 3), sticky="ew")

        ctk.CTkButton(
            btn_row, text="Delete", height=28,
            fg_color="#6b2a2a", hover_color="#8b3a3a",
            command=self._delete_list,
        ).grid(row=0, column=1, padx=(3, 0), sticky="ew")

        # ── Right: selected list's rules ──
        right = ctk.CTkFrame(self)
        right.grid(row=0, column=1, sticky="nsew", padx=(4, 8), pady=8)
        right.columnconfigure(0, weight=1)
        right.rowconfigure(2, weight=1)

        self._lbl_list_name = ctk.CTkLabel(
            right, text="Select a list", font=_FONT_LABEL_BOLD, anchor="w"
        )
        self._lbl_list_name.grid(row=0, column=0, sticky="ew", padx=8, pady=(6, 0))

        self._lbl_list_desc = ctk.CTkLabel(
            right, text="", font=_FONT_SMALL,
            text_color="gray60", anchor="w", wraplength=500,
        )
        self._lbl_list_desc.grid(row=1, column=0, sticky="ew", padx=8, pady=(2, 6))

        # Rules area
        rules_outer = ctk.CTkFrame(right, fg_color="transparent")
        rules_outer.grid(row=2, column=0, sticky="nsew", padx=8, pady=(0, 4))
        rules_outer.columnconfigure(0, weight=1)
        rules_outer.rowconfigure(0, weight=0)  # label row — fixed height
        rules_outer.rowconfigure(1, weight=1)  # scrollable-frame row — fills space

        ctk.CTkLabel(
            rules_outer,
            text="Rules  (exact = full name match | prefix = starts with)",
            font=_FONT_SMALL, text_color="gray60", anchor="w",
        ).grid(row=0, column=0, sticky="w")

        self._rules_frame = ctk.CTkScrollableFrame(
            rules_outer, fg_color=("#111122", "#111122")
        )
        self._rules_frame.columnconfigure(0, weight=1)
        self._rules_frame.grid(row=1, column=0, sticky="nsew")

        # Add rule controls — two rows so nothing gets chopped
        add_outer = ctk.CTkFrame(right, fg_color="transparent")
        add_outer.grid(row=3, column=0, sticky="ew", padx=8, pady=(4, 8))
        add_outer.columnconfigure(1, weight=1)

        # Row 0: Type + Value entry + Add Rule button
        add_row = ctk.CTkFrame(add_outer, fg_color="transparent")
        add_row.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 4))

        ctk.CTkLabel(add_row, text="Type:", font=_FONT_SMALL).pack(side="left", padx=(0, 4))
        self._rule_type_var = tk.StringVar(value="prefix")
        ctk.CTkOptionMenu(
            add_row, variable=self._rule_type_var,
            values=["prefix", "exact"], width=90,
        ).pack(side="left", padx=(0, 10))

        ctk.CTkLabel(add_row, text="Value:", font=_FONT_SMALL).pack(side="left", padx=(0, 4))
        self._rule_value_entry = ctk.CTkEntry(
            add_row, width=200, placeholder_text="e.g. COMPASS_OFS")
        self._rule_value_entry.pack(side="left", padx=(0, 10))
        self._rule_value_entry.bind("<Return>", lambda _: self._add_rule())

        ctk.CTkButton(
            add_row, text="+ Add Rule", width=110, command=self._add_rule
        ).pack(side="left")

        # Row 1: Remove Selected button (right-aligned)
        btn_row2 = ctk.CTkFrame(add_outer, fg_color="transparent")
        btn_row2.grid(row=1, column=0, columnspan=2, sticky="e")
        ctk.CTkButton(
            btn_row2, text="Remove Selected", width=150,
            fg_color="#6b2a2a", hover_color="#8b3a3a",
            command=self._remove_rule,
        ).pack(side="right")

        self._rebuild_list_buttons()

    # ── List management ───────────────────────────────────────────────────

    def _rebuild_list_buttons(self):
        for w in self._list_frame.winfo_children():
            w.destroy()
        for i, pl in enumerate(self._lists):
            btn = ctk.CTkButton(
                self._list_frame,
                text=pl["name"],
                anchor="w",
                fg_color=("#2a4a6b" if i == self._selected_list_idx else "transparent"),
                hover_color="#1e3a5f",
                command=lambda idx=i: self._select_list(idx),
            )
            btn.grid(row=i, column=0, sticky="ew", pady=2, padx=2)

    def _select_list(self, idx: int):
        self._selected_list_idx = idx
        self._selected_rule_idx = -1
        pl = self._lists[idx]
        self._lbl_list_name.configure(text=pl["name"])
        self._lbl_list_desc.configure(text=pl.get("description", ""))
        self._rebuild_list_buttons()
        self._rebuild_rules()

    def _new_list(self):
        name = simpledialog.askstring(
            "New Protection List", "Enter a name for the new list:",
            parent=self,
        )
        if not name:
            return
        desc = simpledialog.askstring(
            "Description", "Enter a short description (optional):",
            parent=self,
        ) or ""
        pl = create_protection_list(name, desc)
        self._lists.append(pl)
        self._select_list(len(self._lists) - 1)

    def _delete_list(self):
        if self._selected_list_idx < 0:
            return
        pl = self._lists[self._selected_list_idx]
        if not messagebox.askyesno(
            "Delete List",
            f"Delete '{pl['name']}'?\nThis cannot be undone.",
            parent=self,
        ):
            return
        delete_protection_list(pl)
        self._lists.pop(self._selected_list_idx)
        self._selected_list_idx = -1
        self._selected_rule_idx = -1
        self._rebuild_list_buttons()
        self._clear_rules_panel()
        if self._lists:
            self._select_list(0)

    def _clear_rules_panel(self):
        self._lbl_list_name.configure(text="Select a list")
        self._lbl_list_desc.configure(text="")
        for w in self._rules_frame.winfo_children():
            w.destroy()

    # ── Rule management ───────────────────────────────────────────────────

    def _rebuild_rules(self):
        for w in self._rules_frame.winfo_children():
            w.destroy()
        if self._selected_list_idx < 0:
            return
        rules = self._lists[self._selected_list_idx].get("rules", [])
        for i, rule in enumerate(rules):
            self._add_rule_row(i, rule)

    def _add_rule_row(self, idx: int, rule: dict):
        row_frame = ctk.CTkFrame(
            self._rules_frame,
            fg_color=("#2a4a6b" if idx == self._selected_rule_idx else "transparent"),
        )
        row_frame.columnconfigure(1, weight=1)
        row_frame.grid(row=idx, column=0, sticky="ew", pady=1, padx=2)

        type_label = ctk.CTkLabel(
            row_frame,
            text=f"[{rule.get('type','?'):6s}]",
            font=_FONT_MONO,
            text_color="gray70",
            width=80,
        )
        type_label.grid(row=0, column=0, padx=(6, 4))

        val_label = ctk.CTkLabel(
            row_frame,
            text=rule.get("value", ""),
            font=_FONT_MONO,
            anchor="w",
        )
        val_label.grid(row=0, column=1, sticky="ew", padx=(0, 6))

        for w in (row_frame, type_label, val_label):
            w.bind("<Button-1>", lambda _e, i=idx: self._select_rule(i))

    def _select_rule(self, idx: int):
        self._selected_rule_idx = idx
        self._rebuild_rules()

    def _add_rule(self):
        if self._selected_list_idx < 0:
            messagebox.showwarning("No list selected", "Please select a protection list first.", parent=self)
            return
        value = self._rule_value_entry.get().strip()
        if not value:
            messagebox.showwarning("Empty value", "Please enter a parameter name or prefix.", parent=self)
            return
        rule_type = self._rule_type_var.get()
        rule = {"type": rule_type, "value": value}
        pl = self._lists[self._selected_list_idx]
        pl.setdefault("rules", []).append(rule)
        save_protection_list(pl)
        self._rule_value_entry.delete(0, "end")
        self._rebuild_rules()

    def _remove_rule(self):
        if self._selected_list_idx < 0 or self._selected_rule_idx < 0:
            messagebox.showwarning("No rule selected", "Please click a rule row to select it first.", parent=self)
            return
        pl = self._lists[self._selected_list_idx]
        rules = pl.get("rules", [])
        if self._selected_rule_idx >= len(rules):
            return
        removed = rules.pop(self._selected_rule_idx)
        save_protection_list(pl)
        self._selected_rule_idx = -1
        self._rebuild_rules()
