import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

// No importar AppRouter desde backend: el compilador del frontend intenta compilar
// todo el backend y falla (dotenv, prisma, etc. no están en frontend).
// El cliente funciona igual en runtime; se pierde solo inferencia estricta de tipos.
const url =
  process.env.REACT_APP_ENVIRONMENT === "development"
    ? "http://localhost:5001/trpc"
    : "https://thebearbeatapi.lat/trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trpc: any = createTRPCProxyClient({
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
} as any);

export default trpc;
