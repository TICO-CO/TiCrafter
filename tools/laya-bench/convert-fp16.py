import argparse
import shutil
from pathlib import Path

import onnx
from onnxruntime.transformers import float16


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Convert a Laya ONNX bundle to float16 for the WebGPU execution provider."
    )
    parser.add_argument("source", type=Path, help="source bundle directory")
    parser.add_argument("target", type=Path, help="target bundle directory")
    return parser.parse_args()


def main():
    arguments = parse_arguments()
    source = arguments.source
    target = arguments.target
    model = float16.convert_float_to_float16(str(source / "laya.onnx"), keep_io_types=True)
    target.mkdir(parents=True, exist_ok=True)
    onnx.save(model, str(target / "laya.onnx"))
    shutil.copy2(source / "laya_config.json", target / "laya_config.json")
    shutil.copytree(source / "tokenizer", target / "tokenizer", dirs_exist_ok=True)
    print(f"converted {source} to {target}")


if __name__ == "__main__":
    main()
