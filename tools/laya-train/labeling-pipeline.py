#!/usr/bin/env python3
"""Label exported traces with outcome rewards and an optional cloud teacher."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


class TeacherClient:
    def __init__(self, base_url: str, api_key: str, model: str, timeout_seconds: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def label(self, trace: dict) -> str | None:
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "Return only a JSON object with a single string field bestAction.",
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "state": trace.get("state"),
                            "affordances": trace.get("affordances"),
                            "chosen": trace.get("choiceId"),
                        },
                        sort_keys=True,
                    ),
                },
            ],
            "temperature": 0,
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "authorization": f"Bearer {self.api_key}",
                "content-type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            return None
        content = body.get("choices", [{}])[0].get("message", {}).get("content")
        if not isinstance(content, str):
            return None
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return None
        best_action = parsed.get("bestAction")
        return best_action if isinstance(best_action, str) else None


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, sort_keys=True) + "\n")


def teacher_from_environment() -> TeacherClient | None:
    base_url = os.environ.get("TRAIN_TEACHER_BASE_URL", "")
    api_key = os.environ.get("TRAIN_TEACHER_API_KEY", "")
    model = os.environ.get("TRAIN_TEACHER_MODEL", "")
    if not base_url or not api_key or not model:
        return None
    return TeacherClient(base_url, api_key, model)


def label(trace: dict, teacher: TeacherClient | None) -> dict:
    best_action = teacher.label(trace) if teacher is not None else None
    return {
        **trace,
        "label": {
            "source": "teacher" if best_action is not None else "outcome",
            "bestAction": best_action if best_action is not None else trace.get("choiceId"),
            "outcome": trace.get("outcome"),
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--no-teacher", action="store_true")
    arguments = parser.parse_args(argv)
    if not arguments.input.exists():
        print(f"input not found: {arguments.input}", file=sys.stderr)
        return 1
    teacher = None if arguments.no_teacher else teacher_from_environment()
    records = [label(record, teacher) for record in read_jsonl(arguments.input)]
    write_jsonl(arguments.out, records)
    print(f"labeled {len(records)} traces to {arguments.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
