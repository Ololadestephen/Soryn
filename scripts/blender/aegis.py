"""Aegis's substantial guardian silhouette and existing equipment."""

from __future__ import annotations

import math

import bpy

from .anatomy import canine_head, hinge, paw, spiral_points
from .geometry import MaterialPalette, ModelBuilder


def build_aegis(scene: bpy.types.Scene, mats: MaterialPalette) -> ModelBuilder:
    model = ModelBuilder(scene, "Aegis")
    model.root["reference"] = "assets/combat/rendered/aegis.png"
    model.ellipsoid("torso", (0, 0.06, 2.95), (0.67, 0.38, 0.7), mats["fur"])
    model.ellipsoid("waist", (0, 0.07, 2.27), (0.44, 0.3, 0.47), mats["cloth"])
    model.ellipsoid("neck", (0, 0.04, 3.5), (0.28, 0.26, 0.31), mats["fur"])
    canine_head(scene, "Aegis.Head", model.root, (0, -0.02, 3.87), 0.94, mats)
    torso_armour(model, mats)
    for sign in (-1, 1):
        leg(model, sign, mats)
        arm(model, sign, mats)
    cloth(model, mats)
    shield(model, mats)
    tail(model, mats)
    return model


def torso_armour(model: ModelBuilder, mats: MaterialPalette) -> None:
    outline = [
        (-0.56, -0.26, 3.37),
        (-0.26, -0.37, 3.43),
        (0.26, -0.37, 3.43),
        (0.56, -0.26, 3.37),
        (0.62, -0.24, 3.07),
        (0.43, -0.36, 2.71),
        (0, -0.41, 2.57),
        (-0.43, -0.36, 2.71),
        (-0.62, -0.24, 3.07),
    ]
    outline = [(x, y - 0.1, z) for x, y, z in outline]
    model.panel("ivory-breastplate", outline, 0.11, mats["ivory"])
    model.curve(
        "breastplate-gold-rim",
        [(x, y - 0.012, z) for x, y, z in outline],
        0.028,
        mats["gold"],
        cyclic=True,
    )
    for z, width in [(2.65, 0.4), (2.52, 0.38)]:
        model.ellipsoid(
            f"abdominal-lame-{z}", (0, -0.17, z), (width, 0.2, 0.11), mats["ivory"]
        )
    model.curve(
        "diagonal-leather-strap",
        [
            (-0.5, -0.39, 3.31),
            (-0.19, -0.63, 3.02),
            (0.14, -0.58, 2.8),
            (0.37, -0.47, 2.65),
        ],
        0.052,
        mats["leather"],
    )
    for n, (x, z) in enumerate([(-0.43, 3.24), (0.24, 2.75)]):
        hinge(model, f"chest-strap-pin-{n}", (x, -0.57, z), 0.087, mats)
    model.ellipsoid("belt", (0, 0.01, 2.18), (0.5, 0.34, 0.15), mats["leather"])
    model.ring("belt-upper-piping", (0, 0.01, 2.27), (0.48, 0.34), 0.023, mats["gold"])
    model.ring("belt-lower-piping", (0, 0.01, 2.08), (0.48, 0.34), 0.023, mats["gold"])
    for n, x in enumerate([-0.33, 0, 0.33]):
        hinge(model, f"belt-medallion-{n}", (x, -0.345, 2.18), 0.13, mats)


