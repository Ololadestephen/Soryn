"""Editable skeletal actions sampled at real frames; combat remains server-owned."""

from __future__ import annotations

import math

import bpy
from mathutils import Euler, Vector

from .geometry import Vec3, set_enum
from .rigging import move_world

CLIPS = {
    "idle": 24,
    "basic": 32,
    "special": 36,
    "guard": 24,
    "guard-recovery": 6,
    "counter": 26,
    "hit": 12,
    "guard-hit": 12,
    "knockout": 20,
    "guard-knockout": 20,
    "defeated": 1,
}


def ease(value: float) -> float:
    value = min(1.0, max(0.0, value))
    return value * value * (3 - 2 * value)


def envelope(
    frame: int, windup: int, contact: int, follow: int, end: int
) -> tuple[float, float]:
    if frame <= windup:
        return ease((frame - 1) / max(1, windup - 1)), 0
    if frame <= contact:
        return 1, ease((frame - windup) / (contact - windup))
    if frame <= follow:
        return 1, 1 - 0.2 * ease((frame - contact) / (follow - contact))
    recovery = 1 - ease((frame - follow) / (end - follow))
    return recovery, 0.8 * recovery


def rotate_world(rig: bpy.types.Object, name: str, angles: Vec3) -> None:
    pose = rig.pose.bones[name]
    rest = pose.bone.matrix_local.to_3x3()
    relative = rest.inverted() @ Euler(angles, "XYZ").to_matrix() @ rest
    pose.rotation_euler = relative.to_euler("XYZ")


def reset(rig: bpy.types.Object) -> None:
    for item in rig.pose.bones:
        set_enum(item, "rotation_mode", "XYZ")
        item.location, item.rotation_euler, item.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)


def guardian_guard(rig: bpy.types.Object, amount: float) -> None:
    move_world(rig, "forearm_ik.L", (0.1 * amount, -0.18 * amount, 0.48 * amount))
    move_world(rig, "forearm_ik.R", (-0.07 * amount, -0.06 * amount, 0.08 * amount))
    rotate_world(rig, "shield", (0.04 * amount, -0.11 * amount, -0.12 * amount))
    rotate_world(rig, "spine", (0.035 * amount, 0, 0))


def guardian_attack(rig: bpy.types.Object, clip: str, frame: int) -> None:
    special = clip == "special"
    windup, contact, follow, end = (6, 18, 30, 36) if special else (6, 14, 26, 32)
    ready, push = envelope(frame, windup, contact, follow, end)
    pull = ready * (1 - push)
    prepared = (1 - ready) if special and frame <= windup else 0
    move_world(rig, "hips", (0, 0.035 * pull - 0.1 * push, 0))
    rotate_world(rig, "spine", (-0.06 * pull + 0.12 * push, 0, 0))
    move_world(
        rig,
        "forearm_ik.L",
        (
            0.04 * ready + 0.1 * prepared,
            0.16 * pull - (0.62 if special else 0.38) * push - 0.18 * prepared,
            (0.38 if special else 0.09) * pull + 0.08 * push + 0.48 * prepared,
        ),
    )
    move_world(
        rig, "forearm_ik.R", (0.05 * ready, 0.07 * pull - 0.17 * push, -0.05 * push)
    )
    rotate_world(
        rig, "shield", (-0.05 * pull + 0.1 * push, -0.08 * push, -0.07 * ready)
    )
    # Unweight the leading foot during advance/return; idle and guard stay planted.
    if windup < frame < contact:
        step = math.sin(math.pi * (frame - windup) / (contact - windup))
        move_world(rig, "shin_ik.L", (0, -0.1 * push, 0.11 * step))
    elif follow < frame < end:
        step = math.sin(math.pi * (frame - follow) / (end - follow))
        move_world(rig, "shin_ik.L", (0, 0, 0.09 * step))


