#!/usr/bin/env python3
"""Fit per-question temperatures from held-out traced decisions."""

import argparse
import json
import math
import sys
from pathlib import Path


TEMPERATURES = [value / 10.0 for value in range(1, 51)]


class TemperatureFitter:
    def fit_next_action(self, records: list[dict]) -> float:
        best_temperature = 1.0
        best_loss = float("inf")
        for temperature in TEMPERATURES:
            loss = 0.0
            count = 0
            for record in records:
                label = (record.get("label") or {}).get("bestAction")
                probabilities = record.get("probabilities") or {}
                if label is None or label not in probabilities:
                    continue
                tempered = self.tempered(probabilities, temperature)
                probability = max(tempered.get(label, 0.0), 1e-9)
                loss -= math.log(probability)
                count += 1
            if count == 0:
                continue
            if loss / count < best_loss:
                best_loss = loss / count
                best_temperature = temperature
        return best_temperature

    def fit_binary(self, records: list[dict], score_field: str, label_field: str) -> float:
        best_temperature = 1.0
        best_loss = float("inf")
        for temperature in TEMPERATURES:
            loss = 0.0
            count = 0
            for record in records:
                score = record.get(score_field)
                label = record.get(label_field)
                if not isinstance(score, (int, float)) or not isinstance(label, bool):
                    continue
                probability = self.sigmoid(score / temperature)
                target = 1.0 if label else 0.0
                loss -= target * math.log(max(probability, 1e-9))
                loss -= (1.0 - target) * math.log(max(1.0 - probability, 1e-9))
                count += 1
            if count == 0:
                continue
            if loss / count < best_loss:
                best_loss = loss / count
                best_temperature = temperature
        return best_temperature

    def fit(self, records: list[dict]) -> dict:
        return {
            "nextAction": self.fit_next_action(records),
            "danger": self.fit_binary(records, "dangerScore", "danger"),
            "shouldContinue": self.fit_binary(records, "shouldContinueScore", "shouldContinue"),
            "records": len(records),
        }

    def tempered(self, probabilities: dict, temperature: float) -> dict:
        weighted = {
            choice: math.pow(max(float(probability), 0.0), 1.0 / temperature)
            for choice, probability in probabilities.items()
        }
        total = sum(weighted.values())
        if total <= 0:
            return dict(probabilities)
        return {choice: weight / total for choice, weight in weighted.items()}

    def sigmoid(self, value: float) -> float:
        return 1.0 / (1.0 + math.exp(-value))


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    arguments = parser.parse_args(argv)
    if not arguments.input.exists():
        print(f"input not found: {arguments.input}", file=sys.stderr)
        return 1
    records = read_jsonl(arguments.input)
    fitter = TemperatureFitter()
    report = fitter.fit(records)
    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    arguments.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
