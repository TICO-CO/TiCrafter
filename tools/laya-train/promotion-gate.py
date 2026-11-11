#!/usr/bin/env python3
"""Evaluate candidate model reports and decide whether promotion is allowed."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


MAXIMUM_P95_MILLISECONDS = 250.0
MAXIMUM_EXPECTED_CALIBRATION_ERROR = 0.1


class PromotionGate:
    def evaluate(self, candidate: dict, baseline: dict | None, calibration: dict | None) -> dict:
        reasons = []
        candidate_p95 = float(candidate.get("p95", candidate.get("latencyP95", 0.0)))
        candidate_success = float(candidate.get("successRate", 0.0))
        baseline_success = float((baseline or {}).get("successRate", 0.0))
        candidate_ece = float((calibration or {}).get("ece", 0.0))
        if candidate_p95 > MAXIMUM_P95_MILLISECONDS:
            reasons.append(f"p95 exceeds {MAXIMUM_P95_MILLISECONDS}ms")
        if baseline is not None and candidate_success <= baseline_success:
            reasons.append("candidate does not beat deterministic baseline")
        if candidate_ece > MAXIMUM_EXPECTED_CALIBRATION_ERROR:
            reasons.append(f"ECE exceeds {MAXIMUM_EXPECTED_CALIBRATION_ERROR}")
        if candidate.get("soakCompleted") is not True:
            reasons.append("2h stability soak not completed")
        return {
            "promote": len(reasons) == 0,
            "reasons": reasons,
            "candidate": candidate,
            "baseline": baseline,
            "calibration": calibration,
            "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        }


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", required=True, type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--calibration", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    arguments = parser.parse_args(argv)
    if not arguments.candidate.exists():
        print(f"candidate report not found: {arguments.candidate}", file=sys.stderr)
        return 1
    candidate = read_json(arguments.candidate)
    baseline = read_json(arguments.baseline) if arguments.baseline else None
    calibration = read_json(arguments.calibration) if arguments.calibration else None
    report = PromotionGate().evaluate(candidate, baseline, calibration)
    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    arguments.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"promote": report["promote"], "reasons": report["reasons"]}, sort_keys=True))
    return 0 if report["promote"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
