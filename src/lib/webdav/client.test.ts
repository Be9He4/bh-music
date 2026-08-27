import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithTimeout } = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock("@/lib/api/config", () => ({
  fetchWithTimeout,
  IS_NATIVE: false,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  normalizeUrl,
  buildBackupUrl,
  encodeBase64,
  testConnection,
  uploadBackup,
  downloadBackup,
  type WebdavConfig,
} from "./client";

const cfg: WebdavConfig = {
  url: "https://dav.example.com/backup/",
  username: "user",
  password: "pass",
};

function mockResponse(status: number, text = "") {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

describe("webdav client", () => {
  beforeEach(() => {
    fetchWithTimeout.mockClear();
  });

  it("normalizes trailing slashes", () => {
    expect(normalizeUrl("https://dav.example.com/backup/")).toBe(
      "https://dav.example.com/backup"
    );
  });

  it("builds backup file url", () => {
    expect(buildBackupUrl("https://dav.example.com/backup/")).toBe(
      "https://dav.example.com/backup/otter-music-backup.json"
    );
  });

  it("encodes utf-8 credentials to base64", () => {
    expect(encodeBase64("user:pass")).toBe("dXNlcjpwYXNz");
  });

  it("rejects invalid credentials in testConnection", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(401));
    await expect(testConnection(cfg)).rejects.toThrow("认证失败");
  });

  it("tests the connection with OPTIONS", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(204));
    await expect(testConnection(cfg)).resolves.toBeUndefined();

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://dav.example.com/backup/",
      expect.objectContaining({ method: "OPTIONS" })
    );
  });

  it("rejects a missing directory in testConnection", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(404));
    await expect(testConnection(cfg)).rejects.toThrow("连接失败，HTTP 404");
  });

  it("uploads backup via PUT with json body", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(201));
    await expect(uploadBackup(cfg, '{"a":1}')).resolves.toBeUndefined();

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://dav.example.com/backup/otter-music-backup.json",
      expect.objectContaining({ method: "PUT", body: '{"a":1}' })
    );
  });

  it("downloads backup text", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(200, '{"v":1}'));
    await expect(downloadBackup(cfg)).resolves.toBe('{"v":1}');
  });

  it("reports missing backup on 404", async () => {
    fetchWithTimeout.mockResolvedValueOnce(mockResponse(404));
    await expect(downloadBackup(cfg)).rejects.toThrow("云端暂无备份");
  });
});
