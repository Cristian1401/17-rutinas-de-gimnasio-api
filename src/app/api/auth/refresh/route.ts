import { handleRouteError, jsonOk, readJson } from "@/http/json";
import { parseBody } from "@/http/validation";
import { refreshSchema } from "@/schemas/auth";
import { refreshSession } from "@/services/auth";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = parseBody(refreshSchema, await readJson(request));
    return jsonOk(await refreshSession(input));
  } catch (error) {
    return handleRouteError(error);
  }
}
