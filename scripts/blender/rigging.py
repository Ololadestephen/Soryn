"""Actual deform rigs for the original pilot; no game-rule authority."""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

from .geometry import Vec3, set_enum


def operator_mode(identifier: str) -> None:
    choices = bpy.ops.object.mode_set.get_rna_type().properties["mode"].enum_items
    value = next(i.identifier for i in choices if i.identifier == identifier)
    bpy.ops.object.mode_set(mode=value)


def actor_meshes(
    source: bpy.types.Scene, target: bpy.types.Scene
) -> list[bpy.types.Object]:
    bpy.context.window.scene = source
    depsgraph = bpy.context.evaluated_depsgraph_get()
    result = []
    for original in source.objects:
        actor = "aegis" if original.name.startswith("Aegis.") else "armadillo"
        if not original.name.startswith(("Aegis.", "Armadillo.")):
            continue
        if original.type not in ["MESH", "CURVE"]:
            continue
        mesh = bpy.data.meshes.new_from_object(
            original.evaluated_get(depsgraph),
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        obj = bpy.data.objects.new("Pilot." + original.name, mesh)
        target.collection.objects.link(obj)
        obj.matrix_world = original.matrix_world.copy()
        obj["pilot_actor"], obj["pilot_part"] = actor, original.name
        result.append(obj)
    bpy.context.window.scene = target
    return result


def armature(scene: bpy.types.Scene, name: str) -> bpy.types.Object:
    data = bpy.data.armatures.new(name + ".skeleton")
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    set_enum(data, "display_type", "STICK")
    obj.show_in_front = True
    operator_mode("EDIT")
    return obj


def bone(
    rig: bpy.types.Object,
    name: str,
    head: Vec3,
    tail: Vec3,
    parent: str | None = None,
    deform=True,
    inherit_rotation=True,
) -> None:
    item = rig.data.edit_bones.new(name)
    item.head, item.tail = head, tail
    if parent:
        item.parent = rig.data.edit_bones[parent]
    item.use_deform = deform
    item.use_inherit_rotation = inherit_rotation
    set_enum(item, "inherit_scale", "NONE")


def pole_position(start: Vec3, joint: Vec3, end: Vec3) -> Vec3:
    line = Vector(end) - Vector(start)
    projection = Vector(start) + line * (
        (Vector(joint) - Vector(start)).dot(line) / line.length_squared
    )
    direction = Vector(joint) - projection
    if direction.length < 0.001:
        raise ValueError("An IK limb needs a bent rest joint")
    return tuple(Vector(joint) + direction.normalized() * 0.8)


def ik_chain(
    rig: bpy.types.Object, lower: str, control: str, pole: str, expected_joint: Vec3
) -> None:
    kinds = bpy.types.Constraint.bl_rna.properties["type"].enum_items
    kind = next(i.identifier for i in kinds if i.identifier == "IK")
    constraint = rig.pose.bones[lower].constraints.new(kind)
    constraint.target, constraint.subtarget = rig, control
    constraint.pole_target, constraint.pole_subtarget = rig, pole
    constraint.chain_count, constraint.use_stretch = 2, False
    best = (math.inf, 0.0)
    for n in range(128):
        angle = -math.pi + n * math.tau / 128
        constraint.pole_angle = angle
        bpy.context.view_layer.update()
        joint = rig.pose.bones[lower].head
        distance = (joint - Vector(expected_joint)).length
        if distance < best[0]:
            best = (distance, angle)
    constraint.pole_angle = best[1]
    bpy.context.view_layer.update()


def guardian_rig(scene: bpy.types.Scene) -> bpy.types.Object:
    rig = armature(scene, "Aegis.DeformRig")
    bone(rig, "root", (0, 0, 0), (0, 0.25, 0), deform=False)
    bone(rig, "hips", (0, 0.04, 1.95), (0, 0.04, 2.25), "root")
    bone(rig, "spine", (0, 0.04, 2.25), (0, 0.04, 3.45), "hips")
    bone(rig, "head", (0, 0.02, 3.52), (0, 0.02, 4.25), "spine")
    bone(rig, "tail", (0, 0.29, 1.99), (0.72, 0.57, 1.61), "hips")
    chains = []
    for sign, suffix in [(-1, "L"), (1, "R")]:
        hip, knee, ankle = (
            (sign * 0.32, 0.03, 1.95),
            (sign * 0.53, -0.03, 1.14),
            (sign * 0.6, 0.04, 0.38),
        )
        shoulder, elbow, wrist = (
            (sign * 0.73, 0.02, 3.23),
            (sign * 0.95, -0.04, 2.87),
            (sign * 1.02, -0.23, 2.44),
        )
        for upper, lower, start, joint, end, parent in [
            ("thigh", "shin", hip, knee, ankle, "hips"),
            ("upper_arm", "forearm", shoulder, elbow, wrist, "spine"),
        ]:
            bone(rig, upper + "." + suffix, start, joint, parent)
            bone(rig, lower + "." + suffix, joint, end, upper + "." + suffix)
            control = lower + "_ik." + suffix
            pole = lower + "_pole." + suffix
            bone(
                rig,
                control,
                end,
                tuple(Vector(end) + Vector((0, 0.2, 0))),
                "root",
                deform=False,
            )
            point = pole_position(start, joint, end)
            bone(
                rig,
                pole,
                point,
                tuple(Vector(point) + Vector((0, 0.2, 0))),
                "root",
                deform=False,
            )
            chains.append((lower + "." + suffix, control, pole, joint))
        bone(
            rig,
            "foot." + suffix,
            ankle,
            tuple(Vector(ankle) + Vector((0, 0.2, 0))),
            "shin." + suffix,
            inherit_rotation=False,
        )
        bone(
            rig,
            "hand." + suffix,
            wrist,
            tuple(Vector(wrist) + Vector((0, 0.2, 0))),
            "forearm." + suffix,
            inherit_rotation=False,
        )
    bone(rig, "shield", (-1.01, -0.68, 2.16), (-1.01, -0.38, 2.16), "hand.L")
    operator_mode("OBJECT")
    for args in chains:
        ik_chain(rig, *args)
    return rig


def companion_rig(scene: bpy.types.Scene) -> bpy.types.Object:
    rig = armature(scene, "Armadillo.DeformRig")
    offset = Vector((1.58, -0.37, 0.001))

    def p(point: Vec3) -> Vec3:
        return tuple(offset + Vector(point))

    bone(rig, "root", p((0, 0.22, 0.46)), p((0, 0.42, 0.46)))
    bone(rig, "head", p((0, -0.24, 0.46)), p((0, -0.57, 0.46)), "root")
    bone(rig, "tail", p((0, 0.74, 0.42)), p((-0.12, 1.4, 0.19)), "root")
    for sign, side in [(-1, "L"), (1, "R")]:
        for n, y in enumerate([-0.21, 0.53]):
            name = f"leg.{side}.{n}"
            bone(
                rig,
                name,
                p((sign * 0.28, y, 0.4)),
                p((sign * 0.34, y - 0.07, 0.15)),
                "root",
            )
    operator_mode("OBJECT")
    return rig


def guardian_bone(part: str) -> str:
    if part.startswith("Aegis.Head"):
        return "head"
    if "shield" in part:
        return "shield"
    if "tail" in part:
        return "tail"
    stems = {
        "upper_arm": ["upper-arm", "pauldron", "shoulder-hinge"],
        "forearm": ["forearm", "gauntlet"],
        "hand": ["wrist", "fist", "knuckle", "thumb"],
        "thigh": ["thigh"],
        "shin": ["calf", "greave", "knee"],
        "foot": ["ankle", "foot"],
    }
    for name, prefixes in stems.items():
        for prefix in prefixes:
            for sign, suffix in [(-1, "L"), (1, "R")]:
                if f"{prefix}-{sign}" in part:
                    return name + "." + suffix
    if any(token in part for token in ["belt", "waist", "tabard", "skirt"]):
        return "hips"
    return "spine"


def companion_bone(part: str) -> str:
    if part.startswith("Armadillo.Head"):
        return "head"
    if "tail" in part:
        return "tail"
    for sign, side in [(-1, "L"), (1, "R")]:
        for n in [0, 1]:
            if any(
                f"{prefix}-{sign}-{n}" in part
                for prefix in ["leg", "ivory-leg-cuff", "gold-cuff", "paw"]
            ):
                return f"leg.{side}.{n}"
    return "root"


def bind(meshes: list[bpy.types.Object], rigs: dict[str, bpy.types.Object]) -> None:
    kinds = bpy.types.Modifier.bl_rna.properties["type"].enum_items
    kind = next(i.identifier for i in kinds if i.identifier == "ARMATURE")
    for obj in meshes:
        actor = obj["pilot_actor"]
        rig = rigs[actor]
        name = (
            guardian_bone(obj["pilot_part"])
            if actor == "aegis"
            else companion_bone(obj["pilot_part"])
        )
        if name not in rig.data.bones:
            raise ValueError(f"Missing deform bone {name}: {obj.name}")
        world = obj.matrix_world.copy()
        obj.parent = rig
        obj.matrix_world = world
        group = obj.vertex_groups.new(name=name)
        modes = (
            bpy.types.VertexGroup.bl_rna.functions["add"].parameters["type"].enum_items
        )
        mode = next(i.identifier for i in modes if i.identifier == "REPLACE")
        group.add(list(range(len(obj.data.vertices))), 1, mode)
        modifier = obj.modifiers.new("Pilot skeletal deformation", kind)
        modifier.object = rig
        obj["deform_bone"] = name


def move_world(rig: bpy.types.Object, name: str, displacement: Vec3) -> None:
    pose = rig.pose.bones[name]
    pose.location = pose.bone.matrix_local.to_3x3().inverted() @ Vector(displacement)
