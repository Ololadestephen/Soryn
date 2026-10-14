"""Original purple armadillo with segmented ivory shell and banded tail."""

from __future__ import annotations

import math

import bpy

from .anatomy import canine_head, hinge, paw
from .geometry import MaterialPalette, ModelBuilder, Vec3


def shell_point(y: float, angle: float, lift: float = 0) -> Vec3:
    factor = math.sqrt(max(0.04, 1 - ((y - 0.22) / 0.73) ** 2))
    return (
        0.45 * factor * math.sin(angle),
        y,
        0.44 + (0.4 * factor + lift) * math.cos(angle),
    )


def shell_tile(
    model: ModelBuilder,
    band: int,
    column: int,
    y0: float,
    y1: float,
    a0: float,
    a1: float,
    mats: MaterialPalette,
) -> None:
    vertices = []
    steps = 5
    for row in range(steps + 1):
        y = y0 + (y1 - y0) * row / steps
        for n in range(steps + 1):
            angle = a0 + (a1 - a0) * n / steps
            vertices.append(shell_point(y, angle, 0.021))
    faces = []
    for row in range(steps):
        for n in range(steps):
            i = row * (steps + 1) + n
            faces.append((i, i + 1, i + steps + 2, i + steps + 1))
    obj = model.mesh(
        f"shell-ivory-band-{band}.tile-{column}", vertices, faces, mats["ivory"]
    )
    model.solidify(obj, 0.028)
    model.bevel(obj, 0.008)


def build_shell(model: ModelBuilder, mats: MaterialPalette) -> None:
    bands = [(-0.23, -0.035), (0.035, 0.235), (0.3, 0.5), (0.565, 0.74)]
    for band, (y0, y1) in enumerate(bands):
        for col in range(7):
            a0 = -math.pi / 2 + col * math.pi / 7 + 0.012
            a1 = a0 + math.pi / 7 - 0.024
            shell_tile(model, band, col, y0, y1, a0, a1, mats)
        edge = [
            shell_point(y0, -math.pi / 2 + n * math.pi / 48, 0.025) for n in range(49)
        ]
        model.curve(f"shell-band-gold-piping-{band}", edge, 0.013, mats["gold"])
    for sign in (-1, 1):
        hinge(
            model,
            f"shell-temple-hinge-{sign}",
            (sign * 0.425, -0.16, 0.48),
            0.115,
            mats,
            axis="X",
        )


def pet_legs(model: ModelBuilder, mats: MaterialPalette) -> None:
    for side in (-1, 1):
        for n, y in enumerate([-0.21, 0.53]):
            shoulder = (side * 0.28, y, 0.4)
            ankle = (side * 0.34, y - 0.07, 0.15)
            model.link(f"leg-{side}-{n}", shoulder, ankle, 0.095, mats["fur"])
            model.ellipsoid(
                f"ivory-leg-cuff-{side}-{n}",
                (side * 0.34, y - 0.05, 0.22),
                (0.113, 0.11, 0.1),
                mats["ivory"],
            )
            model.ring(
                f"gold-cuff-{side}-{n}",
                (side * 0.34, y - 0.06, 0.175),
                (0.12, 0.11),
                0.016,
                mats["gold"],
            )
            paw(model, f"paw-{side}-{n}", (side * 0.35, y - 0.15, 0.074), 0.44, mats)


def pet_tail(model: ModelBuilder, mats: MaterialPalette) -> None:
    points = [
        (0, 0.74, 0.42),
        (0, 0.96, 0.33),
        (-0.065, 1.18, 0.23),
        (-0.12, 1.4, 0.19),
    ]
    model.tube("banded-tail", points, [0.09, 0.09, 0.06, 0.005], mats["fur"])
    for n in range(len(points) - 1):
        radius = 0.115 - n * 0.025
        a, b = points[n], points[n + 1]
        for fraction in (0.22, 0.56):
            p = tuple(a[i] + (b[i] - a[i]) * fraction for i in range(3))
            model.ring(
                f"tail-gold-band-{n}-{fraction}",
                p,
                (radius * 0.9, radius * 0.75),
                0.016,
                mats["gold"],
                axis="Y",
            )


def build_armadillo(scene: bpy.types.Scene, mats: MaterialPalette) -> ModelBuilder:
    model = ModelBuilder(scene, "Armadillo")
    model.root["reference"] = "assets/combat/rendered/armadillo.png"
    model.ellipsoid(
        "purple-shell-base", (0, 0.22, 0.44), (0.44, 0.72, 0.395), mats["shield"]
    )
    model.ellipsoid("body-under-shell", (0, 0.2, 0.3), (0.33, 0.59, 0.22), mats["fur"])
    head = canine_head(
        scene,
        "Armadillo.Head",
        model.root,
        (0, -0.36, 0.46),
        0.55,
        mats,
        guardian=False,
    )
    forehead = [
        (-0.24, -0.14, 0.28),
        (0, -0.2, 0.39),
        (0.24, -0.14, 0.28),
        (0.21, -0.34, 0.16),
        (0, -0.54, -0.035),
        (-0.21, -0.34, 0.16),
    ]
    head.panel("ivory-forehead-cap", forehead, 0.024, mats["ivory"])
    head.curve(
        "forehead-gold-rim",
        [(x, y - 0.008, z) for x, y, z in forehead],
        0.012,
        mats["gold"],
        cyclic=True,
    )
    build_shell(model, mats)
    pet_legs(model, mats)
    pet_tail(model, mats)
    model.root.location = (1.58, -0.37, 0.001)
    return model
