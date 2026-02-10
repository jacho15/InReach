"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS, getActivityDisplay } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  campaign: { name: string } | null;
}

interface ActivityResponse {
  logs: ActivityEntry[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const loadActivity = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (type) params.set("type", type);
    try {
      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed to load activity");
      setData(await res.json());
    } catch (e) {
      console.error("Activity error:", e);
    }
  }, [page, type]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Log</h1>
      </div>

      <div className="flex gap-3">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="page_complete">Page Complete</SelectItem>
            <SelectItem value="campaign_started">Campaign Started</SelectItem>
            <SelectItem value="campaign_stopped">Campaign Stopped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {data?.total || 0} entries total
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.logs.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No activity entries found
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {data.logs.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        className={STATUS_COLORS[entry.type] || ""}
                        variant="secondary"
                      >
                        {entry.type}
                      </Badge>
                      <div>
                        {entry.campaign && (
                          <span className="text-sm font-medium">
                            {entry.campaign.name}
                          </span>
                        )}
                        {entry.data && (
                          <p className="text-muted-foreground text-xs">
                            {getActivityDisplay(entry.data)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    Page {data.page} of {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
