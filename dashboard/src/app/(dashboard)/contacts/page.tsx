"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Search } from "lucide-react";

interface Contact {
  id: string;
  name: string | null;
  company: string | null;
  headline: string | null;
  profileUrl: string;
  status: string;
  sentAt: string | null;
  campaign: { name: string } | null;
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
  page: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  skipped: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
};

export default function ContactsPage() {
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const loadContacts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/contacts?${params}`);
    setData(await res.json());
  }, [page, search, status]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  function exportCSV() {
    if (!data?.contacts.length) return;
    const headers = ["Name", "Company", "Headline", "Profile URL", "Status", "Campaign", "Sent At"];
    const rows = data.contacts.map((c) => [
      c.name || "",
      c.company || "",
      c.headline || "",
      c.profileUrl,
      c.status,
      c.campaign?.name || "",
      c.sentAt || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or company..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {data?.total || 0} contacts total
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.contacts.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No contacts found
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Headline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.name || "Unknown"}
                      </TableCell>
                      <TableCell>{c.company || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {c.headline || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[c.status] || ""}
                          variant="secondary"
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{c.campaign?.name || "—"}</TableCell>
                      <TableCell>
                        {c.sentAt
                          ? new Date(c.sentAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
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
