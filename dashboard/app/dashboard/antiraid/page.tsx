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
import { ShieldAlert, Plus, X } from "lucide-react";

interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: { joins: number; seconds: number };
  accountAge: number;
  action: string;
  logChannelId: string | null;
  whitelistedRoles: string[];
  raidMode: boolean;
}

export default function AntiRaidPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<AntiRaidConfig>({
    enabled: false,
    joinThreshold: { joins: 10, seconds: 30 },
    accountAge: 7,
    action: "timeout",
    logChannelId: null,
    whitelistedRoles: [],
    raidMode: false,
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["antiraid", selectedGuildId],
    queryFn: () => apiClient.getAntiRaidConfig(selectedGuildId),
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
    mutationFn: () => apiClient.updateAntiRaidConfig(selectedGuildId, config),
    onSuccess: () => {
      toast({ title: "Success", description: "Anti-raid settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["antiraid", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const addWhitelistRole = (roleId: string) => {
    if (!config.whitelistedRoles.includes(roleId)) {
      setConfig({ ...config, whitelistedRoles: [...config.whitelistedRoles, roleId] });
    }
  };

  const removeWhitelistRole = (roleId: string) => {
    setConfig({ ...config, whitelistedRoles: config.whitelistedRoles.filter((r) => r !== roleId) });
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
          <h1 className="text-3xl font-bold">Anti-Raid Protection</h1>
          <p className="text-muted-foreground">Protect your server from mass join raids</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Protection Status
            </CardTitle>
            <CardDescription>Enable or disable anti-raid protection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Anti-Raid Enabled</Label>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Emergency Raid Mode</Label>
              <Switch
                checked={config.raidMode}
                onCheckedChange={(checked) => setConfig({ ...config, raidMode: checked })}
              />
            </div>
            {config.raidMode && (
              <p className="text-sm text-destructive">
                Raid mode is ACTIVE - Server is locked down!
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join Threshold</CardTitle>
            <CardDescription>Trigger protection when too many users join quickly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Joins</Label>
                <Input
                  type="number"
                  min={3}
                  max={50}
                  value={config.joinThreshold.joins}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      joinThreshold: { ...config.joinThreshold, joins: parseInt(e.target.value) || 10 },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Within Seconds</Label>
                <Input
                  type="number"
                  min={5}
                  max={120}
                  value={config.joinThreshold.seconds}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      joinThreshold: { ...config.joinThreshold, seconds: parseInt(e.target.value) || 30 },
                    })
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Raid detected if {config.joinThreshold.joins} users join within {config.joinThreshold.seconds} seconds
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Age Filter</CardTitle>
            <CardDescription>Flag accounts younger than this</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Account Age (days)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={config.accountAge}
                onChange={(e) => setConfig({ ...config, accountAge: parseInt(e.target.value) || 0 })}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {config.accountAge === 0 ? "Account age check disabled" : `Accounts younger than ${config.accountAge} days will be flagged`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raid Action</CardTitle>
            <CardDescription>What to do when a raid is detected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={config.action} onValueChange={(v) => setConfig({ ...config, action: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeout">Timeout (1 hour)</SelectItem>
                <SelectItem value="kick">Kick</SelectItem>
                <SelectItem value="ban">Ban</SelectItem>
                <SelectItem value="lockdown">Lockdown Server</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log Channel</CardTitle>
            <CardDescription>Where to send raid alerts</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Whitelisted Roles</CardTitle>
            <CardDescription>Roles that bypass anti-raid checks</CardDescription>
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
              <SelectTrigger>
                <SelectValue placeholder="Add a role" />
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
