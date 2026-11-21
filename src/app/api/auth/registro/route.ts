import { handleRouteError, jsonOk, readJson } from "@/http/json";
import { parseBody } from "@/http/validation";
import { registroSchema } from "@/schemas/auth";
import { registerUser } from "@/services/auth";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = parseBody(registroSchema, await readJson(request));
    return jsonOk(await registerUser(input), 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
