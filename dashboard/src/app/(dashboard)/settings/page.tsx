"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Plus, Trash2 } from "lucide-react";

interface Settings {
  dailyLimit: number;
  weeklyLimit: number;
  cooldownMin: number;
  cooldownMax: number;
  businessHoursOnly: boolean;
  businessHoursStart: number;
  businessHoursEnd: number;
  warmupEnabled: boolean;
  dryRun: boolean;
  timezone: string;
}

interface ApiKeyEntry {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsed: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
    fetch("/api/keys")
      .then((r) => r.json())
      .then(setKeys);
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const data = await res.json();
    if (res.ok) {
      setGeneratedKey(data.key);
      setNewKeyName("");
      // Refresh key list
      const keysRes = await fetch("/api/keys");
      setKeys(await keysRes.json());
    }
  }

  async function deleteKey(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    setKeys(keys.filter((k) => k.id !== id));
    toast.success("API key revoked");
  }

  if (!settings) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Settings Form */}
      <Card>
        <CardHeader>
          <CardTitle>Outreach Settings</CardTitle>
          <CardDescription>
            Configure limits and behavior for your LinkedIn automation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dailyLimit">Daily Limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                value={settings.dailyLimit}
                onChange={(e) =>
                  setSettings({ ...settings, dailyLimit: +e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="weeklyLimit">Weekly Limit</Label>
              <Input
                id="weeklyLimit"
                type="number"
                value={settings.weeklyLimit}
                onChange={(e) =>
                  setSettings({ ...settings, weeklyLimit: +e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cooldownMin">Cooldown Min (ms)</Label>
              <Input
                id="cooldownMin"
                type="number"
                value={settings.cooldownMin}
                onChange={(e) =>
                  setSettings({ ...settings, cooldownMin: +e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="cooldownMax">Cooldown Max (ms)</Label>
              <Input
                id="cooldownMax"
                type="number"
                value={settings.cooldownMax}
                onChange={(e) =>
                  setSettings({ ...settings, cooldownMax: +e.target.value })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Business Hours Only</Label>
              <p className="text-muted-foreground text-sm">
                Only send during business hours
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.businessHoursOnly}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  businessHoursOnly: e.target.checked,
                })
              }
              className="h-4 w-4"
            />
          </div>

          {settings.businessHoursOnly && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessStart">Start Hour</Label>
                <Input
                  id="businessStart"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.businessHoursStart}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHoursStart: +e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="businessEnd">End Hour</Label>
                <Input
                  id="businessEnd"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.businessHoursEnd}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      businessHoursEnd: +e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Warmup Mode</Label>
              <p className="text-muted-foreground text-sm">
                Gradually increase sending limits
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.warmupEnabled}
              onChange={(e) =>
                setSettings({ ...settings, warmupEnabled: e.target.checked })
              }
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Dry Run</Label>
              <p className="text-muted-foreground text-sm">
                Simulate actions without sending requests
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.dryRun}
              onChange={(e) =>
                setSettings({ ...settings, dryRun: e.target.checked })
              }
              className="h-4 w-4"
            />
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* API Key Manager */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Generate API keys to connect the Chrome extension to this dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedKey && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-sm font-medium text-green-800">
                Copy this key now — it won&apos;t be shown again
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-2 py-1 text-xs">
                  {generatedKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> New API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., My Laptop Extension"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    createKey();
                    setDialogOpen(false);
                  }}
                  disabled={!newKeyName.trim()}
                >
                  Generate Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No API keys yet. Create one to connect the extension.
            </p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{key.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {key.keyPrefix}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {key.lastUsed
                        ? `Last used ${new Date(key.lastUsed).toLocaleDateString()}`
                        : "Never used"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
