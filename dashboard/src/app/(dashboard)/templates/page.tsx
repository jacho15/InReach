"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  body: string;
  sentCount: number;
  acceptedCount: number;
  createdAt: string;
}

const PLACEHOLDERS = ["{{firstName}}", "{{name}}", "{{job}}", "{{company}}"];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to load templates");
      setTemplates(await res.json());
    } catch (e) {
      console.error("Templates error:", e);
    }
  }

  function openEdit(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setBody(template.body);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setBody("");
    setDialogOpen(true);
  }

  async function save() {
    if (!name.trim() || !body.trim()) return;

    if (editingId) {
      const res = await fetch(`/api/templates/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      if (res.ok) toast.success("Template updated");
    } else {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      if (res.ok) toast.success("Template created");
    }

    setDialogOpen(false);
    loadTemplates();
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    toast.success("Template deleted");
    loadTemplates();
  }

  function insertPlaceholder(placeholder: string) {
    setBody((prev) => prev + placeholder);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Template" : "Create Template"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="templateName">Name</Label>
                <Input
                  id="templateName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label htmlFor="templateBody">
                  Message Body ({body.length}/300)
                </Label>
                <Textarea
                  id="templateBody"
                  value={body}
                  onChange={(e) => {
                    if (e.target.value.length <= 300) setBody(e.target.value);
                  }}
                  placeholder="Hi {{firstName}}, I'd love to connect..."
                  rows={5}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => insertPlaceholder(p)}
                      className="text-xs"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={save} disabled={!name.trim() || !body.trim()}>
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No templates yet. Create your first template to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t.sentCount} sent
                    </Badge>
                    <Badge variant="outline">
                      {t.acceptedCount} accepted
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {t.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
