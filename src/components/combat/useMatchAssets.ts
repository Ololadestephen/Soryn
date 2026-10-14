import {
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from "react";
import type { BattleView } from "../../domain/combat/contracts";
import { prepareBattleAssets, portraitQuery } from "./loading";
function subscribePortrait(listener: () => void) {
  const query = window.matchMedia(portraitQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const portraitSnapshot = () => window.matchMedia(portraitQuery).matches;
const serverPortrait = () => false;
export function useMatchAssets(battle: BattleView) {
  const portrait = useSyncExternalStore(
    subscribePortrait,
    portraitSnapshot,
    serverPortrait,
  );
  const key = `${battle.id}:${battle.arena}:${battle.snapshot.player.id}:${battle.snapshot.opponent.id}:${portrait}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    key: "",
    done: 0,
    total: 5,
    failed: false,
    ready: false,
    unavailable: false,
  });
  const currentBattle = useEffectEvent(() => battle);
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    void prepareBattleAssets(
      currentBattle(),
      (done, total) => {
        if (active)
          setState({
            key,
            done,
            total,
            failed: false,
            ready: false,
            unavailable: false,
          });
      },
      abort.signal,
    ).then(({ failures, unavailable }) => {
      if (active) {
        setState((previous) => ({
          ...previous,
          key,
          failed: failures.length > 0,
          ready: unavailable.length === 0,
          unavailable: unavailable.length > 0,
        }));
      }
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [key, attempt]);
  const matches = state.key === key;
  return {
    loading: !matches || !state.ready,
    done: matches ? state.done : 0,
    total: state.total,
    failed: matches && state.failed,
    unavailable: matches && state.unavailable,
    revision: attempt,
    retry: () => setAttempt((n) => n + 1),
  };
}
