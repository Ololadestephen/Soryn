"""Blender CLI entry point; path setup is confined to execution."""

import argparse
import sys
from pathlib import Path


def main() -> None:
    project = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(project))
    from scripts.blender.create_review import build

    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=project / "assets/combat/blender/review-v05"
    )
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(argv)
    build(args.output, args.render)


if __name__ == "__main__":
    main()
