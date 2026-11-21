import { requireUid } from "@/auth/requireUid";
import { handleRouteError, jsonOk } from "@/http/json";
import { parseQuery } from "@/http/validation";
import { progresoQuerySchema } from "@/schemas/progreso";
import { getProgreso } from "@/services/progreso";

export async function GET(request: Request): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const query = parseQuery(progresoQuerySchema, request);
    return jsonOk(await getProgreso(uid, query.ejercicio));
  } catch (error) {
    return handleRouteError(error);
  }
}
