"""Original deterministic procedural sound palette; no recordings or samples."""

import json
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
PCM_PEAK = 32767
ROOT = Path("public/combat/audio")
ROOT.mkdir(parents=True, exist_ok=True)
# frequency, duration, noise proportion, frequency end ratio, harmonic colour
PALETTE = {
    "select": (650, 0.055, 0.05, 1.15, 1),
    "confirm": (420, 0.11, 0.03, 1.5, 2),
    "impact": (115, 0.16, 0.45, 0.45, 1),
    "block": (730, 0.2, 0.18, 0.8, 3),
    "brace": (300, 0.09, 0.1, 0.8, 2),
    "counter": (230, 0.2, 0.35, 1.8, 2),
    "heal": (700, 0.28, 0.015, 1.5, 3),
    "energy": (350, 0.12, 0.01, 1.5, 2),
    "knockout": (130, 0.38, 0.36, 0.24, 2),
    "victory": (440, 0.5, 0, 1.5, 3),
    "defeat": (330, 0.4, 0.025, 0.65, 2),
    "draw": (440, 0.3, 0, 1, 2),
    "special-pip": (1050, 0.23, 0.22, 1.4, 1),
    "special-bolt": (160, 0.19, 0.65, 2.5, 1),
    "special-patch": (520, 0.25, 0.1, 1.5, 3),
    "special-moss": (410, 0.3, 0.04, 1.75, 3),
    "special-aegis": (180, 0.27, 0.4, 0.6, 4),
    "special-nyx": (130, 0.24, 0.45, 1.8, 2),
    "special-echo": (600, 0.27, 0.13, 0.7, 3),
    "special-prism": (900, 0.3, 0.03, 1.7, 4),
    "special-atlas": (90, 0.3, 0.42, 0.5, 2),
    "special-flux": (410, 0.26, 0.18, 2.1, 4),
    "special-ember": (240, 0.32, 0.65, 1.8, 2),
    "special-mneme": (610, 0.3, 0.04, 0.8, 3),
}
measurements = []
for index, (name, (frequency, duration, noise, ratio, colour)) in enumerate(
    PALETTE.items()
):
    rng = random.Random(index + 701)
    samples, phase = [], 0.0
    count = round(duration * RATE)
    for n in range(count):
        t = n / RATE
        phase += 2 * math.pi * frequency * (1 + (ratio - 1) * t / duration) / RATE
        envelope = min(1, t / 0.005) * (1 - t / duration) ** 2
        tone = (
            math.sin(phase)
            + 0.25 * math.sin(phase * colour)
            + 0.14 * math.sin(phase * 1.5)
        )
        value = envelope * ((1 - noise) * tone * 0.5 + noise * rng.uniform(-1, 1))
        samples.append(max(-0.8, min(0.8, value)))
    path = ROOT / f"{name}.wav"
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(
            b"".join(struct.pack("<h", round(value * PCM_PEAK)) for value in samples)
        )
    measurements.append(
        {
            "cue": name,
            "path": str(path),
            "duration": duration,
            "frames": count,
            "sampleRate": RATE,
            "channels": 1,
            "bytes": path.stat().st_size,
            "decodedFloat32Bytes": count * 4,
        }
    )
Path("docs/evidence/arena-feel/audio.json").write_text(
    json.dumps(
        {
            "method": "Original procedural synthesis, deterministic seeded noise and authored tones; no third-party recordings, samples or paid service",
            "script": "scripts/audio/prepare.py",
            "measurements": measurements,
        },
        indent=2,
    )
    + "\n"
)
print(f"Prepared {len(measurements)} original cues")