def arm(model: ModelBuilder, sign: int, mats: MaterialPalette) -> None:
    shoulder = (sign * 0.73, 0.02, 3.23)
    elbow = (sign * 0.95, -0.04, 2.87)
    wrist = (sign * 1.02, -0.23, 2.44)
    model.link(f"upper-arm-{sign}", shoulder, elbow, 0.245, mats["fur"], width=1.05)
    model.link(f"forearm-{sign}", elbow, wrist, 0.22, mats["fur"])
    model.armour_surface(
        f"ivory-pauldron-{sign}",
        (sign * 0.74, 0.02, 3.23),
        (0.44, 0.42, 0.295),
        mats["ivory"],
        mats["gold"],
        upper=True,
    )
    model.curve(
        f"pauldron-crest-{sign}",
        [
            (sign * 0.43, -0.055, 3.42),
            (sign * 0.71, -0.19, 3.52),
            (sign * 1.06, -0.025, 3.38),
        ],
        0.032,
        mats["gold"],
    )
    hinge(model, f"shoulder-hinge-{sign}", (sign * 0.73, -0.398, 3.19), 0.16, mats)
    model.armour_surface(
        f"ivory-gauntlet-{sign}",
        (sign * 1.005, -0.19, 2.69),
        (0.245, 0.265, 0.23),
        mats["ivory"],
        mats["gold"],
    )
    model.ring(f"wrist-cuff-{sign}", wrist, (0.215, 0.205), 0.038, mats["gold"])
    model.ellipsoid(
        f"fist-{sign}", (sign * 1.025, -0.3, 2.27), (0.2, 0.19, 0.23), mats["fur"]
    )
    for n in range(3):
        model.ellipsoid(
            f"knuckle-{sign}-{n}",
            (sign * 1.025 + (n - 1) * 0.1, -0.46, 2.31),
            (0.06, 0.075, 0.094),
            mats["fur"],
        )
    model.ellipsoid(
        f"thumb-{sign}", (sign * 0.856, -0.32, 2.29), (0.093, 0.13, 0.13), mats["fur"]
    )


def leg(model: ModelBuilder, sign: int, mats: MaterialPalette) -> None:
    hip = (sign * 0.32, 0.03, 1.95)
    knee = (sign * 0.53, -0.03, 1.14)
    ankle = (sign * 0.6, 0.04, 0.38)
    model.link(f"thigh-underlayer-{sign}", hip, knee, 0.28, mats["cloth"], width=1.12)
    model.link(f"calf-{sign}", knee, ankle, 0.215, mats["fur"])
    model.armour_surface(
        f"ivory-thigh-plate-{sign}",
        (sign * 0.46, -0.04, 1.65),
        (0.34, 0.33, 0.49),
        mats["ivory"],
        mats["gold"],
    )
    model.ellipsoid(
        f"knee-recess-{sign}",
        (sign * 0.53, -0.23, 1.17),
        (0.245, 0.16, 0.245),
        mats["gold-dark"],
    )
    outline = [
        (sign * 0.53 - 0.18, -0.36, 1.29),
        (sign * 0.53, -0.4, 1.41),
        (sign * 0.53 + 0.18, -0.36, 1.29),
        (sign * 0.53 + 0.19, -0.36, 1.12),
        (sign * 0.53, -0.4, 0.97),
        (sign * 0.53 - 0.19, -0.36, 1.12),
    ]
    model.panel(f"gold-kneecap-{sign}", outline, 0.055, mats["gold"])
    model.armour_surface(
        f"ivory-greave-{sign}",
        (sign * 0.585, 0.04, 0.63),
        (0.26, 0.265, 0.35),
        mats["ivory"],
        mats["gold"],
    )
    model.ring(f"ankle-gold-{sign}", ankle, (0.25, 0.23), 0.043, mats["gold"])
    hinge(model, f"ankle-hinge-{sign}", (sign * 0.6, -0.22, 0.41), 0.078, mats)
    paw(model, f"foot-{sign}", (sign * 0.61, -0.12, 0.17), 1, mats)


def scarf(model: ModelBuilder, mats: MaterialPalette) -> None:
    verts, faces = [], []
    for row in range(4):
        for n in range(49):
            angle = n * math.tau / 48
            radius = 0.3 + row * 0.016 + 0.014 * math.sin(angle * 3)
            z = 3.6 - row * 0.08 - 0.055 * row * max(0, -math.sin(angle))
            verts.append((radius * math.cos(angle), radius * math.sin(angle), z))
            if row and n:
                i = row * 49 + n
                faces.append((i - 50, i - 49, i, i - 1))
    obj = model.mesh("draped-scarf", verts, faces, mats["cloth"], smooth=True)
    model.solidify(obj, 0.027)
    model.curve("scarf-fold-highlight", verts[-49:], 0.013, mats["shield"])