def guardian_pose(rig: bpy.types.Object, clip: str, frame: int) -> None:
    if clip == "idle":
        breath = math.sin(math.tau * (frame - 1) / 24)
        rig.pose.bones["spine"].scale = (1 + 0.007 * breath, 1 + 0.008 * breath, 1)
        rotate_world(rig, "head", (0.014 * breath, 0, 0))
    elif clip in ["basic", "special"]:
        guardian_attack(rig, clip, frame)
    elif clip == "guard":
        guardian_guard(rig, ease((frame - 1) / 5))
    elif clip == "guard-recovery":
        guardian_guard(rig, 1 - ease((frame - 1) / 5))
    elif clip == "counter":
        guardian_guard(rig, 1)
        push = ease((frame - 1) / 7) if frame <= 8 else 1 - ease((frame - 20) / 6)
        move_world(rig, "forearm_ik.L", (0.1, -0.18 - 0.25 * push, 0.48 - 0.18 * push))
        rotate_world(rig, "spine", (0.035 + 0.07 * push, 0, 0))
    elif clip in ["hit", "guard-hit"]:
        if clip == "guard-hit":
            guardian_guard(rig, 1)
        recoil = math.sin(math.pi * (frame - 1) / 11)
        move_world(rig, "hips", (0, 0.06 * recoil, -0.035 * recoil))
        rotate_world(rig, "spine", (-0.16 * recoil, 0, 0))
        rotate_world(rig, "head", (-0.1 * recoil, 0, 0))
    elif clip in ["knockout", "guard-knockout", "defeated"]:
        fall = 1 if clip == "defeated" else ease((frame - 1) / 17)
        move_world(rig, "hips", (0, -0.07 * fall, -0.83 * fall))
        rotate_world(rig, "spine", (0.29 * fall, 0, 0))
        rotate_world(rig, "head", (0.38 * fall, 0, 0))
        guard = (1 - fall) if clip == "guard-knockout" else 0
        move_world(
            rig,
            "forearm_ik.L",
            (
                0.09 * fall + 0.1 * guard,
                -0.07 * fall - 0.18 * guard,
                -0.6 * fall + 0.48 * guard,
            ),
        )
        move_world(rig, "forearm_ik.R", (0, -0.23 * fall, -0.74 * fall))
        rotate_world(rig, "shield", (0.03 * fall, 0, 0.06 * fall))


def add_curl_shapes(meshes: list[bpy.types.Object]) -> list[bpy.types.Object]:
    shaped = []
    center = Vector((1.58, -0.15, 0.461))
    for obj in meshes:
        if obj["pilot_actor"] != "armadillo":
            continue
        part = obj["pilot_part"]
        if not any(
            s in part
            for s in [
                "shell-base",
                "body-under-shell",
                "shell-ivory-band",
                "shell-band-gold-piping",
                "shell-temple-hinge",
            ]
        ):
            continue
        if obj.data.shape_keys is None:
            obj.shape_key_add(name="Basis")
        key = obj.data.shape_keys.key_blocks.get("Curl") or obj.shape_key_add(
            name="Curl"
        )
        inverse = obj.matrix_world.inverted()
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        basis = obj.data.shape_keys.key_blocks["Basis"]
        for n, vertex in enumerate(key.data):
            world = obj.matrix_world @ basis.data[n].co
            delta = world - center
            if delta.length > 0.001:
                normal = (normal_matrix @ obj.data.vertices[n].normal).normalized()
                facing = normal.dot(delta.normalized())
                radius = 0.40 if "body-under-shell" in part else 0.428
                if "shell-ivory-band" in part:
                    radius = 0.458 + 0.011 * facing
                elif "shell-band-gold-piping" in part:
                    radius = 0.474 + 0.006 * facing
                elif "shell-temple-hinge" in part:
                    radius = 0.476 + 0.012 * facing
                vertex.co = inverse @ (center + delta.normalized() * radius)
        shaped.append(obj)
    return shaped


