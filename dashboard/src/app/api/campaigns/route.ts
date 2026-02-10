import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(1).max(200),
  searchUrl: z.string().url(),
  templateId: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id, status: { not: "archived" } },
      include: {
        template: { select: { name: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(campaigns);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = campaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: { userId: user.id, ...data },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
