import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/src/routers";

const url = process.env.NODE_ENV === 'production' ? 'https://thebearbeatapi.lat/trpc' : 'https://kale67.world/trpc';

//ACTIVAR PARA LOCAL  
// const url = process.env.NODE_ENV === 'production' ? 'https://kale67.world/trpc' : 'https://kale67.world/test/trpc';

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