def companion_pose(rig: bpy.types.Object, clip: str, frame: int) -> float:
    if clip == "idle":
        rotate_world(rig, "head", (0.016 * math.sin(math.tau * (frame - 1) / 24), 0, 0))
    if clip != "special":
        return 0
    curl = envelope(frame, 6, 18, 30, 36)[0]
    # Body closes continuously, then rolls a full revolution during the actual delivery.
    move_world(rig, "root", (0, 0, 0.019 * curl))
    roll = 0 if frame <= 6 else math.tau * ease(min(1, (frame - 6) / 12))
    # Root rest axes match world axes. Keep a continuous unwrapped revolution.
    rig.pose.bones["root"].rotation_euler.x = roll
    move_world(rig, "head", (0, 0.5 * curl, 0))
    rotate_world(rig, "head", (2.0 * curl, 0, 0))
    rig.pose.bones["head"].scale = (1 - 0.18 * curl,) * 3
    move_world(rig, "tail", (0, -0.16 * curl, 0))
    rotate_world(rig, "tail", (2.85 * curl, 0, 0))
    for side in ["L", "R"]:
        sign = -1 if side == "L" else 1
        rotate_world(rig, "leg." + side + ".0", (1.3 * curl, 0, 0))
        rotate_world(rig, "leg." + side + ".1", (-1.3 * curl, 0, 0))
        for n in [0, 1]:
            move_world(
                rig,
                f"leg.{side}.{n}",
                (-sign * 0.1 * curl, (0.18 if n == 0 else -0.06) * curl, 0.05 * curl),
            )
            rig.pose.bones[f"leg.{side}.{n}"].scale = (1 - 0.5 * curl,) * 3
    return curl


def build_actions(
    rigs: dict[str, bpy.types.Object], shaped: list[bpy.types.Object]
) -> dict[str, dict[str, bpy.types.Action]]:
    actions: dict[str, dict[str, bpy.types.Action]] = {actor: {} for actor in rigs}
    for actor, rig in rigs.items():
        rig.animation_data_create()
        for clip, frames in CLIPS.items():
            if actor == "armadillo" and clip not in ["idle", "special", "defeated"]:
                continue
            action = bpy.data.actions.new(f"Pilot.{actor}.{clip}")
            action.use_fake_user = True
            rig.animation_data.action = action
            for frame in range(1, frames + 1):
                reset(rig)
                if actor == "aegis":
                    guardian_pose(rig, clip, frame)
                else:
                    companion_pose(rig, clip, frame)
                for item in rig.pose.bones:
                    for property_name in ["location", "rotation_euler", "scale"]:
                        item.keyframe_insert(
                            data_path=property_name, frame=frame, group=item.name
                        )
            actions[actor][clip] = action
        rig.animation_data.action = actions[actor]["idle"]
        reset(rig)
    # Morph actions live on Key datablocks separately from skeletal actions.
    for obj in shaped:
        key = obj.data.shape_keys.key_blocks["Curl"]
        for frame in range(1, CLIPS["special"] + 1):
            key.value = envelope(frame, 6, 18, 30, 36)[0]
            key.keyframe_insert(data_path="value", frame=frame)
        obj.data.shape_keys.animation_data.action.use_fake_user = True
        obj["curl_action"] = obj.data.shape_keys.animation_data.action.name
        obj.data.shape_keys.animation_data.action = None
        key.value = 0
    return actions


def activate(
    rigs: dict[str, bpy.types.Object],
    actions: dict[str, dict[str, bpy.types.Action]],
    shaped: list[bpy.types.Object],
    clip: str,
) -> None:
    for actor, rig in rigs.items():
        rig.animation_data.action = actions[actor].get(clip, actions[actor]["idle"])
    for obj in shaped:
        obj.data.shape_keys.animation_data.action = (
            bpy.data.actions[obj["curl_action"]] if clip == "special" else None
        )
        if clip != "special":
            obj.data.shape_keys.key_blocks["Curl"].value = 0
