import { readBearerToken } from "@/http/authHeader";
import { getCurrentUser } from "@/services/auth";

export async function requireUid(request: Request): Promise<string> {
  const token = readBearerToken(request.headers.get("authorization"));
  const user = await getCurrentUser(token);
  return user.uid;
}
