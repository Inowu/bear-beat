import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { authRouter } from "../src/routers/auth";
import { RolesIds, RolesNames } from "../src/routers/auth/interfaces/roles.interface";

jest.setTimeout(60_000);

describe("TRPC API (smoke)", () => {
  const normalEmail = "jest-user@local.test";
  const adminEmail = "jest-admin@local.test";
  const password = "password-12345";

  let normalUserId = 0;
  let adminUserId = 0;
  let normalRoleId = RolesIds.normal;
  let adminRoleId = RolesIds.admin;

  beforeAll(async () => {
    const normalRole = await prisma.roles.upsert({
      where: { name: RolesNames.normal },
      update: {},
      create: { name: RolesNames.normal },
    });
    normalRoleId = normalRole.id;

    const adminRole = await prisma.roles.upsert({
      where: { name: RolesNames.admin },
      update: {},
      create: { name: RolesNames.admin },
    });
    adminRoleId = adminRole.id;

    const hash = await bcrypt.hash(password, 10);

    const normal = await prisma.users.upsert({
      where: { email: normalEmail },
      update: {
        username: "jest-user",
        password: hash,
        role_id: normalRoleId,
        active: 1,
        verified: true,
        blocked: false,
      },
      create: {
        username: "jest-user",
        email: normalEmail,
        password: hash,
        role_id: normalRoleId,
        active: 1,
        verified: true,
        blocked: false,
      },
    });
    normalUserId = normal.id;

    const admin = await prisma.users.upsert({
      where: { email: adminEmail },
      update: {
        username: "jest-admin",
        password: hash,
        role_id: adminRoleId,
        active: 1,
        verified: true,
        blocked: false,
      },
      create: {
        username: "jest-admin",
        email: adminEmail,
        password: hash,
        role_id: adminRoleId,
        active: 1,
        verified: true,
        blocked: false,
      },
    });
    adminUserId = admin.id;
  });

  // Keep the test router minimal to avoid pulling in ESM-only deps from unrelated routers.
  const testRouter = router({
    auth: authRouter,
  });

  const caller = testRouter.createCaller({
    req: {} as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const makeCaller = (user: {
    id: number;
    role: RolesNames;
    username: string;
    email: string;
  }) =>
    testRouter.createCaller({
      req: {} as any,
      res: {} as any,
      prisma,
      session: {
        user: {
          id: user.id,
          role: user.role,
          username: user.username,
          phone: null,
          verified: true,
          email: user.email,
          profileImg: null,
          stripeCusId: null,
        },
      },
    });

  it("login: allows valid credentials", async () => {
    const res = await caller.auth.login({
      username: normalEmail,
      password,
    });
    expect(res.token).toBeDefined();
    expect(res.refreshToken).toBeDefined();
  });

  it("login: rejects invalid password", async () => {
    try {
      await caller.auth.login({
        username: normalEmail,
        password: "wrong-password",
      });
      throw new Error("expected auth.login to throw");
    } catch (cause) {
      expect(cause).toBeInstanceOf(TRPCError);
      expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(401);
    }
  });

  it("me: rejects when not authenticated", async () => {
    try {
      await caller.auth.me();
      throw new Error("expected auth.me to throw");
    } catch (cause) {
      expect(cause).toBeInstanceOf(TRPCError);
      expect(getHTTPStatusCodeFromError(cause as TRPCError)).toBe(403);
    }
  });

  it("me: returns session user when authenticated", async () => {
    const normalCaller = makeCaller({
      id: normalUserId,
      role: RolesNames.normal,
      username: "jest-user",
      email: normalEmail,
    });

    const me = await normalCaller.auth.me();
    expect(me.id).toBe(normalUserId);
    expect(me.email).toBe(normalEmail);
  });
});
