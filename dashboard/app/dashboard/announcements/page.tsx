"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { MessageSquare, Send } from "lucide-react";

export default function AnnouncementsPage() {
  const { selectedGuildId } = useGuildStore();
  const [announcement, setAnnouncement] = useState({
    channelId: "",
    title: "",
    description: "",
    color: "#5865F2",
    pingRole: "",
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

  const sendMutation = useMutation({
    mutationFn: () => apiClient.sendAnnouncement(selectedGuildId, announcement),
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement sent!" });
      setAnnouncement({ ...announcement, title: "", description: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send announcement", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">Send announcements to your server</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Create Announcement
            </CardTitle>
            <CardDescription>Compose and send an announcement to a channel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={announcement.channelId}
                  onValueChange={(v) => setAnnouncement({ ...announcement, channelId: v })}
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
                <Label>Ping Role (optional)</Label>
                <Select
                  value={announcement.pingRole}
                  onValueChange={(v) => setAnnouncement({ ...announcement, pingRole: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="everyone">@everyone</SelectItem>
                    <SelectItem value="here">@here</SelectItem>
                    {roles?.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        @{role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Announcement title"
                value={announcement.title}
                onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={6}
                placeholder="Write your announcement..."
                value={announcement.description}
                onChange={(e) => setAnnouncement({ ...announcement, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Embed Color</Label>
              <Input
                type="color"
                value={announcement.color}
                onChange={(e) => setAnnouncement({ ...announcement, color: e.target.value })}
                className="w-24 h-10"
              />
            </div>

            <Button
              className="w-full"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !announcement.channelId || !announcement.description}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendMutation.isPending ? "Sending..." : "Send Announcement"}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="p-4 rounded-lg border-l-4"
              style={{ borderColor: announcement.color, backgroundColor: "rgba(0,0,0,0.1)" }}
            >
              {announcement.title && <h3 className="font-bold mb-2">{announcement.title}</h3>}
              <p className="whitespace-pre-wrap">{announcement.description || "Your announcement will appear here..."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