def cloth(model: ModelBuilder, mats: MaterialPalette) -> None:
    scarf(model, mats)
    front = [
        (-0.31, -0.33, 2.1),
        (0.31, -0.33, 2.1),
        (0.28, -0.43, 1.37),
        (0.08, -0.48, 1.05),
        (-0.29, -0.4, 1.2),
    ]
    model.panel("front-tabard", front, 0.022, mats["cloth"], bevel=0.015)
    model.curve("tabard-gilt-hem", front[1:] + [front[0]], 0.018, mats["gold"])
    model.curve(
        "tabard-center-fold",
        [(0, -0.355, 2.08), (0.08, -0.405, 1.6), (0.08, -0.495, 1.1)],
        0.015,
        mats["shield"],
    )
    for sign in (-1, 1):
        skirt = [
            (sign * 0.24, 0.17, 2.12),
            (sign * 0.48, 0.12, 2.08),
            (sign * 0.83, 0.3, 1.57),
            (sign * 0.73, 0.35, 1.4),
            (sign * 0.5, 0.32, 1.56),
        ]
        model.panel(f"split-skirt-{sign}", skirt, 0.02, mats["cloth"])
        model.curve(
            f"skirt-gilt-hem-{sign}", skirt[1:] + [skirt[0]], 0.016, mats["gold"]
        )
    model.panel(
        "hanging-scarf-end",
        [
            (-0.16, 0.24, 3.42),
            (0.16, 0.24, 3.42),
            (0.22, 0.43, 2.88),
            (0.05, 0.49, 2.65),
            (-0.12, 0.46, 2.83),
        ],
        0.022,
        mats["cloth"],
    )


def shield(model: ModelBuilder, mats: MaterialPalette) -> None:
    cx, cy, cz = -1.01, -0.68, 2.16
    outline = []
    for n in range(25):
        t = n / 24
        outline.append(
            (
                cx + 0.77 * math.sin(math.pi * t) * (1.1 - 0.3 * t),
                cy,
                cz + 1.47 - 2.94 * t,
            )
        )
    for n in range(23, 0, -1):
        t = n / 24
        outline.append(
            (
                cx - 0.77 * math.sin(math.pi * t) * (1.1 - 0.3 * t),
                cy,
                cz + 1.47 - 2.94 * t,
            )
        )
    model.panel(
        "kite-shield-gold-rim", outline, 0.135, mats["gold"], bevel=0.035, convex=0
    )
    inset = [
        (cx + (x - cx) * 0.87, y - 0.026, cz + (z - cz) * 0.92) for x, y, z in outline
    ]
    inlay = model.panel(
        "kite-shield-purple-inlay", inset, 0.08, mats["shield"], bevel=0.025, convex=0
    )
    bpy.context.view_layer.update()
    model.ribbon(
        "shield-ivory-spiral",
        spiral_points((cx, cy - 0.15, cz + 0.14), 0.59, 0.01, turns=1.22),
        0.12,
        mats["ivory"],
        surface=inlay,
    )
    for n in range(0, len(outline), 3):
        x, y, z = outline[n]
        model.ellipsoid(
            f"shield-rivet-{n}",
            (cx + (x - cx) * 0.96, y - 0.047, cz + (z - cz) * 0.96),
            (0.027, 0.022, 0.027),
            mats["gold-dark"],
            segments=16,
        )
    model.link(
        "shield-back-grip",
        (-1.02, -0.51, 2.4),
        (-1.02, -0.51, 2.05),
        0.055,
        mats["leather"],
    )


def tail(model: ModelBuilder, mats: MaterialPalette) -> None:
    points = [
        (0, 0.29, 1.99),
        (0.33, 0.55, 1.78),
        (0.72, 0.57, 1.61),
        (0.95, 0.56, 1.7),
        (1.05, 0.57, 1.95),
    ]
    model.tube(
        "continuous-fur-tail", points, [0.16, 0.18, 0.155, 0.11, 0.006], mats["mane"]
    )
