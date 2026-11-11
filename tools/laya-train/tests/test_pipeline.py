import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


trace_exporter = load("trace_exporter", "trace-exporter.py")
reward_computer = load("reward_computer", "reward-computer.py")
calibration_fitter = load("calibration_fitter", "calibration-fitter.py")
promotion_gate = load("promotion_gate", "promotion-gate.py")
onnx_exporter = load("onnx_exporter", "onnx-exporter.py")


class TrainingPipelineTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.directory.cleanup()

    def test_trace_export_and_reward(self):
        database_path = Path(self.directory.name) / "trace.db"
        connection = sqlite3.connect(database_path)
        connection.execute(
            "CREATE TABLE bot_events (id INTEGER PRIMARY KEY, bot_id TEXT, type TEXT, payload_json TEXT, actor TEXT, causation_id TEXT, created_at TEXT)"
        )
        request = {
            "request": {
                "digest": {"health": 20, "taskId": "task-1"},
                "affordances": [{"id": "navigate:0", "skillId": "navigate"}],
            },
            "response": {"choiceId": "navigate:0", "probabilities": {"navigate:0": 0.9}},
            "parsed": {"dangerScore": 0.1, "shouldContinueScore": 0.8},
        }
        connection.execute(
            "INSERT INTO bot_events VALUES (1, 'bot.one', 'decision.trace', ?, 'bot.one', NULL, '2026-11-11T10:00:00.000Z')",
            (json.dumps(request),),
        )
        connection.execute(
            "INSERT INTO bot_events VALUES (2, 'bot.one', 'skill.progress', ?, 'bot.one', NULL, '2026-11-11T10:00:01.000Z')",
            (
                json.dumps(
                    {
                        "taskId": "task-1",
                        "skillId": "navigate",
                        "status": "completed",
                        "progress": {"done": 1, "total": 1},
                    }
                ),
            ),
        )
        connection.commit()
        connection.close()

        traces = trace_exporter.export_traces(trace_exporter.read_events(database_path))
        self.assertEqual(len(traces), 1)
        self.assertEqual(traces[0]["outcome"]["status"], "completed")
        reward = reward_computer.RewardComputer().compute(traces[0])
        self.assertGreater(reward, 0)

    def test_calibration_and_promotion(self):
        records = [
            {
                "probabilities": {"a": 0.9, "b": 0.1},
                "label": {"bestAction": "a"},
                "dangerScore": 0.2,
                "danger": False,
                "shouldContinueScore": 0.8,
                "shouldContinue": True,
            }
        ]
        temperatures = calibration_fitter.TemperatureFitter().fit(records)
        self.assertIn("nextAction", temperatures)

        report = promotion_gate.PromotionGate().evaluate(
            {"p95": 100, "successRate": 0.9, "soakCompleted": True},
            {"successRate": 0.7},
            {"ece": 0.02},
        )
        self.assertTrue(report["promote"])

    def test_onnx_bundle_is_immutable_and_manifested(self):
        source = Path(self.directory.name) / "source"
        source.mkdir()
        (source / "laya.onnx").write_bytes(b"onnx")
        out = Path(self.directory.name) / "bundle"
        onnx_exporter.export_bundle(source, out, "rev-1")
        manifest = json.loads((out / "manifest.json").read_text())
        self.assertEqual(manifest["revision"], "rev-1")
        self.assertIn("laya.onnx", manifest["files"])


if __name__ == "__main__":
    unittest.main()
