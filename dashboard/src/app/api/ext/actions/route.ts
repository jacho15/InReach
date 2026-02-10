import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const actionSchema = z.object({
  campaignId: z.string(),
  profileUrl: z.string(),
  name: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  status: z.enum(["sent", "skipped", "error", "pending"]),
  messageSent: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = actionSchema.parse(body);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert contact
    await prisma.contact.upsert({
      where: {
        userId_profileUrl: {
          userId: user.id,
          profileUrl: data.profileUrl,
        },
      },
      update: {
        status: data.status,
        messageSent: data.messageSent,
        sentAt: data.status === "sent" ? new Date() : undefined,
        campaignId: data.campaignId,
      },
      create: {
        userId: user.id,
        campaignId: data.campaignId,
        profileUrl: data.profileUrl,
        name: data.name,
        headline: data.headline,
        company: data.company,
        status: data.status,
        messageSent: data.messageSent,
        sentAt: data.status === "sent" ? new Date() : undefined,
      },
    });

    // Increment daily stats
    const statField =
      data.status === "sent"
        ? "sent"
        : data.status === "error"
          ? "errors"
          : "skipped";

    await prisma.dailyStat.upsert({
      where: {
        userId_date_campaignId: {
          userId: user.id,
          date: today,
          campaignId: data.campaignId,
        },
      },
      update: { [statField]: { increment: 1 } },
      create: {
        userId: user.id,
        campaignId: data.campaignId,
        date: today,
        [statField]: 1,
      },
    });

    // Increment template sent count if sent
    if (data.status === "sent") {
      const campaign = await prisma.campaign.findUnique({
        where: { id: data.campaignId },
        select: { templateId: true },
      });
      if (campaign?.templateId) {
        await prisma.template.update({
          where: { id: campaign.templateId },
          data: { sentCount: { increment: 1 } },
        });
      }
    }

    return NextResponse.json({ success: true });
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
