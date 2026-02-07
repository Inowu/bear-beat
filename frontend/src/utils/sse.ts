import { useSSE } from "react-hooks-sse";

export function useSafeSSE<T>(event: string, initialState: T): T {
  try {
    return useSSE(event, initialState);
  } catch {
    return initialState;
  }
}

