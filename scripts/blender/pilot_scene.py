"""Build real rigs/actions in a separate scene, preserving the model-review source."""

from __future__ import annotations

import json
from pathlib import Path

import bpy

from .animation import add_curl_shapes, build_actions
from .create_review import SCENE_NAME, camera, configure_render
from .geometry import ModelBuilder, set_enum
from .rigging import actor_meshes, bind, companion_rig, guardian_rig

PILOT_SCENE = "Chog_Aegis_AnimationPilot"


def make_pilot(output: Path) -> None:
    if bpy.data.scenes.get(PILOT_SCENE):
        raise ValueError(
            "Animation scene already exists; rebuild in an isolated process"
        )
    source = bpy.data.scenes.get(SCENE_NAME)
    if source is None:
        raise ValueError("Open the validated editable model source first")
    scene = bpy.data.scenes.new(PILOT_SCENE)
    meshes = actor_meshes(source, scene)
    rigs = {"aegis": guardian_rig(scene), "armadillo": companion_rig(scene)}
    bind(meshes, rigs)
    shaped = add_curl_shapes(meshes)
    actions = build_actions(rigs, shaped)
    studio = ModelBuilder(scene, "AnimationStudio")
    scene.world = source.world.copy()
    for old in source.objects:
        if old.type == "LIGHT":
            obj = bpy.data.objects.new("Pilot." + old.name, old.data.copy())
            scene.collection.objects.link(obj)
            obj.matrix_world = old.matrix_world.copy()
    hero = camera(studio, "Camera.AegisExport", (-7.5, -12, 4.6), (0, 0, 2.25), 4.2)
    pet = camera(
        studio, "Camera.ArmadilloExport", (-3.5, -3.8, 1.7), (1.58, -0.1, 0.47), 2.1
    )
    set_enum(hero.data, "sensor_fit", "HORIZONTAL")
    set_enum(pet.data, "sensor_fit", "HORIZONTAL")
    hero["pilot_actor"], pet["pilot_actor"] = "aegis", "armadillo"
    scene.camera = hero
    configure_render(scene, source.render.engine)
    scene.render.film_transparent = True
    set_enum(scene.render.image_settings, "color_mode", "RGBA")
    scene.render.resolution_x, scene.render.resolution_y = 320, 448
    scene.frame_end = 36
    scene.frame_set(1)
    scene["stage"] = "actual rigs/actions; transparent exports pending QA"
    scene["rig_names"] = json.dumps({actor: rig.name for actor, rig in rigs.items()})
    scene["actions"] = json.dumps(
        {
            actor: {clip: action.name for clip, action in clips.items()}
            for actor, clips in actions.items()
        }
    )
    scene["curl_meshes"] = json.dumps([obj.name for obj in shaped])
    output.mkdir(parents=True, exist_ok=True)
    action_ids = {action for clips in actions.values() for action in clips.values()}
    action_ids.update(bpy.data.actions[obj["curl_action"]] for obj in shaped)
    bpy.data.libraries.write(
        str(output / "aegis-armadillo-rigged.blend"),
        {scene, *action_ids},
        fake_user=True,
        compress=True,
    )
    print(
        json.dumps(
            {
                "scene": scene.name,
                "bones": {a: len(r.data.bones) for a, r in rigs.items()},
                "actions": {a: list(c.keys()) for a, c in actions.items()},
                "bound_meshes": len(meshes),
                "curl_shapes": len(shaped),
            },
            indent=2,
        )
    )
