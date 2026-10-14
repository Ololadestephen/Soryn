"""Run with Blender --background <review.blend> --python this_file.py.

Tests the actual saved geometry/scene, not fake bpy objects or bitmap snapshots.
"""

import math
import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Vector


class SavedModelReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from scripts.blender import create_review

        cls.review = create_review
        cls.scene = bpy.data.scenes.get(create_review.SCENE_NAME)
        if cls.scene is None:
            raise AssertionError("Saved review scene missing")
        if bpy.context.scene != cls.scene:
            raise AssertionError(
                "The saved project must open directly on the model-review scene"
            )
        bpy.context.window.scene = cls.scene
        bpy.context.view_layer.update()

    def part(self, suffix):
        matches = [o for o in self.scene.objects if o.name.endswith("." + suffix)]
        self.assertEqual(len(matches), 1, f"Expected exactly one {suffix}")
        return matches[0]

    def test_actual_editable_models_and_no_animations(self):
        report = self.review.validate(self.scene)
        self.assertGreater(report["vertices"], 50000)
        self.assertEqual(report["armatures"], 0)
        self.assertEqual(report["animated_objects"], 0)
        for name in [
            "torso",
            "ivory-breastplate",
            "kite-shield-purple-inlay",
            "purple-shell-base",
            "ivory-forehead-cap",
            "banded-tail",
        ]:
            self.assertEqual(self.part(name).type, "MESH")

    def test_ground_contact_and_relative_proportions(self):
        bounds = self.review.validate(self.scene)["bounds"]
        for name in ["Aegis", "Armadillo"]:
            self.assertGreaterEqual(bounds[name]["minimum"][2], -0.001)
            self.assertLessEqual(bounds[name]["minimum"][2], 0.001)
        self.assertGreater(bounds["Aegis"]["maximum"][2], 4.3)
        self.assertLess(bounds["Aegis"]["maximum"][2], 4.8)
        self.assertGreater(bounds["Armadillo"]["maximum"][2], 0.7)
        self.assertLess(bounds["Armadillo"]["maximum"][2], 1.05)

    def test_fitted_spiral_and_tall_kite_shield(self):
        shield = self.part("kite-shield-purple-inlay")
        emblem = self.part("shield-ivory-spiral")
        self.assertGreater(shield.dimensions.z / shield.dimensions.x, 1.8)
        for vertex in emblem.data.vertices:
            point = vertex.co
            hit, location, _, _ = shield.ray_cast(
                point + Vector((0, -2, 0)), Vector((0, 1, 0))
            )
            self.assertTrue(hit, "Emblem must stay inside the shield")
            self.assertAlmostEqual(location.y - point.y, 0.008, delta=0.001)

    def test_segmented_shell_and_named_limbs(self):
        tiles = [o for o in self.scene.objects if ".shell-ivory-band-" in o.name]
        self.assertEqual(len(tiles), 28)
        for sign in (-1, 1):
            for name in [f"upper-arm-{sign}", f"forearm-{sign}", f"calf-{sign}"]:
                self.assertEqual(self.part(name).type, "MESH")

    def test_materials_and_packed_references(self):
        refs = [o for o in self.scene.objects if o.name.endswith(".reference")]
        self.assertEqual(len(refs), 2)
        for ref in refs:
            self.assertTrue(ref.data.packed_file)
            self.assertTrue(ref.hide_render)
        for obj in self.scene.objects:
            if obj.type in ["MESH", "CURVE"]:
                self.assertGreater(len(obj.data.materials), 0, obj.name)
                for mat in obj.data.materials:
                    self.assertIsNotNone(mat.node_tree)
                    self.assertTrue(
                        any(n.type == "BSDF_PRINCIPLED" for n in mat.node_tree.nodes)
                    )

    def front_y(self, obj, x, z):
        inverse = obj.matrix_world.inverted()
        origin = inverse @ Vector((x, -3, z))
        direction = inverse.to_3x3() @ Vector((0, 1, 0))
        hit, point, _, _ = obj.ray_cast(origin, direction)
        self.assertTrue(hit, obj.name)
        return (obj.matrix_world @ point).y

    def test_armour_clearance_at_visible_front(self):
        chest, torso = self.part("ivory-breastplate"), self.part("torso")
        for z in [3.12, 3.25, 3.35]:
            self.assertLess(
                self.front_y(chest, 0, z), self.front_y(torso, 0, z) - 0.015
            )
        for sign in [-1, 1]:
            armour, skin = (
                self.part(f"ivory-gauntlet-{sign}"),
                self.part(f"forearm-{sign}"),
            )
            self.assertLess(
                self.front_y(armour, sign * 1.005, 2.69),
                self.front_y(skin, sign * 1.005, 2.69),
            )

    def test_review_cameras_and_no_transparent_runtime_exports(self):
        cameras = [o for o in self.scene.objects if o.type == "CAMERA"]
        self.assertEqual(
            {o.get("review_view") for o in cameras},
            {"pair", "front", "profile", "pet", "pet-profile"},
        )
        self.assertEqual(self.scene.camera.get("review_view"), "pair")
        self.assertFalse(self.scene.render.film_transparent)
        self.assertEqual((self.scene.frame_start, self.scene.frame_end), (1, 1))
        self.assertEqual(self.scene.render.resolution_x, 1600)
        self.assertEqual(self.scene.render.resolution_y, 1200)

    def test_finite_geometry(self):
        for obj in self.scene.objects:
            if obj.type == "MESH":
                self.assertGreater(len(obj.data.polygons), 0)
                self.assertTrue(
                    all(math.isfinite(v) for p in obj.data.vertices for v in p.co)
                )


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SavedModelReviewTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)


if __name__ == "__main__":
    main()
