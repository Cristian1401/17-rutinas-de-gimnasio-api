import { requireUid } from "@/auth/requireUid";
import { notFound } from "@/http/errors";
import { handleRouteError, jsonOk, readJson } from "@/http/json";
import type { IdRouteContext } from "@/http/route";
import { parseBody } from "@/http/validation";
import { idSchema, rutinaSchema } from "@/schemas/sync";
import { rutinaService } from "@/services/sync";

export async function GET(request: Request, context: IdRouteContext): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const id = parseBody(idSchema, (await context.params).id);
    const item = await rutinaService.get(uid, id);
    if (!item) {
      throw notFound("Rutina no encontrada");
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
    const input = parseBody(rutinaSchema, await readJson(request));
    return jsonOk(await rutinaService.upsert(uid, id, input));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: IdRouteContext): Promise<Response> {
  try {
    const uid = await requireUid(request);
    const id = parseBody(idSchema, (await context.params).id);
    const item = await rutinaService.remove(uid, id);
    if (!item) {
      throw notFound("Rutina no encontrada");
    }
    return jsonOk(item);
  } catch (error) {
    return handleRouteError(error);
  }
}
