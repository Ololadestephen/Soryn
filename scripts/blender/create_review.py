"""Scene construction and validation; CLI/path setup belongs to build_review.py."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import TypedDict

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT = SCRIPT_DIR.parents[1]

from .aegis import build_aegis
from .armadillo import build_armadillo
from .files import write_json
from .geometry import ModelBuilder, Vec3, material, palette, set_enum


class Bounds(TypedDict):
    minimum: list[float]
    maximum: list[float]


class ModelReport(TypedDict):
    scene: str
    blender: str
    view_transform: str
    mesh_parts: int
    vertices: int
    polygons: int
    bounds: dict[str, Bounds]
    armatures: int
    animated_objects: int
    stage: str


SCENE_NAME = "Chog_Aegis_ModelReview_v05"
SOURCE_NAME = "aegis-armadillo-model-review.blend"


def camera(
    builder: ModelBuilder, name: str, eye: Vec3, target: Vec3, scale: float
) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    set_enum(data, "type", "ORTHO")
    data.ortho_scale = scale
    obj = builder.object(name, data)
    obj.location = eye
    obj.rotation_euler = (
        (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
    )
    return obj


def area_light(
    builder: ModelBuilder,
    name: str,
    point: Vec3,
    power: float,
    size: float,
    target: Vec3,
) -> None:
    choices = bpy.types.Light.bl_rna.properties["type"].enum_items
    kind = next(i.identifier for i in choices if i.identifier == "AREA")
    data = bpy.data.lights.new(name, kind)
    data.energy, data.size = power, size
    obj = builder.object(name, data)
    obj.location = point
    obj.rotation_euler = (
        (Vector(target) - Vector(point)).to_track_quat("-Z", "Y").to_euler()
    )


def studio(scene: bpy.types.Scene) -> dict[str, bpy.types.Object]:
    builder = ModelBuilder(scene, "ReviewStudio")
    floor = material("Review.neutral-grey", "767a80", roughness=0.85)
    builder.mesh(
        "neutral-ground",
        [(-500, -500, 0), (500, -500, 0), (500, 500, 0), (-500, 500, 0)],
        [(0, 1, 2, 3)],
        floor,
    )
    scene.world = bpy.data.worlds.new("Review.neutral-world")
    scene.world.use_nodes = True
    background = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0.25, 0.25, 0.25, 1)
    background.inputs["Strength"].default_value = 0.45
    area_light(builder, "Key-softbox", (-4, -6, 7), 1000, 5, (0, 0, 2))
    area_light(builder, "Fill-softbox", (5, -3, 4), 650, 4, (0, 0, 2))
    area_light(builder, "Rim-softbox", (1, 4, 6), 1100, 3, (0, 0, 2.5))
    cameras = {
        "pair": camera(builder, "Camera.Pair", (7.5, -12, 4.6), (0.1, 0, 2.25), 7.55),
        "front": camera(builder, "Camera.Front", (0, -12, 2.6), (0, 0, 2.25), 7.4),
        "profile": camera(
            builder, "Camera.Profile", (12, -0.5, 3.2), (0, 0, 2.25), 7.4
        ),
        "pet": camera(
            builder, "Camera.Armadillo", (4.3, -4.6, 2.0), (1.58, 0.12, 0.48), 2.65
        ),
        "pet-profile": camera(
            builder,
            "Camera.ArmadilloProfile",
            (5.5, -0.4, 1.4),
            (1.58, 0.05, 0.45),
            2.8,
        ),
    }
    scene.camera = cameras["pair"]
    for name, obj in cameras.items():
        obj["review_view"] = name
    return cameras


def configure_render(scene: bpy.types.Scene, old_engine: str) -> None:
    try:
        scene.render.engine = old_engine
    except TypeError as error:
        raise RuntimeError(
            f"Verified renderer {old_engine} unavailable: {error}"
        ) from error
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    set_enum(scene.render.image_settings, "file_format", "PNG")
    set_enum(scene.render.image_settings, "color_mode", "RGB")
    scene.render.film_transparent = False
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 1
    # Keep the scene's runtime OCIO default; dynamic RNA lists can report only NONE.
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 96


def pack_references(scene: bpy.types.Scene) -> None:
    builder = ModelBuilder(scene, "ApprovedReferences")
    for n, name in enumerate(["aegis", "armadillo"]):
        path = PROJECT / "assets" / "combat" / "rendered" / (name + ".png")
        if not path.is_file():
            raise FileNotFoundError(f"Required approved reference missing: {path}")
        image = bpy.data.images.load(str(path), check_existing=True)
        image.pack()
        obj = builder.object(name + ".reference", None)
        set_enum(obj, "empty_display_type", "IMAGE")
        obj.data = image
        obj.empty_display_size = 4
        obj.location = (5 + n * 4, 1, 2)
        obj.rotation_euler = (math.pi / 2, 0, 0)
        obj.hide_render = True
    builder.collection.hide_viewport = True
    builder.collection.hide_render = True


def validate(scene: bpy.types.Scene) -> ModelReport:
    """Validate real geometry and geometry budgets without claiming rig readiness."""
    objects = list(scene.objects)
    meshes = [
        o
        for o in objects
        if o.type == "MESH" and not o.name.startswith("ReviewStudio.")
    ]
    if not meshes:
        raise RuntimeError("Review scene has no character geometry")
    if any(o.type == "ARMATURE" or o.animation_data for o in objects):
        raise RuntimeError("Model-review gate must not contain a rig or animation")
    invalid = []
    for obj in meshes:
        if obj.data.validate(verbose=False):
            invalid.append(obj.name)
        for vertex in obj.data.vertices:
            if not all(math.isfinite(value) for value in vertex.co):
                invalid.append(obj.name)
    if invalid:
        raise RuntimeError(f"Invalid geometry: {sorted(set(invalid))}")
    bpy.context.view_layer.update()
    bounds = {}
    for prefix in ["Aegis", "Armadillo"]:
        parts = [o for o in meshes if o.name.startswith(prefix + ".")]
        coords = [o.matrix_world @ Vector(p) for o in parts for p in o.bound_box]
        bounds[prefix] = {
            "minimum": [min(p[i] for p in coords) for i in range(3)],
            "maximum": [max(p[i] for p in coords) for i in range(3)],
        }
    return {
        "scene": scene.name,
        "blender": bpy.app.version_string,
        "view_transform": scene.view_settings.view_transform,
        "mesh_parts": len(meshes),
        "vertices": sum(len(o.data.vertices) for o in meshes),
        "polygons": sum(len(o.data.polygons) for o in meshes),
        "bounds": bounds,
        "armatures": 0,
        "animated_objects": 0,
        "stage": "editable model draft, pending visual review; not rig-ready approval",
    }


def save_source(scene: bpy.types.Scene, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    report = validate(scene)
    write_json(output / "model-validation.json", report)
    # Save this scene's dependency graph only; preserve unrelated live scenes/work.
    bpy.data.libraries.write(
        str(output / SOURCE_NAME), {scene}, fake_user=True, compress=True
    )
    print(json.dumps(report, indent=2))


def render_previews(
    scene: bpy.types.Scene, cameras: dict[str, bpy.types.Object], output: Path
) -> None:
    previous_camera = scene.camera
    previous_visibility = {obj: obj.hide_render for obj in scene.objects}
    try:
        for name in ["pair", "front", "profile", "pet", "pet-profile"]:
            for obj in scene.objects:
                if obj.name.startswith("Aegis."):
                    obj.hide_render = name.startswith("pet")
                elif obj.name.startswith("Armadillo."):
                    obj.hide_render = name in ["front", "profile"]
            scene.camera = cameras[name]
            scene.render.filepath = str(output / ("neutral-" + name + ".png"))
            bpy.ops.render.render(write_still=True)
    finally:
        scene.camera = previous_camera
        for obj, hidden in previous_visibility.items():
            obj.hide_render = hidden


def build(output: Path, render: bool = False) -> None:
    if bpy.data.scenes.get(SCENE_NAME):
        raise RuntimeError(
            "Review scene already exists; use a fresh Blender process to reproduce"
        )
    if (output / SOURCE_NAME).exists():
        raise FileExistsError(
            "Source already exists; choose a new output directory to preserve revisions"
        )
    old_engine = bpy.context.scene.render.engine
    scene = bpy.data.scenes.new(SCENE_NAME)
    bpy.context.window.scene = scene
    scene["purpose"] = (
        "Original Aegis/armadillo editable model review. No animation or game integration."
    )
    mats = palette()
    build_aegis(scene, mats)
    build_armadillo(scene, mats)
    cameras = studio(scene)
    configure_render(scene, old_engine)
    pack_references(scene)
    save_source(scene, output)
    if render:
        render_previews(scene, cameras, output)
