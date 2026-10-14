"""Editable mesh/curve helpers for the original Chog model-review scene."""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Literal

import bmesh
import bpy
from mathutils import Matrix, Vector

Vec3 = tuple[float, float, float]
MaterialPalette = dict[str, bpy.types.Material]


def set_enum(owner: bpy.types.bpy_struct, property_name: str, identifier: str) -> None:
    """Validate runtime identifiers instead of assuming a Blender version."""
    choices = owner.bl_rna.properties[property_name].enum_items
    identifiers = [item.identifier for item in choices]
    if identifier not in identifiers:
        raise ValueError(f"{property_name}: {identifier!r} not in {identifiers}")
    setattr(owner, property_name, identifier)


def linear_color(hex_color: str) -> tuple[float, float, float, float]:
    values = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(
        v / 12.92 if v < 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values
    ) + (1.0,)


def material(
    name: str,
    color: str,
    metallic: float = 0.0,
    roughness: float = 0.45,
    texture: float = 0.0,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    if result.node_tree is None:
        result.use_nodes = True
    shader = next(n for n in result.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = linear_color(color)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if texture:
        noise = result.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 38
        noise.inputs["Detail"].default_value = 3
        bump = result.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = texture
        bump.inputs["Distance"].default_value = 0.022
        result.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        result.node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    result.diffuse_color = linear_color(color)
    return result


class ModelBuilder:
    """Own parts in one collection; never delete another scene's objects."""

    def __init__(self, scene: bpy.types.Scene, name: str) -> None:
        self.collection = bpy.data.collections.new(name)
        scene.collection.children.link(self.collection)
        self.root = bpy.data.objects.new(name + ".root", None)
        self.collection.objects.link(self.root)
        self.root["stage"] = "editable-model-review; no rig or animation"

    def object(
        self,
        name: str,
        data: bpy.types.ID | None,
        mat: bpy.types.Material | None = None,
        parent: bpy.types.Object | None = None,
    ) -> bpy.types.Object:
        result = bpy.data.objects.new(self.collection.name + "." + name, data)
        self.collection.objects.link(result)
        result.parent = parent or self.root
        if mat is not None:
            result.data.materials.append(mat)
        return result

    def mesh(
        self,
        name: str,
        vertices: Sequence[Vec3],
        faces: Sequence[tuple[int, ...]],
        mat: bpy.types.Material | None,
        smooth: bool = False,
    ) -> bpy.types.Object:
        data = bpy.data.meshes.new(self.collection.name + "." + name + ".mesh")
        data.from_pydata(vertices, [], faces)
        data.update()
        result = self.object(name, data, mat)
        for polygon in data.polygons:
            polygon.use_smooth = smooth
        return result

    def ellipsoid(
        self,
        name: str,
        point: Vec3,
        scale: Vec3,
        mat: bpy.types.Material | None,
        rotation: Vec3 = (0.0, 0.0, 0.0),
        segments: int = 32,
    ) -> bpy.types.Object:
        data = bpy.data.meshes.new(name + ".mesh")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=20, radius=1)
        bm.to_mesh(data)
        bm.free()
        data.transform(Matrix.Diagonal((*scale, 1.0)))
        result = self.object(name, data, mat)
        result.location = point
        result.rotation_euler = rotation
        for polygon in data.polygons:
            polygon.use_smooth = True
        return result

    def link(
        self,
        name: str,
        start: Vec3,
        end: Vec3,
        radius: float,
        mat: bpy.types.Material | None,
        width: float = 1.0,
    ) -> bpy.types.Object:
        direction = Vector(end) - Vector(start)
        point = (Vector(start) + Vector(end)) / 2
        result = self.ellipsoid(
            name,
            point,
            (radius * width, radius, direction.length / 2 + radius * 0.4),
            mat,
        )
        result.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
        return result

    def curve(
        self,
        name: str,
        points: Sequence[Vec3],
        radius: float,
        mat: bpy.types.Material | None,
        cyclic: bool = False,
    ) -> bpy.types.Object:
        data = bpy.data.curves.new(name + ".curve", type="CURVE")
        set_enum(data, "dimensions", "3D")
        data.resolution_u = 2
        data.bevel_depth = radius
        data.bevel_resolution = 3
        types = bpy.types.Spline.bl_rna.properties["type"].enum_items
        kind = next(i.identifier for i in types if i.identifier == "POLY")
        spline = data.splines.new(kind)
        spline.points.add(len(points) - 1)
        for node, point in zip(spline.points, points):
            node.co = (*point, 1)
        spline.use_cyclic_u = cyclic
        return self.object(name, data, mat)

    def ring(
        self,
        name: str,
        point: Vec3,
        radii: Sequence[float],
        tube: float,
        mat: bpy.types.Material | None,
        axis: Literal["X", "Y", "Z"] = "Z",
    ) -> bpy.types.Object:
        points = []
        for n in range(64):
            a = n * math.tau / 64
            offset = (radii[0] * math.cos(a), radii[1] * math.sin(a), 0)
            if axis == "Y":
                offset = (offset[0], 0, offset[1])
            elif axis == "X":
                offset = (0, offset[0], offset[1])
            points.append(tuple(point[i] + offset[i] for i in range(3)))
        return self.curve(name, points, tube, mat, cyclic=True)

    def tuft(
        self,
        name: str,
        start: Vec3,
        end: Vec3,
        width: float,
        mat: bpy.types.Material | None,
        flatten: float = 0.65,
    ) -> bpy.types.Object:
        direction = Vector(end) - Vector(start)
        orientation = direction.to_track_quat("Z", "Y").to_matrix()
        verts = []
        levels = [(0, width * 0.65), (0.25, width), (0.68, width * 0.58), (1, 0.005)]
        for fraction, radius in levels:
            for n in range(10):
                a = n * math.tau / 10
                local = Vector(
                    (
                        math.cos(a) * radius,
                        math.sin(a) * radius * flatten,
                        direction.length * fraction,
                    )
                )
                verts.append(tuple(Vector(start) + orientation @ local))
        faces = []
        for row in range(len(levels) - 1):
            for n in range(10):
                j = (n + 1) % 10
                faces.append(
                    (row * 10 + n, row * 10 + j, (row + 1) * 10 + j, (row + 1) * 10 + n)
                )
        faces.extend([tuple(reversed(range(10))), tuple(range(30, 40))])
        return self.mesh(name, verts, faces, mat, smooth=True)

    def panel(
        self,
        name: str,
        outline: Sequence[Vec3],
        thickness: float,
        mat: bpy.types.Material | None,
        bevel: float = 0.025,
        convex: float = 0.45,
    ) -> bpy.types.Object:
        """Closed plate in X/Z with a subtly convex front facing -Y."""
        front = [tuple(p) for p in outline]
        back = [(p[0], p[1] + thickness, p[2]) for p in outline]
        count = len(front)
        center = tuple(sum(p[i] for p in front) / count for i in range(3))
        center = (center[0], center[1] - thickness * convex, center[2])
        vertices = front + back + [center]
        faces = [(count * 2, n, (n + 1) % count) for n in range(count)]
        faces.append(tuple(reversed(range(count, count * 2))))
        faces.extend(
            (n, count + n, count + (n + 1) % count, (n + 1) % count)
            for n in range(count)
        )
        result = self.mesh(name, vertices, faces, mat)
        for polygon in result.data.polygons[:count]:
            polygon.use_smooth = True
        self.bevel(result, bevel)
        return result

    def armour_surface(
        self,
        name: str,
        point: Vec3,
        radii: Sequence[float],
        mat: bpy.types.Material | None,
        trim: bpy.types.Material,
        upper: bool = False,
    ) -> bpy.types.Object:
        """Fitted ivory surface with a real rim, avoiding intersecting nested spheres."""
        verts, faces = [], []
        rows, columns = 16, 24
        for row in range(rows + 1):
            a = 0.025 + (math.pi - 0.05) * row / rows
            if upper:
                a *= 0.5
            for col in range(columns + 1):
                b = -math.pi / 2 + math.pi * col / columns
                if upper:
                    b = math.tau * col / columns
                offset = (
                    radii[0] * math.sin(a) * math.sin(b),
                    -radii[1] * math.sin(a) * math.cos(b),
                    radii[2] * math.cos(a),
                )
                verts.append(tuple(point[i] + offset[i] for i in range(3)))
        for row in range(rows):
            for col in range(columns):
                i = row * (columns + 1) + col
                faces.append((i, i + 1, i + columns + 2, i + columns + 1))
        obj = self.mesh(name, verts, faces, mat, smooth=True)
        self.solidify(obj, 0.035)
        if upper:
            boundary = verts[-(columns + 1) :]
        else:
            boundary = verts[: columns + 1] + [
                verts[r * (columns + 1) + columns] for r in range(1, rows + 1)
            ]
            boundary += list(reversed(verts[-(columns + 1) :]))
            boundary += [verts[r * (columns + 1)] for r in range(rows - 1, 0, -1)]
        self.curve(name + ".gold-rim", boundary, 0.022, trim, cyclic=True)
        return obj

    def ribbon(
        self,
        name: str,
        points: Sequence[Vec3],
        width: float,
        mat: bpy.types.Material | None,
        surface: bpy.types.Object | None = None,
    ) -> bpy.types.Object:
        verts, faces = [], []
        for n, point in enumerate(points):
            before = Vector(points[max(0, n - 1)])
            after = Vector(points[min(len(points) - 1, n + 1)])
            tangent = after - before
            side = Vector((-tangent.z, 0, tangent.x)).normalized() * width / 2
            for vertex in [Vector(point) - side, Vector(point) + side]:
                if surface is not None:
                    origin = vertex + Vector((0, -2, 0))
                    hit, location, _, _ = surface.ray_cast(origin, Vector((0, 1, 0)))
                    if not hit:
                        raise ValueError(
                            f"{name}: inlay extends outside its backing surface"
                        )
                    vertex.y = location.y - 0.008
                verts.append(tuple(vertex))
            if n:
                faces.append((2 * n - 2, 2 * n - 1, 2 * n + 1, 2 * n))
        obj = self.mesh(name, verts, faces, mat, smooth=True)
        self.solidify(obj, 0.009)
        self.bevel(obj, 0.006)
        return obj

    def tube(
        self,
        name: str,
        points: Sequence[Vec3],
        radii: Sequence[float],
        mat: bpy.types.Material | None,
    ) -> bpy.types.Object:
        verts, faces = [], []
        samples = []
        for n in range(len(points) - 1):
            p0, p1 = Vector(points[max(0, n - 1)]), Vector(points[n])
            p2, p3 = Vector(points[n + 1]), Vector(points[min(len(points) - 1, n + 2)])
            for step in range(10):
                t = step / 10
                point = 0.5 * (
                    (2 * p1)
                    + (-p0 + p2) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                    + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
                )
                samples.append((point, radii[n] + (radii[n + 1] - radii[n]) * t))
        samples.append((Vector(points[-1]), radii[-1]))
        for n, (point, radius) in enumerate(samples):
            tangent = (
                samples[min(n + 1, len(samples) - 1)][0] - samples[max(0, n - 1)][0]
            )
            rotation = tangent.to_track_quat("Z", "Y").to_matrix()
            for col in range(12):
                a = col * math.tau / 12
                verts.append(
                    tuple(
                        point
                        + rotation
                        @ Vector((radius * math.cos(a), radius * math.sin(a), 0))
                    )
                )
            if n:
                faces.extend(
                    (
                        (n - 1) * 12 + col,
                        (n - 1) * 12 + (col + 1) % 12,
                        n * 12 + (col + 1) % 12,
                        n * 12 + col,
                    )
                    for col in range(12)
                )
        faces.extend(
            [tuple(reversed(range(12))), tuple(range(len(verts) - 12, len(verts)))]
        )
        return self.mesh(name, verts, faces, mat, smooth=True)

    @staticmethod
    def bevel(obj: bpy.types.Object, amount: float) -> None:
        choices = bpy.types.Modifier.bl_rna.properties["type"].enum_items
        kind = next(i.identifier for i in choices if i.identifier == "BEVEL")
        modifier = obj.modifiers.new("Soft armour edges", kind)
        modifier.width = amount
        modifier.segments = 3

    @staticmethod
    def solidify(obj: bpy.types.Object, thickness: float) -> None:
        choices = bpy.types.Modifier.bl_rna.properties["type"].enum_items
        kind = next(i.identifier for i in choices if i.identifier == "SOLIDIFY")
        modifier = obj.modifiers.new("Editable cloth/plate thickness", kind)
        modifier.thickness = thickness


def palette() -> MaterialPalette:
    return {
        "fur": material("Chog.lavender-fur", "553184", roughness=0.65, texture=0.08),
        "mane": material("Chog.swept-purple-mane", "7147a3", roughness=0.6),
        "ivory": material(
            "Chog.warm-ivory-armour", "ead8b9", roughness=0.4, texture=0.13
        ),
        "cream": material("Chog.cream-muzzle", "f3e2c5", roughness=0.7),
        "gold": material("Chog.brushed-gold", "c49345", metallic=0.72, roughness=0.3),
        "gold-dark": material(
            "Chog.gold-recess", "815224", metallic=0.6, roughness=0.38
        ),
        "cloth": material("Chog.indigo-cloth", "4f326e", roughness=0.82, texture=0.15),
        "shield": material(
            "Chog.violet-shield-inlay", "624282", roughness=0.43, texture=0.1
        ),
        "leather": material("Chog.dark-leather", "342330", roughness=0.65),
        "ear": material("Chog.inner-ear", "a26d98", roughness=0.8),
        "eye": material("Chog.amber-eyes", "efa822", metallic=0.2, roughness=0.22),
        "dark": material("Chog.nose-pupil-mouth", "211b30", roughness=0.36),
        "white": material("Chog.eye-highlight", "ffffff", roughness=0.2),
        "claw": material("Chog.dark-claws", "3a2844", roughness=0.3),
    }
