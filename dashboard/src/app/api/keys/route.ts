import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/utils";
import crypto from "crypto";

function generateApiKey(): string {
  const bytes = crypto.randomBytes(32);
  return "ir_" + bytes.toString("base64url");
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function GET() {
  try {
    const user = await requireUser();
    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(keys);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 11) + "...";

    await prisma.apiKey.create({
      data: {
        userId: user.id,
        name,
        keyHash,
        keyPrefix,
      },
    });

    // Return the raw key only once — it won't be stored
    return NextResponse.json({ key: rawKey, name, keyPrefix });
  } catch (error) {
    return handleApiError(error);
  }
}
