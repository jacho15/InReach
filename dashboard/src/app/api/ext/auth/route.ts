import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await authenticateApiKey(req);
  if (!user) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const [settings, templates, campaigns] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.template.findMany({ where: { userId: user.id } }),
    prisma.campaign.findMany({
      where: { userId: user.id, status: "active" },
      include: { template: true },
    }),
  ]);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    settings: settings || {},
    templates,
    campaigns,
  });
}
