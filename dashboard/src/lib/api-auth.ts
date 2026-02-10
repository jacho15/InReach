import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function authenticateApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = auth.slice(7);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  if (!apiKey) return null;

  // Update lastUsed timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  });

  return apiKey.user;
}
