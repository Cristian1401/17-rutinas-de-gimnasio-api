import { jsonOk } from "@/http/json";
import { getHealthStatus } from "@/http/status";

export function GET(): Response {
  return jsonOk({ status: getHealthStatus() });
}
