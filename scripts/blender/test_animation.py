"""Exercise the saved real rigs/actions in background Blender, without mocks."""

import json
import sys
import unittest
from pathlib import Path

import bpy


class RigAnimationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        from scripts.blender.animation import activate
        from scripts.blender.pilot_scene import PILOT_SCENE

        cls.scene = bpy.data.scenes.get(PILOT_SCENE)
        if cls.scene is None:
            raise AssertionError("Rigged scene missing")
        bpy.context.window.scene = cls.scene
        cls.rigs = {
            a: bpy.data.objects[n]
            for a, n in json.loads(cls.scene["rig_names"]).items()
        }
        cls.actions = {
            a: {c: bpy.data.actions[n] for c, n in clips.items()}
            for a, clips in json.loads(cls.scene["actions"]).items()
        }
        cls.shaped = [bpy.data.objects[n] for n in json.loads(cls.scene["curl_meshes"])]
        cls.activate = staticmethod(activate)
        cls.meshes = [o for o in cls.scene.objects if o.type == "MESH"]

    def test_both_real_skeletons_and_saved_action_channels(self):
        self.assertEqual(len(self.rigs["aegis"].data.bones), 26)
        self.assertEqual(len(self.rigs["armadillo"].data.bones), 7)
        self.assertEqual(len(self.actions["aegis"]), 11)
        self.assertEqual(
            set(self.actions["armadillo"]), {"idle", "special", "defeated"}
        )
        for clips in self.actions.values():
            for action in clips.values():
                self.assertFalse(action.is_empty)
                self.assertGreater(len(action.slots), 0)

    def test_every_vertex_is_bound_to_a_real_deform_bone(self):
        for obj in self.meshes:
            rig = self.rigs[obj["pilot_actor"]]
            modifiers = [m for m in obj.modifiers if m.type == "ARMATURE"]
            self.assertEqual(len(modifiers), 1, obj.name)
            self.assertEqual(modifiers[0].object, rig)
            for vertex in obj.data.vertices:
                self.assertTrue(
                    any(
                        g.weight > 0
                        and obj.vertex_groups[g.group].name in rig.data.bones
                        for g in vertex.groups
                    ),
                    obj.name,
                )

    def test_idle_guard_and_hit_keep_feet_planted(self):
        feet = [o for o in self.meshes if o.get("deform_bone", "").startswith("foot.")]
        for clip, last in [("idle", 24), ("guard", 24), ("hit", 12), ("knockout", 20)]:
            self.activate(self.rigs, self.actions, self.shaped, clip)
            for frame in [1, last // 2, last]:
                self.scene.frame_set(frame)
                graph = bpy.context.evaluated_depsgraph_get()
                for foot in ["foot.L", "foot.R"]:
                    levels = []
                    for obj in feet:
                        if obj["deform_bone"] != foot:
                            continue
                        evaluated = obj.evaluated_get(graph)
                        mesh = evaluated.to_mesh()
                        levels.extend(
                            (evaluated.matrix_world @ v.co).z for v in mesh.vertices
                        )
                        evaluated.to_mesh_clear()
                    z = min(levels)
                    self.assertAlmostEqual(
                        z, 0, delta=0.001, msg=f"{clip}/{frame}/{foot}"
                    )

    def test_special_curls_then_recovers_without_an_instant_model_swap(self):
        self.activate(self.rigs, self.actions, self.shaped, "special")
        samples = []
        for frame in [1, 3, 6, 18, 33, 36]:
            self.scene.frame_set(frame)
            samples.append(self.shaped[0].data.shape_keys.key_blocks["Curl"].value)
        self.assertAlmostEqual(samples[0], 0)
        self.assertGreater(samples[1], 0)
        self.assertLess(samples[1], 1)
        self.assertAlmostEqual(samples[2], 1)
        self.assertAlmostEqual(samples[3], 1)
        self.assertLess(samples[4], 1)
        self.assertAlmostEqual(samples[5], 0)
        self.scene.frame_set(18)
        self.assertAlmostEqual(
            self.rigs["armadillo"].pose.bones["root"].rotation_euler.x,
            6.283185,
            delta=0.001,
        )

    def test_knockout_finishes_in_the_same_defeated_hold(self):
        self.activate(self.rigs, self.actions, self.shaped, "knockout")
        self.scene.frame_set(20)
        knockout = self.rigs["aegis"].pose.bones["hips"].matrix.copy()
        self.activate(self.rigs, self.actions, self.shaped, "defeated")
        self.scene.frame_set(1)
        held = self.rigs["aegis"].pose.bones["hips"].matrix
        for row in range(4):
            for column in range(4):
                self.assertAlmostEqual(
                    knockout[row][column], held[row][column], delta=0.001
                )


def main() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RigAnimationTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)


if __name__ == "__main__":
    main()
