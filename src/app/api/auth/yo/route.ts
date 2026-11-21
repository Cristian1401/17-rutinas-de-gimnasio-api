import { readBearerToken } from "@/http/authHeader";
import { handleRouteError, jsonOk } from "@/http/json";
import { getCurrentUser } from "@/services/auth";

export async function GET(request: Request): Promise<Response> {
  try {
    const token = readBearerToken(request.headers.get("authorization"));
    return jsonOk(await getCurrentUser(token));
  } catch (error) {
    return handleRouteError(error);
  }
}
