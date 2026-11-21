import { beforeEach, describe, expect, it, vi } from "vitest";

import { readBearerToken } from "@/http/authHeader";
import { HttpError } from "@/http/errors";
import { getCurrentUser } from "@/services/auth";

import { requireUid } from "./requireUid";

vi.mock("@/http/authHeader", () => ({ readBearerToken: vi.fn() }));
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));

const request = new Request("http://localhost/api/rutina", {
  headers: { authorization: "Bearer token" },
});

describe("requireUid", () => {
  beforeEach(() => {
    vi.mocked(readBearerToken).mockReturnValue("token");
    vi.mocked(getCurrentUser).mockResolvedValue({
      uid: "uid-a",
      emailVerified: true,
    });
  });

  it("obtiene el uid del token verificado", async () => {
    await expect(requireUid(request)).resolves.toBe("uid-a");
    expect(readBearerToken).toHaveBeenCalledWith("Bearer token");
    expect(getCurrentUser).toHaveBeenCalledWith("token");
  });

  it("propaga el error de autenticación", async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new HttpError(401, "UNAUTHORIZED", "Token"));
    await expect(requireUid(request)).rejects.toMatchObject({ status: 401 });
  });
});
