import { initTRPC } from "@trpc/server";
import { Context } from "../context";
import SuperJSON from "superjson";

export const t = initTRPC.context<Context>().create({
  transformer: SuperJSON,
});

export const router = t.router;
