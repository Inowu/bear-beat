import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../backend/src/routers";

const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: "http://localhost:5000/trpc",
      headers: () => {
        console.log(localStorage.getItem("token"));
        return {
          authorization: localStorage.getItem("token") ?? "",
        };
      },
    }),
  ],
});

export default trpc;
