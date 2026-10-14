"""Convert the isolated scene library into a normally opening review project.

Run in a separate background Blender process; never operate on the user's live file.
"""

import sys
from pathlib import Path

import bpy


def source_scene(source: Path) -> bpy.types.Scene:
    from scripts.blender.create_review import SCENE_NAME, SOURCE_NAME, validate
    from scripts.blender.pilot_scene import PILOT_SCENE

    if (
        source.name not in [SOURCE_NAME, "aegis-armadillo-rigged.blend"]
        or not source.is_file()
    ):
        raise ValueError("Open the generated review file before finalizing")
    is_rig = source.name == "aegis-armadillo-rigged.blend"
    scene = bpy.data.scenes.get(PILOT_SCENE if is_rig else SCENE_NAME)
    if scene is None:
        raise ValueError("Generated model review scene is missing")
    if is_rig:
        if len([o for o in scene.objects if o.type == "ARMATURE"]) != 2:
            raise ValueError("Expected the two pilot rigs")
    else:
        validate(scene)
    return scene


def finalize() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from scripts.blender.geometry import set_enum

    if not bpy.app.background:
        raise RuntimeError("Finalization requires a separate background process")
    source = Path(bpy.data.filepath)
    scene = source_scene(source)
    bpy.context.window.scene = scene
    # Library loads create an empty startup scene. Remove only those empty scenes here.
    for candidate in list(bpy.data.scenes):
        if candidate != scene and not candidate.objects:
            bpy.data.scenes.remove(candidate)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                set_enum(area.spaces.active.region_3d, "view_perspective", "CAMERA")
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    print("Finalized normal project with active scene:", bpy.context.scene.name)


if __name__ == "__main__":
    finalize()
