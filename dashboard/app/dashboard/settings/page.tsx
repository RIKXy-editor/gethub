"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Save, Settings, FolderOpen, Hash, Users, Clock, Shield } from "lucide-react";

export default function SettingsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState({
    ticketCategoryId: "",
    logsChannelId: "",
    supportRoleId: "",
    cooldownSeconds: 0,
    maxTicketsPerUser: 1,
    enabled: true,
    transcriptDM: true,
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiClient.getConfig(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: channels } = useQuery({
    queryKey: ["channels", selectedGuildId],
    queryFn: () => apiClient.getChannels(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", selectedGuildId],
    queryFn: () => apiClient.getRoles(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (config) {
      setSettings({
        ticketCategoryId: config.ticketCategoryId || "",
        logsChannelId: config.logsChannelId || "",
        supportRoleId: config.supportRoleId || "",
        cooldownSeconds: config.cooldownSeconds || 0,
        maxTicketsPerUser: config.maxTicketsPerUser || 1,
        enabled: config.enabled !== false,
        transcriptDM: config.transcriptDM !== false,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateConfig(selectedGuildId, settings),
    onSuccess: () => {
      toast({ title: "Success", description: "Settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["config", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const categoryChannels = channels?.filter((c) => c.type === 4) || [];
  const textChannels = channels?.filter((c) => c.type === 0 || c.type === 5) || [];

  if (!selectedGuildId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a server</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ticket Settings</h2>
          <p className="text-muted-foreground">Configure global ticket behavior</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Basic ticket system configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Ticket System</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle the entire ticket system on/off
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Ticket Category
              </Label>
              <Select
                value={settings.ticketCategoryId}
                onValueChange={(value) => setSettings({ ...settings, ticketCategoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category channel" />
                </SelectTrigger>
                <SelectContent>
                  {categoryChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      📁 {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                New tickets will be created under this category
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Logs Channel
              </Label>
              <Select
                value={settings.logsChannelId}
                onValueChange={(value) => setSettings({ ...settings, logsChannelId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select logs channel" />
                </SelectTrigger>
                <SelectContent>
                  {textChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      # {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Support Role
              </Label>
              <Select
                value={settings.supportRoleId}
                onValueChange={(value) => setSettings({ ...settings, supportRoleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select support role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      @ {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Limits & Restrictions
            </CardTitle>
            <CardDescription>Control ticket creation behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Cooldown (seconds)
              </Label>
              <Input
                type="number"
                value={settings.cooldownSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, cooldownSeconds: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                Time between ticket creations (0 to disable)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Max Tickets per User</Label>
              <Input
                type="number"
                value={settings.maxTicketsPerUser}
                onChange={(e) =>
                  setSettings({ ...settings, maxTicketsPerUser: parseInt(e.target.value) || 1 })
                }
                placeholder="1"
              />
              <p className="text-sm text-muted-foreground">
                Maximum open tickets a user can have
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>DM Transcripts</Label>
                <p className="text-sm text-muted-foreground">
                  Send transcript to ticket opener via DM
                </p>
              </div>
              <Switch
                checked={settings.transcriptDM}
                onCheckedChange={(checked) => setSettings({ ...settings, transcriptDM: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
