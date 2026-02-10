import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  searchUrl: z.string().url().optional(),
  templateId: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
      include: {
        template: true,
        contacts: { orderBy: { createdAt: "desc" }, take: 50 },
        dailyStats: { orderBy: { date: "desc" }, take: 30 },
        activityLogs: { orderBy: { createdAt: "desc" }, take: 20 },
        _count: { select: { contacts: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    });

    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await prisma.campaign.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: "archived" },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
