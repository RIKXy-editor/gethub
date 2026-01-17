"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Bot, Image, Type } from "lucide-react";

interface BotConfig {
  status: {
    type: string;
    text: string;
  };
  avatarUrl: string | null;
  bannerUrl: string | null;
  description: string;
}

export default function BotSettingsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<BotConfig>({
    status: { type: "playing", text: "" },
    avatarUrl: null,
    bannerUrl: null,
    description: "",
  });

  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["botconfig", selectedGuildId],
    queryFn: () => apiClient.getBotConfig(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateBotConfig(selectedGuildId, config),
    onSuccess: () => {
      toast({ title: "Success", description: "Bot settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["botconfig", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: (url: string) => apiClient.updateBotAvatar(selectedGuildId, url),
    onSuccess: () => {
      toast({ title: "Success", description: "Bot avatar updated!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update avatar", variant: "destructive" });
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
          <h1 className="text-3xl font-bold">Bot Settings</h1>
          <p className="text-muted-foreground">Configure your bot's appearance and status</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Bot Status
            </CardTitle>
            <CardDescription>Set the bot's presence status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status Type</Label>
              <Select
                value={config.status.type}
                onValueChange={(v) => setConfig({ ...config, status: { ...config.status, type: v } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playing">Playing</SelectItem>
                  <SelectItem value="watching">Watching</SelectItem>
                  <SelectItem value="listening">Listening to</SelectItem>
                  <SelectItem value="competing">Competing in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Text</Label>
              <Input
                placeholder="What is the bot doing?"
                value={config.status.text}
                onChange={(e) => setConfig({ ...config, status: { ...config.status, text: e.target.value } })}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Preview: {config.status.type.charAt(0).toUpperCase() + config.status.type.slice(1)} {config.status.text || "..."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Bot Avatar
            </CardTitle>
            <CardDescription>Change the bot's profile picture</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input
                placeholder="https://..."
                value={config.avatarUrl || ""}
                onChange={(e) => setConfig({ ...config, avatarUrl: e.target.value || null })}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => config.avatarUrl && updateAvatarMutation.mutate(config.avatarUrl)}
              disabled={!config.avatarUrl || updateAvatarMutation.isPending}
            >
              {updateAvatarMutation.isPending ? "Updating..." : "Update Avatar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Bot Banner
            </CardTitle>
            <CardDescription>Set the bot's profile banner (requires Nitro)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input
                placeholder="https://..."
                value={config.bannerUrl || ""}
                onChange={(e) => setConfig({ ...config, bannerUrl: e.target.value || null })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              About Me
            </CardTitle>
            <CardDescription>Set the bot's "About Me" description</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              placeholder="Bot description..."
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
