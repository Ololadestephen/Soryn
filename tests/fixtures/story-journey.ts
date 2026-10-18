import { interactionSpec } from "../../src/domain/story/journey";
import type { StoryService } from "../../src/server/story/service";
/** Drive real authored interactions for combat/ownership fixtures; never edit saved progress. */
export function prepareStoryBattle(
  service: StoryService,
  actor: string,
  now: number,
) {
  let state = service.state(actor);
  if (state.journey?.stage === "vow") {
    service.vow(actor, "restore");
    state = service.state(actor);
  }
  const journey = state.journey;
  const spec = journey ? interactionSpec(journey.stage, journey.vow) : null;
  if (spec) {
    for (const option of spec.inspections)
      service.interact(actor, option.id, now);
    service.interact(actor, spec.answer, now);
  }
}
export function beginStoryBattle(
  service: StoryService,
  ...args: Parameters<StoryService["begin"]>
) {
  prepareStoryBattle(service, args[0], args[1]);
  return service.begin(...args);
}
/** Fixture helper for authenticated HTTP tests. Every choice goes through the real endpoint. */
export async function prepareStoryHttp(
  post: (input: Record<string, unknown>) => Promise<Response>,
) {
  for (const action of ["runes", "companion", "align"]) {
    const reply = await post({ operation: "interact", action });
    if (!reply.ok)
      throw new Error(
        `Fixture shrine interaction failed: ${reply.status} ${await reply.text()}`,
      );
  }
}
