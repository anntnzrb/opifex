import { Effect, Schedule } from "effect";
import { RequestError } from "./request-error.ts";
export const request = (url: string) =>
  Effect.tryPromise({
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    try: async (signal) => {
      const response = await fetch(url, { signal, redirect: "error" });
      if (!response.ok)
        throw new RequestError({
          message: `HTTP ${response.status} from ${url}`,
          retryable: response.status === 429 || response.status >= 500,
          cause: null,
        });
      return response.arrayBuffer();
    },
    catch: (cause) =>
      cause instanceof RequestError
        ? cause
        : new RequestError({ message: `Could not fetch ${url}`, retryable: true, cause }),
  }).pipe(
    Effect.timeout("30 seconds"),
    Effect.retry({
      times: 2,
      schedule: Schedule.exponential("250 millis"),
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      while: (error) => !(error instanceof RequestError) || error.retryable,
    }),
  );
