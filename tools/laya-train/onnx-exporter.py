#!/usr/bin/env python3
"""Publish an immutable ONNX bundle with checksums and provenance."""

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


ONNX_FILENAMES = ("laya.onnx", "model.onnx")


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_onnx(directory: Path) -> Path | None:
    for name in ONNX_FILENAMES:
        candidate = directory / name
        if candidate.exists():
            return candidate
    return None


def write_manifest(bundle: Path, source: Path, revision: str) -> None:
    files = sorted(path for path in bundle.rglob("*") if path.is_file())
    manifest = {
        "revision": revision,
        "source": str(source),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": {
            str(path.relative_to(bundle)): checksum(path)
            for path in files
            if path.name != "manifest.json"
        },
    }
    (bundle / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def export_bundle(source: Path, out: Path, revision: str) -> None:
    if find_onnx(source) is None:
        raise FileNotFoundError(f"no ONNX file found in {source}")
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".onnx-export-", dir=out.parent))
    try:
        for item in source.iterdir():
            if item.name == "manifest.json":
                continue
            destination = temporary / item.name
            if item.is_dir():
                shutil.copytree(item, destination)
            else:
                shutil.copy2(item, destination)
        write_manifest(temporary, source, revision)
        if out.exists():
            shutil.rmtree(out)
        temporary.rename(out)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--revision", required=True)
    arguments = parser.parse_args(argv)
    if not arguments.source.exists():
        print(f"source not found: {arguments.source}", file=sys.stderr)
        return 1
    try:
        export_bundle(arguments.source, arguments.out, arguments.revision)
    except FileNotFoundError as error:
        print(str(error), file=sys.stderr)
        return 1
    print(f"exported ONNX bundle to {arguments.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
