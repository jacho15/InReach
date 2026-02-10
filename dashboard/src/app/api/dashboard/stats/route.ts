import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireUser();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      todayStats,
      weekStats,
      totalContacts,
      activeCampaigns,
      recentActivity,
      latestApiKey,
    ] = await Promise.all([
      prisma.dailyStat.aggregate({
        where: { userId: user.id, date: today },
        _sum: { sent: true, skipped: true, errors: true },
      }),
      prisma.dailyStat.aggregate({
        where: { userId: user.id, date: { gte: weekAgo } },
        _sum: { sent: true, skipped: true, errors: true },
      }),
      prisma.contact.count({ where: { userId: user.id } }),
      prisma.campaign.count({
        where: { userId: user.id, status: "active" },
      }),
      prisma.activityLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { campaign: { select: { name: true } } },
      }),
      prisma.apiKey.findFirst({
        where: { userId: user.id, lastUsed: { not: null } },
        orderBy: { lastUsed: "desc" },
        select: { lastUsed: true },
      }),
    ]);

    // Get user settings for daily limit
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      sentToday: todayStats._sum.sent || 0,
      sentThisWeek: weekStats._sum.sent || 0,
      totalContacts,
      activeCampaigns,
      dailyLimit: settings?.dailyLimit || 25,
      recentActivity,
      extensionLastSeen: latestApiKey?.lastUsed || null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
