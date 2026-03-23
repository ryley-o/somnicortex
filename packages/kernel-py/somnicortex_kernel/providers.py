from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class KernelFixtureProvider:
    fixture_file: Path

    def _load(self) -> dict[str, Any]:
        return json.loads(self.fixture_file.read_text(encoding="utf-8"))

    def get(self, operation: str, fixture: str | None) -> dict[str, Any]:
        data = self._load()
        if fixture:
            for group in ("happyPath", "edgeCases"):
                for entry in data[group]:
                    if entry["operation"] == operation and entry["fixture"] == fixture:
                        return dict(entry["result"])
        for entry in data["happyPath"]:
            if entry["operation"] == operation:
                return dict(entry["result"])
        return {}


@dataclass
class KernelLocalProvider:
    """Local provider placeholder for real model-backed operations."""

    def get(self, operation: str, fixture: str | None) -> dict[str, Any]:
        _ = fixture
        # This provider is intentionally deterministic until model adapters are wired.
        return {
            "operation": operation,
            "mode": "local",
            "note": "Local provider placeholder; wire ModernBERT/Ollama adapters here."
        }
