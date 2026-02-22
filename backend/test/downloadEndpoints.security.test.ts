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
    downloadHistoryRollupDaily: { upsert: jest.fn() },
    jobs: { findFirst: jest.fn() },
    dir_downloads: { findFirst: jest.fn() },
    compressed_dir_artifacts: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import Path from "path";
import { fileService } from "../src/ftp";
import { prisma } from "../src/db";
import {
  __clearDownloadIdempotencyCacheForTests,
  downloadEndpoint,
} from "../src/endpoints/download.endpoint";
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
    __clearDownloadIdempotencyCacheForTests();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = "test-secret";
    process.env.SONGS_PATH = "/srv/bearbeat-songs";
    process.env.COMPRESSION_QUEUE_NAME = "bearbeat_compression";
    process.env.COMPRESSED_DIRS_NAME = "compressed_dirs";
    (prisma.descargasUser.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
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

  it("downloadEndpoint: blocks file downloads without active membership", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (fileService.exists as jest.Mock).mockResolvedValue(true);
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.descargasUser.findMany as jest.Mock).mockResolvedValue([]);

    const req = {
      query: {
        token,
        path: "Audios/Test Song.mp3",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadEndpoint(req, res);

    expect((res.status as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(403);
    expect(res.send).toHaveBeenCalledWith({
      error: "Necesitas una membresía activa para descargar",
    });
    expect(prisma.ftpUser.findMany).not.toHaveBeenCalled();
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

  it("downloadDirEndpoint: blocks direct zip download without active membership", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.descargasUser.findMany as jest.Mock).mockResolvedValue([]);

    const req = {
      query: {
        token,
        dirName: "expected.zip",
        jobId: "123",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadDirEndpoint(req, res);

    expect((res.status as unknown as jest.Mock).mock.calls[0]?.[0]).toBe(403);
    expect(res.send).toHaveBeenCalledWith({
      error: "Necesitas una membresía activa para descargar",
    });
    expect(prisma.jobs.findFirst).not.toHaveBeenCalled();
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

  it("downloadDirEndpoint: serves shared artifact zip only with a valid user download record", async () => {
    const token = jwt.sign(
      { id: 1, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.compressed_dir_artifacts.findFirst as jest.Mock).mockResolvedValue({
      id: 77,
      zip_name: "shared-zip.zip",
      tier: "hot",
    });
    (prisma.dir_downloads.findFirst as jest.Mock).mockResolvedValue({
      downloadUrl:
        "http://localhost:5001/download-dir?artifactId=77&dirName=shared-zip.zip",
      expirationDate: new Date(Date.now() + 60_000),
      date: new Date(),
    });
    (prisma.compressed_dir_artifacts.findUnique as jest.Mock).mockResolvedValue({
      id: 77,
      tier: "hot",
    });
    (prisma.compressed_dir_artifacts.update as jest.Mock).mockResolvedValue({
      id: 77,
      tier: "hot",
    });
    (fileService.exists as jest.Mock).mockResolvedValue(true);

    const req = {
      query: {
        token,
        artifactId: "77",
        dirName: "shared-zip.zip",
      },
    } as unknown as Request;

    const res = makeRes();
    await downloadDirEndpoint(req, res);

    expect(fileService.exists).toHaveBeenCalledTimes(1);
    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect((res.sendFile as unknown as jest.Mock).mock.calls[0]?.[0]).toEqual(
      expect.stringContaining(
        `${Path.sep}${process.env.COMPRESSED_DIRS_NAME}${Path.sep}shared${Path.sep}shared-zip.zip`,
      ),
    );
  });
});

describe("downloadEndpoint rid idempotency", () => {
  const originalEnv = process.env;

  const setSuccessfulDownloadMocks = () => {
    (fileService.exists as jest.Mock).mockResolvedValue(true);
    (fileService.stat as jest.Mock).mockResolvedValue({ size: BigInt(1024) });
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ verified: true });
    (prisma.descargasUser.findMany as jest.Mock).mockResolvedValue([{ id: 1 }]);
    (prisma.ftpUser.findMany as jest.Mock).mockResolvedValue([
      { userid: "dj-user" },
    ]);
    (prisma.ftpquotatallies.findFirst as jest.Mock).mockResolvedValue({
      id: 10,
      name: "dj-user",
      bytes_out_used: BigInt(0),
    });
    (prisma.ftpQuotaLimits.findFirst as jest.Mock).mockResolvedValue({
      name: "dj-user",
      bytes_out_avail: BigInt(10_000),
    });
    (prisma.ftpquotatallies.update as jest.Mock).mockResolvedValue({
      id: 10,
      bytes_out_used: BigInt(1024),
    });
    (prisma.downloadHistory.create as jest.Mock).mockResolvedValue({ id: 1 });
    (prisma.downloadHistoryRollupDaily.upsert as jest.Mock).mockResolvedValue({
      id: 1,
    });
  };

  const makeDownloadReq = (rid?: string) => {
    const token = jwt.sign(
      { id: 99, username: "jest-user", role: "normal", email: "jest@local.test" },
      process.env.JWT_SECRET as string,
    );

    return {
      query: {
        token,
        path: "Audios/Test Song.mp3",
        ...(rid ? { rid } : {}),
      },
    } as unknown as Request;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __clearDownloadIdempotencyCacheForTests();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = "test-secret";
    process.env.SONGS_PATH = "/srv/bearbeat-songs";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("deduplicates when the same rid is retried", async () => {
    setSuccessfulDownloadMocks();

    const req = makeDownloadReq("rid-fixed-1");
    const firstRes = makeRes();
    const secondRes = makeRes();

    await downloadEndpoint(req, firstRes);
    await downloadEndpoint(req, secondRes);

    expect(prisma.ftpquotatallies.update).toHaveBeenCalledTimes(1);
    expect(prisma.downloadHistory.create).toHaveBeenCalledTimes(1);
    expect(firstRes.sendFile).toHaveBeenCalledTimes(1);
    expect(secondRes.sendFile).toHaveBeenCalledTimes(1);
  });

  it("charges twice when rid is different", async () => {
    setSuccessfulDownloadMocks();

    const firstRes = makeRes();
    const secondRes = makeRes();

    await downloadEndpoint(makeDownloadReq("rid-1"), firstRes);
    await downloadEndpoint(makeDownloadReq("rid-2"), secondRes);

    expect(prisma.ftpquotatallies.update).toHaveBeenCalledTimes(2);
    expect(prisma.downloadHistory.create).toHaveBeenCalledTimes(2);
  });

  it("keeps legacy behavior when rid is omitted", async () => {
    setSuccessfulDownloadMocks();

    const firstRes = makeRes();
    const secondRes = makeRes();

    await downloadEndpoint(makeDownloadReq(), firstRes);
    await downloadEndpoint(makeDownloadReq(), secondRes);

    expect(prisma.ftpquotatallies.update).toHaveBeenCalledTimes(2);
    expect(prisma.downloadHistory.create).toHaveBeenCalledTimes(2);
  });
});
