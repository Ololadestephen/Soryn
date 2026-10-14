"""Render verified skeletal actions to transparent, consistently framed PNG samples."""

import argparse
import json
import sys
from pathlib import Path

import bpy


def sample_frames(clip: str, count: int) -> list[int]:
    if clip == "idle":
        return list(range(1, 25, 2))
    if clip == "guard":
        return list(range(1, 7)) + [24]
    return list(range(1, count + 1))


def render(output: Path) -> None:
    from scripts.blender.animation import CLIPS, activate
    from scripts.blender.files import write_json
    from scripts.blender.geometry import set_enum
    from scripts.blender.pilot_scene import PILOT_SCENE

    scene = bpy.data.scenes.get(PILOT_SCENE)
    if scene is None:
        raise ValueError("Open the rigged pilot file first")
    bpy.context.window.scene = scene
    rigs = {a: bpy.data.objects[n] for a, n in json.loads(scene["rig_names"]).items()}
    actions = {
        a: {c: bpy.data.actions[n] for c, n in clips.items()}
        for a, clips in json.loads(scene["actions"]).items()
    }
    shaped = [bpy.data.objects[n] for n in json.loads(scene["curl_meshes"])]
    cameras = {o["pilot_actor"]: o for o in scene.objects if o.type == "CAMERA"}
    scene.render.film_transparent = True
    set_enum(scene.render.image_settings, "color_mode", "RGBA")
    manifest = {
        "source": bpy.data.filepath,
        "blender": bpy.app.version_string,
        "sourceFps": 24,
        "actors": {},
    }
    for actor in ["aegis", "armadillo"]:
        width, height = (320, 448) if actor == "aegis" else (256, 224)
        scene.render.resolution_x, scene.render.resolution_y = width, height
        scene.camera = cameras[actor]
        for obj in scene.objects:
            if obj.type == "MESH" and "pilot_actor" in obj:
                obj.hide_render = obj["pilot_actor"] != actor
        actor_manifest = {"width": width, "height": height, "clips": {}}
        for clip, count in CLIPS.items():
            if actor == "armadillo" and clip not in ["idle", "special", "defeated"]:
                continue
            activate(rigs, actions, shaped, clip)
            frames = sample_frames(clip, count)
            directory = output / actor / clip
            directory.mkdir(parents=True, exist_ok=True)
            for n, frame in enumerate(frames):
                scene.frame_set(frame)
                scene.render.filepath = str(directory / f"{n:03}.png")
                bpy.ops.render.render(write_still=True)
            actor_manifest["clips"][clip] = {
                "sourceFrames": frames,
                "count": len(frames),
            }
        manifest["actors"][actor] = actor_manifest
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / "frames.json", manifest)
    print("Transparent action samples exported:", output)


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "assets/combat/blender/frames",
    )
    args = parser.parse_args(argv)
    render(args.output)


if __name__ == "__main__":
    main()
