import type { ChatTarget } from "./config";
import { streamChat } from "./llm";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export interface RaceWinner {
  target: ChatTarget;
  /** the first answer delta that won the race — the caller must emit it before consuming `stream` */
  first: string;
  stream: AsyncGenerator<string>;
}

export interface RaceOptions {
  signal?: AbortSignal;
  budgetMs: number; // give up entirely after this long
  hedgeMs: number; // start the next model if nobody has produced a token after this long
  firstTokenMs: number; // per-model cap on the wait for its first token
  minAttemptMs: number; // don't start a model with less time than this left
  onFail: (target: ChatTarget, error: unknown) => void;
  /** Return false to skip a target right now (used to rate-cap the reserve providers). */
  canLaunch?: (target: ChatTarget) => boolean;
  onLaunch?: (target: ChatTarget) => void;
}

/**
 * Hedged request across several models. Free-tier endpoints often accept a request and then stall, and waiting for
 * each dead model in turn is what makes a visitor stare at a spinner. Instead: start the best model; if it hasn't
 * produced a token within `hedgeMs` (or it fails outright) start the next one *in parallel*; the first model to
 * produce a token wins and every other attempt is cancelled. Order of attempts: every primary model once, then the
 * reserve providers (once each — their free quotas are small), then the primaries a second time, so a transient
 * failure gets a second chance. Resolves null if the budget runs out or every attempt fails.
 */
export function raceForFirstToken(targets: ChatTarget[], messages: Msg[], opts: RaceOptions): Promise<RaceWinner | null> {
  const deadline = Date.now() + opts.budgetMs;
  const primaries = targets.filter((t) => !t.reserve);
  const reserves = targets.filter((t) => t.reserve);
  const queue = [...primaries, ...reserves, ...primaries];
  const inflight = new Map<number, { target: ChatTarget; ctrl: AbortController }>();
  let nextId = 0;
  let settled = false;
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  return new Promise((resolve) => {
    const finish = (winner: RaceWinner | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadlineTimer);
      for (const a of inflight.values()) a.ctrl.abort(); // the winner has already left `inflight`
      inflight.clear();
      resolve(winner);
    };

    const launch = () => {
      if (settled) return;
      clearTimeout(hedgeTimer);
      const remaining = deadline - Date.now();
      const idx = queue.findIndex((t) => ![...inflight.values()].some((a) => a.target === t) && (opts.canLaunch?.(t) ?? true));
      if (remaining < opts.minAttemptMs || idx === -1) {
        if (!inflight.size) finish(null); // nothing left to try and nothing running
        return;
      }
      const [target] = queue.splice(idx, 1);
      opts.onLaunch?.(target);
      const ctrl = new AbortController();
      const signal = opts.signal ? AbortSignal.any([opts.signal, ctrl.signal]) : ctrl.signal;
      const stream = streamChat(target, messages, signal, Math.min(opts.firstTokenMs, remaining));
      const id = nextId++;
      inflight.set(id, { target, ctrl });
      hedgeTimer = setTimeout(launch, opts.hedgeMs); // hedge: bring in the next model if this one is slow

      stream.next().then(
        (r) => {
          inflight.delete(id);
          if (settled) return ctrl.abort();
          if (!r.done && r.value) return finish({ target, first: r.value, stream });
          opts.onFail(target, new Error("empty completion"));
          launch();
        },
        (err) => {
          inflight.delete(id);
          if (settled) return;
          opts.onFail(target, err);
          launch(); // failed outright → don't wait for the hedge timer
        },
      );
    };

    deadlineTimer = setTimeout(() => finish(null), opts.budgetMs);
    launch();
  });
}
