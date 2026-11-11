#!/usr/bin/env python3
"""Fine-tune a Laya-compatible causal language model from labeled traces."""

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path


def read_jsonl(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def training_text(record: dict) -> str:
    label = record.get("label") or {}
    chosen = label.get("bestAction") or record.get("choiceId") or "unknown"
    return json.dumps(
        {
            "state": record.get("state"),
            "affordances": record.get("affordances"),
            "outcome": record.get("outcome"),
            "bestAction": chosen,
        },
        sort_keys=True,
    )


def validate(records: list[dict]) -> list[str]:
    reasons = []
    if not records:
        reasons.append("dataset is empty")
    for index, record in enumerate(records):
        if record.get("state") is None:
            reasons.append(f"record {index} missing state")
        if record.get("affordances") is None:
            reasons.append(f"record {index} missing affordances")
    return reasons


def execute_training(
    records: list[dict],
    model_directory: Path,
    output_directory: Path,
    epochs: float,
    batch_size: int,
    learning_rate: float,
) -> None:
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )

    tokenizer = AutoTokenizer.from_pretrained(str(model_directory))
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(str(model_directory))
    texts = [training_text(record) for record in records]
    encodings = tokenizer(texts, truncation=True, max_length=1024, padding=True)

    class TraceDataset(torch.utils.data.Dataset):
        def __len__(self) -> int:
            return len(texts)

        def __getitem__(self, index: int) -> dict:
            return {key: value[index] for key, value in encodings.items()}

    output_directory.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".laya-finetune-", dir=output_directory.parent))
    try:
        arguments = TrainingArguments(
            output_dir=str(temporary / "checkpoints"),
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            learning_rate=learning_rate,
            save_strategy="no",
            logging_steps=10,
            report_to=[],
        )
        trainer = Trainer(
            model=model,
            args=arguments,
            train_dataset=TraceDataset(),
            data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
        )
        trainer.train()
        model.save_pretrained(str(temporary / "model"))
        tokenizer.save_pretrained(str(temporary / "model"))
        if output_directory.exists():
            shutil.rmtree(output_directory)
        (temporary / "model").rename(output_directory)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--model-dir", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--execute", action="store_true")
    arguments = parser.parse_args(argv)
    if not arguments.dataset.exists():
        print(f"dataset not found: {arguments.dataset}", file=sys.stderr)
        return 1
    records = read_jsonl(arguments.dataset)
    reasons = validate(records)
    if reasons:
        for reason in reasons:
            print(reason, file=sys.stderr)
        return 1
    if not arguments.execute:
        print(f"validated {len(records)} traces; pass --execute to train")
        return 0
    if arguments.model_dir is None or arguments.out is None:
        print("--model-dir and --out are required with --execute", file=sys.stderr)
        return 1
    execute_training(
        records,
        arguments.model_dir,
        arguments.out,
        arguments.epochs,
        arguments.batch_size,
        arguments.learning_rate,
    )
    print(f"fine-tuned model written to {arguments.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
