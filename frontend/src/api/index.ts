import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { getAccessToken } from "../utils/authStorage";
import { trpcUrl } from "../utils/runtimeConfig";

// No importar AppRouter desde backend: el compilador del frontend intenta compilar
// todo el backend y falla (dotenv, prisma, etc. no están en frontend).
// El cliente funciona igual en runtime; se pierde solo inferencia estricta de tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trpc: any = createTRPCProxyClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: trpcUrl,
      headers: () => {
        const token = getAccessToken();
        if (!token) {
          return {};
        }
        return {
          authorization: `Bearer ${token}`,
        };
      },
    }),
  ],
} as any);

export default trpc;
