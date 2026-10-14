/** Static presentation geometry only; it has no combat positions or movement rules. */
export function stageLayout(
  width: number,
  height: number,
  hudBottom: number,
  controlsTop: number,
  sourceLimit: number,
  readinessHeight = 18,
) {
  const portrait = width <= 700 && height > 500;
  const landscape = height <= 500;
  const available = Math.max(1, controlsTop - hudBottom - 44 - readinessHeight);
  const fighterSize = Math.floor(
    Math.min(
      sourceLimit,
      available,
      portrait
        ? width * 0.64
        : landscape
          ? height * 0.5
          : Math.min(width * 0.38, height * 0.64),
    ),
  );
  const fieldHeight = portrait
    ? Math.min(available, fighterSize + 28)
    : available;
  const fieldTop = hudBottom + 36;
  const center = portrait ? 0.25 : landscape ? 0.25 : 0.27;
  return {
    fieldTop,
    fieldHeight,
    fighterSize,
    left: Math.round(width * center - fighterSize / 2),
    reach: Math.max(0, width * (1 - center * 2) - fighterSize * 0.55),
  };
}
