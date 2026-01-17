"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Clock, Plus, Trash2 } from "lucide-react";

interface ScheduledMessage {
  id: string;
  channelId: string;
  message: string;
  time: string;
  frequency: string;
  lastRun: number;
}

export default function ScheduledPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    channelId: "",
    message: "",
    time: "12:00",
    frequency: "daily",
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ["scheduled", selectedGuildId],
    queryFn: () => apiClient.getScheduledMessages(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: channels } = useQuery({
    queryKey: ["channels", selectedGuildId],
    queryFn: () => apiClient.getChannels(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createScheduledMessage(selectedGuildId, newMessage),
    onSuccess: () => {
      toast({ title: "Success", description: "Scheduled message created!" });
      setDialogOpen(false);
      setNewMessage({ channelId: "", message: "", time: "12:00", frequency: "daily" });
      queryClient.invalidateQueries({ queryKey: ["scheduled", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create scheduled message", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteScheduledMessage(selectedGuildId, id),
    onSuccess: () => {
      toast({ title: "Success", description: "Scheduled message deleted!" });
      queryClient.invalidateQueries({ queryKey: ["scheduled", selectedGuildId] });
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
          <h1 className="text-3xl font-bold">Scheduled Messages</h1>
          <p className="text-muted-foreground">Automatically send messages at specific times</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={newMessage.channelId}
                  onValueChange={(v) => setNewMessage({ ...newMessage, channelId: v })}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time (24h format)</Label>
                  <Input
                    type="time"
                    value={newMessage.time}
                    onChange={(e) => setNewMessage({ ...newMessage, time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={newMessage.frequency}
                    onValueChange={(v) => setNewMessage({ ...newMessage, frequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  placeholder="Message content..."
                  value={newMessage.message}
                  onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Messages ({messages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!messages?.length ? (
            <p className="text-muted-foreground">No scheduled messages</p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg: ScheduledMessage) => {
                const channel = channels?.find((c: any) => c.id === msg.channelId);
                return (
                  <div key={msg.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">#{channel?.name || msg.channelId}</p>
                      <p className="text-sm text-muted-foreground">
                        {msg.time} - {msg.frequency}
                      </p>
                      <p className="text-sm mt-1 truncate max-w-md">{msg.message}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(msg.id)}>
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
  );
}
