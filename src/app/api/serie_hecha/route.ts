import { requireUid } from "@/auth/requireUid";
import { handleRouteError, jsonOk } from "@/http/json";
import { parseQuery } from "@/http/validation";
import { sinceQuerySchema } from "@/schemas/sync";
import { serieHechaService } from "@/services/sync";

export async function GET(request: Request): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const query = parseQuery(sinceQuerySchema, request);
    return jsonOk({ items: await serieHechaService.listSince(uid, query.since) });
  } catch (error) {
    return handleRouteError(error);
  }
}
