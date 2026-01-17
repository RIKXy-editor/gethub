"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Bell, Eye } from "lucide-react";

interface WelcomeConfig {
  enabled: boolean;
  channelId: string | null;
  title: string;
  description: string;
  footer: string;
  color: string;
  thumbnailMode: string;
  imageUrl: string | null;
  pingUser: boolean;
  dmWelcome: boolean;
  autoRoleId: string | null;
}

export default function WelcomePage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<WelcomeConfig>({
    enabled: false,
    channelId: null,
    title: "Welcome to {server}!",
    description: "Hey {user}, welcome to **{server}**!\nYou are our **{memberCount}** member.",
    footer: "Member #{memberCount}",
    color: "#9b59b6",
    thumbnailMode: "user",
    imageUrl: null,
    pingUser: true,
    dmWelcome: false,
    autoRoleId: null,
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["welcome", selectedGuildId],
    queryFn: () => apiClient.getWelcomeConfig(selectedGuildId),
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
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateWelcomeConfig(selectedGuildId, config),
    onSuccess: () => {
      toast({ title: "Success", description: "Welcome settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["welcome", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.testWelcome(selectedGuildId),
    onSuccess: () => {
      toast({ title: "Success", description: "Test welcome message sent!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send test message", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome Messages</h1>
          <p className="text-muted-foreground">Customize how new members are greeted</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
            <Eye className="h-4 w-4 mr-2" />
            Test
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Welcome Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ping User</Label>
              <Switch
                checked={config.pingUser}
                onCheckedChange={(checked) => setConfig({ ...config, pingUser: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>DM Welcome</Label>
              <Switch
                checked={config.dmWelcome}
                onCheckedChange={(checked) => setConfig({ ...config, dmWelcome: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel & Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Welcome Channel</Label>
              <Select
                value={config.channelId || ""}
                onValueChange={(v) => setConfig({ ...config, channelId: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels?.filter((c: any) => c.type === 0).map((channel: any) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Auto Role</Label>
              <Select
                value={config.autoRoleId || ""}
                onValueChange={(v) => setConfig({ ...config, autoRoleId: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {roles?.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Message Content</CardTitle>
            <CardDescription>
              Placeholders: {"{user}"} {"{username}"} {"{server}"} {"{memberCount}"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Footer</Label>
                <Input
                  value={config.footer}
                  onChange={(e) => setConfig({ ...config, footer: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={config.color}
                  onChange={(e) => setConfig({ ...config, color: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <Select
                  value={config.thumbnailMode}
                  onValueChange={(v) => setConfig({ ...config, thumbnailMode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User Avatar</SelectItem>
                    <SelectItem value="server">Server Icon</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Banner URL</Label>
                <Input
                  placeholder="https://..."
                  value={config.imageUrl || ""}
                  onChange={(e) => setConfig({ ...config, imageUrl: e.target.value || null })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
