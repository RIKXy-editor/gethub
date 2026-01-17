"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Lock, X } from "lucide-react";

interface SecurityConfig {
  enabled: boolean;
  logChannelId: string | null;
  thresholds: {
    channelDeletes: number;
    roleDeletes: number;
    bans: number;
    timeframe: number;
  };
  action: string;
  whitelistedUsers: string[];
  whitelistedRoles: string[];
}

export default function SecurityPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<SecurityConfig>({
    enabled: false,
    logChannelId: null,
    thresholds: { channelDeletes: 3, roleDeletes: 3, bans: 5, timeframe: 60 },
    action: "remove_perms",
    whitelistedUsers: [],
    whitelistedRoles: [],
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["security", selectedGuildId],
    queryFn: () => apiClient.getSecurityConfig(selectedGuildId),
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
    mutationFn: () => apiClient.updateSecurityConfig(selectedGuildId, config),
    onSuccess: () => {
      toast({ title: "Success", description: "Security settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["security", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const removeWhitelistRole = (roleId: string) => {
    setConfig({ ...config, whitelistedRoles: config.whitelistedRoles.filter((r) => r !== roleId) });
  };

  const addWhitelistRole = (roleId: string) => {
    if (!config.whitelistedRoles.includes(roleId)) {
      setConfig({ ...config, whitelistedRoles: [...config.whitelistedRoles, roleId] });
    }
  };

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
          <h1 className="text-3xl font-bold">Anti-Nuke Security</h1>
          <p className="text-muted-foreground">Protect your server from destructive actions</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Protection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Anti-Nuke Enabled</Label>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detection Thresholds</CardTitle>
            <CardDescription>Actions that trigger protection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel Deletes</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={config.thresholds.channelDeletes}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      thresholds: { ...config.thresholds, channelDeletes: parseInt(e.target.value) || 3 },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Role Deletes</Label>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  value={config.thresholds.roleDeletes}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      thresholds: { ...config.thresholds, roleDeletes: parseInt(e.target.value) || 3 },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Mass Bans</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={config.thresholds.bans}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      thresholds: { ...config.thresholds, bans: parseInt(e.target.value) || 5 },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Timeframe (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={config.thresholds.timeframe}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      thresholds: { ...config.thresholds, timeframe: parseInt(e.target.value) || 60 },
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nuke Action</CardTitle>
            <CardDescription>What to do when nuke is detected</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={config.action} onValueChange={(v) => setConfig({ ...config, action: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remove_perms">Remove Permissions</SelectItem>
                <SelectItem value="kick">Kick Offender</SelectItem>
                <SelectItem value="ban">Ban Offender</SelectItem>
                <SelectItem value="lockdown">Lockdown + Remove Perms</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log Channel</CardTitle>
            <CardDescription>Where to send security alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={config.logChannelId || ""}
              onValueChange={(v) => setConfig({ ...config, logChannelId: v || null })}
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
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Whitelisted Roles</CardTitle>
            <CardDescription>Trusted roles that bypass security checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {config.whitelistedRoles.map((roleId) => {
                const role = roles?.find((r: any) => r.id === roleId);
                return (
                  <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                    {role?.name || roleId}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeWhitelistRole(roleId)} />
                  </Badge>
                );
              })}
            </div>
            <Select onValueChange={addWhitelistRole}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Add a trusted role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.filter((r: any) => !config.whitelistedRoles.includes(r.id)).map((role: any) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
