import { handleRouteError, jsonOk, readJson } from "@/http/json";
import { parseBody } from "@/http/validation";
import { loginSchema } from "@/schemas/auth";
import { loginUser } from "@/services/auth";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = parseBody(loginSchema, await readJson(request));
    return jsonOk(await loginUser(input));
  } catch (error) {
    return handleRouteError(error);
  }
}
