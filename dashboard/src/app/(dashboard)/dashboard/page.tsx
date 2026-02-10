"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Users, Megaphone, CalendarDays } from "lucide-react";
import { timeAgo, getActivityDisplay } from "@/lib/utils";

interface DashboardStats {
  sentToday: number;
  sentThisWeek: number;
  totalContacts: number;
  activeCampaigns: number;
  dailyLimit: number;
  recentActivity: Array<{
    id: string;
    type: string;
    data: Record<string, unknown> | null;
    createdAt: string;
    campaign: { name: string } | null;
  }>;
  extensionLastSeen: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e) => console.error("Dashboard stats error:", e));
  }, []);

  if (!stats) {
    return <div className="text-muted-foreground">Loading dashboard...</div>;
  }

  const dailyProgress = Math.min(
    (stats.sentToday / stats.dailyLimit) * 100,
    100
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              stats.extensionLastSeen &&
              Date.now() - new Date(stats.extensionLastSeen).getTime() <
                600000
                ? "border-green-300 bg-green-50 text-green-700"
                : "border-gray-300 bg-gray-50 text-gray-600"
            }
          >
            Extension: {timeAgo(stats.extensionLastSeen)}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <Send className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.sentToday}</p>
            <p className="text-muted-foreground text-xs">
              of {stats.dailyLimit} daily limit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <CalendarDays className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.sentThisWeek}</p>
            <p className="text-muted-foreground text-xs">connections sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Contacts
            </CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalContacts}</p>
            <p className="text-muted-foreground text-xs">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
            <Megaphone className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
            <p className="text-muted-foreground text-xs">running now</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Daily Limit Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 w-full rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-blue-500 transition-all"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {stats.sentToday} / {stats.dailyLimit} (
            {Math.round(dailyProgress)}%)
          </p>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {entry.type}
                    </Badge>
                    {entry.campaign && (
                      <span className="text-muted-foreground text-xs">
                        {entry.campaign.name}
                      </span>
                    )}
                    {entry.data && (
                      <span className="text-muted-foreground text-xs">
                        {getActivityDisplay(entry.data)}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
