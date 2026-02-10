import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const activitySchema = z.array(
  z.object({
    campaignId: z.string().optional().nullable(),
    type: z.string(),
    data: z.record(z.string(), z.unknown()).optional().nullable(),
    createdAt: z.string().optional(),
  })
);

export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const entries = activitySchema.parse(body);

    await prisma.activityLog.createMany({
      data: entries.map((entry) => ({
        userId: user.id,
        campaignId: entry.campaignId || null,
        type: entry.type,
        data: (entry.data as Prisma.InputJsonValue) || Prisma.JsonNull,
        createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      })),
    });

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
