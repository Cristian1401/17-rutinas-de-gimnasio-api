import { describe, expect, it } from "vitest";

import { getHealthStatus } from "./status";

describe("getHealthStatus", () => {
  it("devuelve ok", () => {
    expect(getHealthStatus()).toBe("ok");
  });
});
