#!/usr/bin/env python3
"""Export decision, skill, and task traces from the coordinator SQLite database."""

import argparse
import json
import sqlite3
import sys
from pathlib import Path


TERMINAL_SKILL_STATUSES = {"completed", "failed", "cancelled"}
TERMINAL_TASK_STATUSES = {"completed", "failed", "dead_letter", "cancelled"}


def read_events(database_path: Path) -> list[dict]:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            "SELECT id, bot_id, type, payload_json, actor, causation_id, created_at "
            "FROM bot_events ORDER BY id ASC"
        ).fetchall()
    finally:
        connection.close()
    events = []
    for row in rows:
        events.append(
            {
                "id": row["id"],
                "botId": row["bot_id"],
                "type": row["type"],
                "payload": json.loads(row["payload_json"]),
                "actor": row["actor"],
                "causationId": row["causation_id"],
                "createdAt": row["created_at"],
            }
        )
    return events


def find_outcome(events: list[dict], index: int, bot_id: str | None, task_id: str | None) -> dict | None:
    for event in events[index + 1 : index + 128]:
        if event["botId"] != bot_id:
            continue
        payload = event["payload"] if isinstance(event["payload"], dict) else {}
        if event["type"] == "skill.progress":
            if task_id is not None and payload.get("taskId") != task_id:
                continue
            if payload.get("status") in TERMINAL_SKILL_STATUSES:
                return {
                    "kind": "skill",
                    "status": payload.get("status"),
                    "skillId": payload.get("skillId"),
                    "progress": payload.get("progress"),
                    "failureClass": payload.get("failureClass"),
                    "at": event["createdAt"],
                }
        if event["type"] == "task.transition":
            if task_id is not None and payload.get("taskId") != task_id:
                continue
            if payload.get("to") in TERMINAL_TASK_STATUSES:
                return {
                    "kind": "task",
                    "status": payload.get("to"),
                    "reason": payload.get("reason"),
                    "at": event["createdAt"],
                }
    return None


def export_traces(events: list[dict]) -> list[dict]:
    traces = []
    for index, event in enumerate(events):
        if event["type"] != "decision.trace":
            continue
        payload = event["payload"] if isinstance(event["payload"], dict) else {}
        request = payload.get("request")
        if not isinstance(request, dict):
            request = {}
        digest = request.get("digest")
        if not isinstance(digest, dict):
            digest = {}
        task_id = digest.get("taskId")
        response = payload.get("response")
        if not isinstance(response, dict):
            response = {}
        parsed = payload.get("parsed")
        if not isinstance(parsed, dict):
            parsed = {}
        traces.append(
            {
                "eventId": event["id"],
                "botId": event["botId"],
                "at": event["createdAt"],
                "taskId": task_id,
                "state": digest,
                "affordances": request.get("affordances", []),
                "choiceId": response.get("choiceId"),
                "probabilities": response.get("probabilities", {}),
                "answerConfidence": response.get("answerConfidence"),
                "danger": response.get("danger"),
                "shouldContinue": response.get("shouldContinue"),
                "dangerScore": parsed.get("dangerScore"),
                "shouldContinueScore": parsed.get("shouldContinueScore"),
                "source": response.get("source"),
                "latencyMilliseconds": response.get("latencyMilliseconds"),
                "fallback": payload.get("fallback"),
                "failure": payload.get("failure"),
                "outcome": find_outcome(events, index, event["botId"], task_id),
            }
        )
    return traces


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as output:
        for record in records:
            output.write(json.dumps(record, sort_keys=True) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    arguments = parser.parse_args(argv)
    if not arguments.database.exists():
        print(f"database not found: {arguments.database}", file=sys.stderr)
        return 1
    traces = export_traces(read_events(arguments.database))
    write_jsonl(arguments.out, traces)
    print(f"exported {len(traces)} traces to {arguments.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
