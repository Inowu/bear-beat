import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/src/routers";

const url =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001/trpc"
    : "https://thebearbeatapi.lat/trpc";

const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url,
      headers: () => {
        return {
          authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
        };
      },
    }),
  ],
});

export default trpc;
