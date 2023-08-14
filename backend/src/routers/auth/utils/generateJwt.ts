import jwt from "jsonwebtoken";
import { serializeUser } from "./serialize-user";
import { Users } from "@prisma/client";

export const generateJwt = (user: Users) =>
  jwt.sign(
    {
      user: serializeUser(user),
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );
