import { z } from "zod";
import { publicProcedure } from "../../procedures/public.procedure";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import { generateJwt } from "./utils/generateJwt";

export const login = publicProcedure
  .input(
    z.object({
      username: z.string(),
      password: z.string(),
    })
  )
  .query(async ({ input: { password, username }, ctx: { prisma } }) => {
    const user = await prisma.users.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: username,
            },
          },
          {
            email: {
              equals: username,
            },
          },
        ],
      },
    });

    if (!user)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
      });

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasswordCorrect)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
      });

    return {
      token: generateJwt(user),
    };
  });
