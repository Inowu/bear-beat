import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/src/routers";

const url = process.env.NODE_ENV === 'production' ? 'https://kale67.world/trpc' : 'http://localhost:5000/trpc';
 
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
