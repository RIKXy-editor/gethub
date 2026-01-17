"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Briefcase } from "lucide-react";

interface JobConfig {
  enabled: boolean;
  channelId: string | null;
  requiredRoleId: string | null;
  cooldownHours: number;
  bannerText: string;
}

export default function JobsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<JobConfig>({
    enabled: false,
    channelId: null,
    requiredRoleId: null,
    cooldownHours: 24,
    bannerText: "",
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["jobs", selectedGuildId],
    queryFn: () => apiClient.getJobConfig(selectedGuildId),
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
    mutationFn: () => apiClient.updateJobConfig(selectedGuildId, config),
    onSuccess: () => {
      toast({ title: "Success", description: "Job posting settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["jobs", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
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
          <h1 className="text-3xl font-bold">Job Posting</h1>
          <p className="text-muted-foreground">Configure the job posting system</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Job System Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Job Posting Enabled</Label>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
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
              <Label>Job Posting Channel</Label>
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
              <Label>Required Role to Post</Label>
              <Select
                value={config.requiredRoleId || ""}
                onValueChange={(v) => setConfig({ ...config, requiredRoleId: v || null })}
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

        <Card>
          <CardHeader>
            <CardTitle>Cooldown</CardTitle>
            <CardDescription>Time between job posts per user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Cooldown (hours)</Label>
              <Input
                type="number"
                min={0}
                max={168}
                value={config.cooldownHours}
                onChange={(e) => setConfig({ ...config, cooldownHours: parseInt(e.target.value) || 0 })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banner Text</CardTitle>
            <CardDescription>Custom text shown in job posting banner</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Enter banner text..."
              value={config.bannerText}
              onChange={(e) => setConfig({ ...config, bannerText: e.target.value })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
