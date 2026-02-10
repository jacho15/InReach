"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pause, Play, Square } from "lucide-react";

interface CampaignDetail {
  id: string;
  name: string;
  searchUrl: string;
  status: string;
  currentPage: number;
  createdAt: string;
  template: { id: string; name: string; body: string } | null;
  contacts: Array<{
    id: string;
    name: string | null;
    company: string | null;
    headline: string | null;
    status: string;
    sentAt: string | null;
  }>;
  dailyStats: Array<{
    date: string;
    sent: number;
    skipped: number;
    errors: number;
  }>;
  activityLogs: Array<{
    id: string;
    type: string;
    data: Record<string, unknown> | null;
    createdAt: string;
  }>;
  _count: { contacts: number };
}

const statusActions: Record<string, { label: string; next: string; icon: React.ElementType }> = {
  active: { label: "Pause", next: "paused", icon: Pause },
  paused: { label: "Resume", next: "active", icon: Play },
  completed: { label: "Archive", next: "archived", icon: Square },
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/campaigns/${params.id}`)
        .then((r) => r.json())
        .then(setCampaign);
    }
  }, [params.id]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/campaigns/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCampaign((prev) => (prev ? { ...prev, ...updated } : null));
      toast.success(`Campaign ${status}`);
    }
  }

  async function archiveCampaign() {
    await fetch(`/api/campaigns/${params.id}`, { method: "DELETE" });
    toast.success("Campaign archived");
    router.push("/campaigns");
  }

  if (!campaign) {
    return <div className="text-muted-foreground">Loading campaign...</div>;
  }

  const action = statusActions[campaign.status];
  const totalSent = campaign.dailyStats.reduce((sum, d) => sum + d.sent, 0);
  const totalSkipped = campaign.dailyStats.reduce(
    (sum, d) => sum + d.skipped,
    0
  );
  const totalErrors = campaign.dailyStats.reduce(
    (sum, d) => sum + d.errors,
    0
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-muted-foreground text-sm">{campaign.searchUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={
              campaign.status === "active"
                ? "bg-green-100 text-green-800"
                : ""
            }
          >
            {campaign.status}
          </Badge>
          {action && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(action.next)}
            >
              <action.icon className="mr-1 h-4 w-4" />
              {action.label}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={archiveCampaign}>
            Archive
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Contacts</p>
            <p className="text-2xl font-bold">{campaign._count.contacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Sent</p>
            <p className="text-2xl font-bold">{totalSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Skipped</p>
            <p className="text-2xl font-bold">{totalSkipped}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Errors</p>
            <p className="text-2xl font-bold">{totalErrors}</p>
          </CardContent>
        </Card>
      </div>

      {campaign.template && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Template: {campaign.template.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {campaign.template.body}
            </p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.contacts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No contacts yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.name || "Unknown"}
                    </TableCell>
                    <TableCell>{contact.company || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{contact.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {contact.sentAt
                        ? new Date(contact.sentAt).toLocaleString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.activityLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {campaign.activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{log.type}</Badge>
                    <span className="text-muted-foreground">
                      {log.data
                        ? JSON.stringify(log.data).substring(0, 80)
                        : ""}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.createdAt).toLocaleString()}
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
