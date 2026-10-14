"""Reference-led faces, paws and shell details; no rig or animation."""

from __future__ import annotations

import math
from typing import Literal

import bpy

from .geometry import MaterialPalette, ModelBuilder, Vec3


def canine_head(
    scene: bpy.types.Scene,
    name: str,
    parent: bpy.types.Object | None,
    point: Vec3,
    scale: float,
    mats: MaterialPalette,
    guardian: bool = True,
) -> ModelBuilder:
    head = ModelBuilder(scene, name)
    head.root.parent = parent
    head.root.location = point
    head.root.scale = (scale, scale, scale)
    head.ellipsoid("skull", (0, 0.03, 0), (0.39, 0.34, 0.38), mats["fur"])
    head.ellipsoid("lower-jaw", (0, -0.26, -0.23), (0.235, 0.26, 0.11), mats["cream"])
    head.ellipsoid(
        "tapered-muzzle", (0, -0.41, -0.135), (0.218, 0.295, 0.105), mats["cream"]
    )
    nose = [
        (-0.09, -0.659, -0.06),
        (0.09, -0.659, -0.06),
        (0.065, -0.684, -0.14),
        (0, -0.699, -0.17),
        (-0.065, -0.684, -0.14),
    ]
    head.panel("nose", nose, 0.035, mats["dark"], bevel=0.012)
    head.curve(
        "closed-mouth",
        [
            (-0.2, -0.41, -0.22),
            (-0.13, -0.6, -0.235),
            (0, -0.66, -0.235),
            (0.13, -0.6, -0.235),
            (0.2, -0.41, -0.22),
        ],
        0.007,
        mats["dark"],
    )
    for sign in (-1, 1):
        face_eye(head, sign, mats, guardian)
        pointed_ear(head, sign, mats)
        for n in range(3):
            base = (sign * 0.27, -0.15 + n * 0.06, -0.14 - n * 0.07)
            tip = (sign * (0.47 - n * 0.035), 0.14 + n * 0.055, -0.17 - n * 0.1)
            head.tuft(f"cream-cheek-{sign}-{n}", base, tip, 0.085, mats["cream"])
        if guardian:
            for n in range(5):
                head.tuft(
                    f"mane-{sign}-{n}",
                    (sign * 0.3, 0.17, 0.19 - n * 0.1),
                    (sign * (0.5 - n * 0.025), 0.42, 0.27 - n * 0.16),
                    0.095,
                    mats["mane"],
                )
    if guardian:
        for n in range(4):
            head.tuft(
                f"crown-{n}",
                (0, -0.025 + n * 0.1, 0.28),
                (0, 0.16 + n * 0.12, 0.51 - n * 0.035),
                0.12,
                mats["mane"],
            )
    return head


def face_eye(
    head: ModelBuilder, sign: int, mats: MaterialPalette, guardian: bool
) -> None:
    x = sign * 0.218
    tilt = -sign * (0.17 if guardian else 0.04)
    head.ellipsoid(
        f"eye-socket-{sign}",
        (x, -0.245, 0.055),
        (0.127, 0.031, 0.071),
        mats["dark"],
        rotation=(0, tilt, 0),
    )
    head.ellipsoid(
        f"amber-eye-{sign}",
        (x, -0.278, 0.052),
        (0.085, 0.014, 0.047),
        mats["eye"],
        rotation=(0, tilt, 0),
    )
    head.ellipsoid(
        f"pupil-{sign}",
        (x + sign * 0.005, -0.292, 0.054),
        (0.018, 0.008, 0.044),
        mats["dark"],
    )
    head.ellipsoid(
        f"eye-glint-{sign}",
        (x - 0.025, -0.301, 0.075),
        (0.01, 0.006, 0.011),
        mats["white"],
        segments=16,
    )
    if guardian:
        head.tuft(
            f"brow-{sign}",
            (sign * 0.095, -0.283, 0.1),
            (sign * 0.355, -0.19, 0.186),
            0.058,
            mats["fur"],
        )


def pointed_ear(head: ModelBuilder, sign: int, mats: MaterialPalette) -> None:
    outer = [
        (sign * 0.11, -0.09, 0.23),
        (sign * 0.42, -0.02, 0.24),
        (sign * 0.46, 0.02, 0.73),
        (sign * 0.2, -0.07, 0.48),
    ]
    head.panel(f"ear-{sign}", outer, 0.13, mats["fur"], bevel=0.03)
    inner = [
        (sign * 0.2, -0.117, 0.32),
        (sign * 0.36, -0.084, 0.33),
        (sign * 0.412, -0.048, 0.633),
        (sign * 0.25, -0.107, 0.46),
    ]
    head.panel(f"inner-ear-{sign}", inner, 0.018, mats["ear"], bevel=0.016)
    head.curve(
        f"ear-ridge-{sign}",
        [
            (sign * 0.19, -0.12, 0.27),
            (sign * 0.25, -0.13, 0.43),
            (sign * 0.44, -0.05, 0.69),
        ],
        0.019,
        mats["mane"],
    )


def paw(
    model: ModelBuilder, name: str, point: Vec3, size: float, mats: MaterialPalette
) -> None:
    x, y, z = point
    model.ellipsoid(
        name + ".palm", point, (0.25 * size, 0.33 * size, 0.17 * size), mats["fur"]
    )
    for n in range(3):
        toe_x = x + (n - 1) * 0.15 * size
        model.ellipsoid(
            name + f".digit-{n}",
            (toe_x, y - 0.22 * size, z - 0.04 * size),
            (0.097 * size, 0.16 * size, 0.13 * size),
            mats["fur"],
        )
        model.tuft(
            name + f".claw-{n}",
            (toe_x, y - 0.29 * size, z - 0.01 * size),
            (toe_x, y - 0.43 * size, z - 0.065 * size),
            0.036 * size,
            mats["claw"],
        )


def hinge(
    model: ModelBuilder,
    name: str,
    point: Vec3,
    radius: float,
    mats: MaterialPalette,
    axis: Literal["X", "Y", "Z"] = "Y",
) -> None:
    x, y, z = point
    radial = (radius, 0.055, radius)
    boss_scale = (radius * 0.46, 0.042, radius * 0.46)
    rim, boss = (x, y - 0.046, z), (x, y - 0.066, z)
    if axis == "X":
        direction = -1 if x < 0 else 1
        radial, boss_scale = (
            (0.055, radius, radius),
            (0.042, radius * 0.46, radius * 0.46),
        )
        rim, boss = (x + direction * 0.046, y, z), (x + direction * 0.066, y, z)
    model.ellipsoid(name + ".recess", point, radial, mats["gold-dark"])
    model.ring(
        name + ".rim",
        rim,
        (radius * 0.79, radius * 0.79),
        radius * 0.15,
        mats["gold"],
        axis=axis,
    )
    model.ellipsoid(name + ".boss", boss, boss_scale, mats["gold"])


def spiral_points(
    center: Vec3, radius: float, depth: float, turns: float = 1.32
) -> list[Vec3]:
    x, y, z = center
    points = []
    for n in range(120):
        fraction = n / 119
        angle = math.pi + fraction * math.tau * turns
        r = radius * (0.075 + 0.925 * fraction)
        points.append(
            (
                x + r * math.cos(angle),
                y - depth * (1 - fraction),
                z + r * math.sin(angle),
            )
        )
    return points
