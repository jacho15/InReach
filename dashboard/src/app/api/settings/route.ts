import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";

const settingsSchema = z.object({
  dailyLimit: z.number().min(1).max(100).optional(),
  weeklyLimit: z.number().min(1).max(500).optional(),
  cooldownMin: z.number().min(5000).max(300000).optional(),
  cooldownMax: z.number().min(5000).max(300000).optional(),
  businessHoursOnly: z.boolean().optional(),
  businessHoursStart: z.number().min(0).max(23).optional(),
  businessHoursEnd: z.number().min(0).max(23).optional(),
  warmupEnabled: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  timezone: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    let settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: user.id },
      });
    }
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = settingsSchema.parse(body);

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    });

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
