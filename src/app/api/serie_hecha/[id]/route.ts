import { requireUid } from "@/auth/requireUid";
import { notFound } from "@/http/errors";
import { handleRouteError, jsonOk, readJson } from "@/http/json";
import type { IdRouteContext } from "@/http/route";
import { parseBody } from "@/http/validation";
import { idSchema, serieHechaSchema } from "@/schemas/sync";
import { serieHechaService } from "@/services/sync";

export async function GET(request: Request, context: IdRouteContext): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const id = parseBody(idSchema, (await context.params).id);
    const item = await serieHechaService.get(uid, id);
    if (!item) {
      throw notFound("Serie no encontrada");
    }
    return jsonOk(item);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: IdRouteContext): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const id = parseBody(idSchema, (await context.params).id);
    const input = parseBody(serieHechaSchema, await readJson(request));
    return jsonOk(await serieHechaService.upsert(uid, id, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: IdRouteContext): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const id = parseBody(idSchema, (await context.params).id);
    const item = await serieHechaService.remove(uid, id);
    if (!item) {
      throw notFound("Serie no encontrada");
    }
    return jsonOk(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
