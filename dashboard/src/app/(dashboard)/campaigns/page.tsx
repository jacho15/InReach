"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  searchUrl: string;
  status: string;
  currentPage: number;
  createdAt: string;
  template: { name: string } | null;
  _count: { contacts: number };
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-800",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then(setCampaigns);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No campaigns yet. Create your first campaign to start reaching
              out.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge
                      className={statusColors[c.status] || ""}
                      variant="secondary"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex items-center gap-4 text-sm">
                    <span>{c._count.contacts} contacts</span>
                    <span>Page {c.currentPage}</span>
                    {c.template && <span>Template: {c.template.name}</span>}
                    <span>
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
