import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

jest.mock("../src/ftp", () => ({
  fileService: {
    exists: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock("../src/db", () => ({
  prisma: {
    users: { findFirst: jest.fn() },
    descargasUser: { findMany: jest.fn() },
    ftpUser: { findMany: jest.fn() },
    ftpquotatallies: { findFirst: jest.fn(), update: jest.fn() },
    ftpQuotaLimits: { findFirst: jest.fn() },
    downloadHistory: { create: jest.fn() },
    jobs: { findFirst: jest.fn() },
    dir_downloads: { findFirst: jest.fn() },
  },
}));

import Path from "path";
import { fileService } from "../src/ftp";
import { prisma } from "../src/db";
import { downloadEndpoint } from "../src/endpoints/download.endpoint";
import { downloadDirEndpoint } from "../src/endpoints/download-dir.endpoint";

function makeRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    headers?: Record<string, string>;
  } = {};

  res.statusCode = 200;
  res.headers = {};

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.send = jest.fn(() => res as Response);
  res.sendFile = jest.fn(() => res as Response);
  res.setHeader = jest.fn((key: string, value: string) => {
    res.headers![key] = value;
    return res as Response;
  });

  return res as Response;
}

describe("Download endpoints security (path traversal / IDOR guardrails)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = "test-secret";
    process.env.SONGS_PATH = "/srv/bearbeat-songs";
    process.env.COMPRESSION_QUEUE_NAME = "bearbeat_compression";
    process.env.COMPRESSED_DIRS_NAME = "compressed_dirs";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("downloadEndpoint: rejects path traversal attempts", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (fileService.exists as jest.Mock).mockImplementation(() => {
      throw new Error("fileService.exists should not be called for invalid paths");
    });

    const req = {
      query: {
        token,
        path: "../../etc/passwd",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadEndpoint(req, res);

    expect((res.status as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(400);
    expect(res.send).toHaveBeenCalledWith({ error: "Bad request" });
  });

  it("downloadDirEndpoint: rejects unsafe dirName values (traversal/separators)", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    const req = {
      query: {
        token,
        dirName: "../../evil.zip",
        jobId: "123",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadDirEndpoint(req, res);

    expect((res.status as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(400);
    expect(res.send).toHaveBeenCalledWith({ error: "Bad request" });
  });

  it("downloadDirEndpoint: rejects mismatched dirName vs server-generated downloadUrl", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.jobs.findFirst as jest.Mock).mockResolvedValue({ id: 9 });
    (prisma.dir_downloads.findFirst as jest.Mock).mockResolvedValue({
      downloadUrl: "http://localhost:5001/download-dir?dirName=expected.zip&jobId=123",
      expirationDate: new Date(Date.now() + 60_000),
    });

    (fileService.exists as jest.Mock).mockImplementation(() => {
      throw new Error("fileService.exists should not be called when dirName mismatches");
    });

    const req = {
      query: {
        token,
        dirName: "wrong.zip",
        jobId: "123",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadDirEndpoint(req, res);

    expect((res.status as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(404);
    expect(res.send).toHaveBeenCalledWith({
      error: "Ocurrió un error al descargar la carpeta",
    });
  });

  it("downloadDirEndpoint: serves only the expected zip file under COMPRESSED_DIRS_NAME", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.jobs.findFirst as jest.Mock).mockResolvedValue({ id: 9 });
    (prisma.dir_downloads.findFirst as jest.Mock).mockResolvedValue({
      downloadUrl: "http://localhost:5001/download-dir?dirName=expected.zip&jobId=123",
      expirationDate: new Date(Date.now() + 60_000),
    });

    (fileService.exists as jest.Mock).mockResolvedValue(true);

    const req = {
      query: {
        token,
        dirName: "expected.zip",
        jobId: "123",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadDirEndpoint(req, res);

    expect(fileService.exists).toHaveBeenCalledTimes(1);
    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect((res.sendFile as unknown as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.stringContaining(
        `${Path.sep}${process.env.COMPRESSED_DIRS_NAME}${Path.sep}expected.zip`,
      ),
    );
  });
});
