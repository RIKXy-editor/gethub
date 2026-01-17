"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Pin, Trash2, Plus } from "lucide-react";

interface StickyMessage {
  channelId: string;
  content: string;
  messageId?: string;
}

export default function StickyPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();
  const [newSticky, setNewSticky] = useState({ channelId: "", content: "" });

  const { data: stickies, isLoading } = useQuery({
    queryKey: ["sticky", selectedGuildId],
    queryFn: () => apiClient.getStickyMessages(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: channels } = useQuery({
    queryKey: ["channels", selectedGuildId],
    queryFn: () => apiClient.getChannels(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createStickyMessage(selectedGuildId, newSticky),
    onSuccess: () => {
      toast({ title: "Success", description: "Sticky message created!" });
      setNewSticky({ channelId: "", content: "" });
      queryClient.invalidateQueries({ queryKey: ["sticky", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create sticky message", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (channelId: string) => apiClient.deleteStickyMessage(selectedGuildId, channelId),
    onSuccess: () => {
      toast({ title: "Success", description: "Sticky message removed!" });
      queryClient.invalidateQueries({ queryKey: ["sticky", selectedGuildId] });
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
      <div>
        <h1 className="text-3xl font-bold">Sticky Messages</h1>
        <p className="text-muted-foreground">Messages that stay at the bottom of channels</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Sticky Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={newSticky.channelId}
                onValueChange={(v) => setNewSticky({ ...newSticky, channelId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
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
              <Label>Message</Label>
              <Textarea
                rows={4}
                placeholder="Sticky message content..."
                value={newSticky.content}
                onChange={(e) => setNewSticky({ ...newSticky, content: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newSticky.channelId || !newSticky.content}
            >
              {createMutation.isPending ? "Creating..." : "Create Sticky"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pin className="h-5 w-5" />
              Active Sticky Messages ({stickies?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stickies?.length ? (
              <p className="text-muted-foreground">No sticky messages</p>
            ) : (
              <div className="space-y-4">
                {stickies.map((sticky: StickyMessage) => {
                  const channel = channels?.find((c: any) => c.id === sticky.channelId);
                  return (
                    <div key={sticky.channelId} className="flex items-start justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">#{channel?.name || sticky.channelId}</p>
                        <p className="text-sm text-muted-foreground mt-1 truncate max-w-xs">{sticky.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(sticky.channelId)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
