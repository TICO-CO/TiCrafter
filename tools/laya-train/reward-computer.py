#!/usr/bin/env python3
"""Compute training rewards from exported traces and their outcomes."""

import argparse
import json
import sys
from pathlib import Path


class RewardComputer:
    def __init__(
        self,
        progress_weight: float = 1.0,
        completion_weight: float = 5.0,
        damage_weight: float = 0.5,
        time_weight: float = 0.001,
        material_weight: float = 0.1,
    ) -> None:
        self.progress_weight = progress_weight
        self.completion_weight = completion_weight
        self.damage_weight = damage_weight
        self.time_weight = time_weight
        self.material_weight = material_weight

    def compute(self, trace: dict) -> float:
        outcome = trace.get("outcome") or {}
        reward = 0.0
        if outcome.get("kind") == "skill":
            progress = outcome.get("progress") or {}
            done = float(progress.get("done", 0))
            total = float(progress.get("total", 0))
            if total > 0:
                reward += self.progress_weight * min(1.0, done / total)
            if outcome.get("status") == "completed":
                reward += self.completion_weight
            if outcome.get("status") == "failed":
                reward -= self.completion_weight
        if outcome.get("kind") == "task":
            if outcome.get("status") == "completed":
                reward += self.completion_weight
            if outcome.get("status") in {"failed", "dead_letter"}:
                reward -= self.completion_weight
        state = trace.get("state") or {}
        health = float(state.get("health", 20))
        reward -= max(0.0, 20.0 - health) * self.damage_weight
        reward -= max(0.0, float(trace.get("latencyMilliseconds") or 0)) * self.time_weight
        inventory = state.get("inventorySummary") or []
        reward += min(1.0, len(inventory) * self.material_weight)
        if trace.get("fallback") is not None:
            reward -= 0.1
        return reward


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    arguments = parser.parse_args(argv)
    if not arguments.input.exists():
        print(f"input not found: {arguments.input}", file=sys.stderr)
        return 1
    computer = RewardComputer()
    records = read_jsonl(arguments.input)
    rewarded = [{**record, "reward": computer.compute(record)} for record in records]
    write_jsonl(arguments.out, rewarded)
    print(f"wrote {len(rewarded)} rewarded traces to {arguments.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
