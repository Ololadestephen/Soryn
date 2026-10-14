"""CLI entry point: open the model-review blend, then build the isolated pilot."""

import argparse
import sys
from pathlib import Path


def main() -> None:
    project = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(project))
    from scripts.blender.pilot_scene import make_pilot

    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=project / "assets/combat/blender/animation-pilot"
    )
    args = parser.parse_args(argv)
    make_pilot(args.output)


if __name__ == "__main__":
    main()
