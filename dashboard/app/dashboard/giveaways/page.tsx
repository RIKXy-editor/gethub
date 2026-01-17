"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { PartyPopper, Plus, Trophy, Clock, Users } from "lucide-react";

interface Giveaway {
  id: string;
  prize: string;
  channelId: string;
  endTime: number;
  winnerCount: number;
  entries: string[];
  ended: boolean;
  hostId: string;
}

export default function GiveawaysPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGiveaway, setNewGiveaway] = useState({
    prize: "",
    channelId: "",
    duration: "1h",
    winnerCount: 1,
  });

  const { data: giveaways, isLoading } = useQuery({
    queryKey: ["giveaways", selectedGuildId],
    queryFn: () => apiClient.getGiveaways(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: channels } = useQuery({
    queryKey: ["channels", selectedGuildId],
    queryFn: () => apiClient.getChannels(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createGiveaway(selectedGuildId, newGiveaway),
    onSuccess: () => {
      toast({ title: "Success", description: "Giveaway created!" });
      setDialogOpen(false);
      setNewGiveaway({ prize: "", channelId: "", duration: "1h", winnerCount: 1 });
      queryClient.invalidateQueries({ queryKey: ["giveaways", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create giveaway", variant: "destructive" });
    },
  });

  const endMutation = useMutation({
    mutationFn: (giveawayId: string) => apiClient.endGiveaway(selectedGuildId, giveawayId),
    onSuccess: () => {
      toast({ title: "Success", description: "Giveaway ended!" });
      queryClient.invalidateQueries({ queryKey: ["giveaways", selectedGuildId] });
    },
  });

  const rerollMutation = useMutation({
    mutationFn: (giveawayId: string) => apiClient.rerollGiveaway(selectedGuildId, giveawayId),
    onSuccess: () => {
      toast({ title: "Success", description: "Winners rerolled!" });
      queryClient.invalidateQueries({ queryKey: ["giveaways", selectedGuildId] });
    },
  });

  const activeGiveaways = giveaways?.filter((g: Giveaway) => !g.ended) || [];
  const endedGiveaways = giveaways?.filter((g: Giveaway) => g.ended) || [];

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
          <h1 className="text-3xl font-bold">Giveaways</h1>
          <p className="text-muted-foreground">Create and manage server giveaways</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Giveaway
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Giveaway</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Prize</Label>
                <Input
                  placeholder="What's the prize?"
                  value={newGiveaway.prize}
                  onChange={(e) => setNewGiveaway({ ...newGiveaway, prize: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={newGiveaway.channelId}
                  onValueChange={(v) => setNewGiveaway({ ...newGiveaway, channelId: v })}
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
                  <Label>Duration</Label>
                  <Select
                    value={newGiveaway.duration}
                    onValueChange={(v) => setNewGiveaway({ ...newGiveaway, duration: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10m">10 minutes</SelectItem>
                      <SelectItem value="30m">30 minutes</SelectItem>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="6h">6 hours</SelectItem>
                      <SelectItem value="12h">12 hours</SelectItem>
                      <SelectItem value="1d">1 day</SelectItem>
                      <SelectItem value="3d">3 days</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Winners</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newGiveaway.winnerCount}
                    onChange={(e) => setNewGiveaway({ ...newGiveaway, winnerCount: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Giveaway"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5" />
              Active Giveaways ({activeGiveaways.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeGiveaways.length === 0 ? (
              <p className="text-muted-foreground">No active giveaways</p>
            ) : (
              <div className="space-y-4">
                {activeGiveaways.map((giveaway: Giveaway) => (
                  <div key={giveaway.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        {giveaway.prize}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Ends {new Date(giveaway.endTime).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {giveaway.entries?.length || 0} entries
                        </span>
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => endMutation.mutate(giveaway.id)}>
                      End Now
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Ended Giveaways</CardTitle>
          </CardHeader>
          <CardContent>
            {endedGiveaways.length === 0 ? (
              <p className="text-muted-foreground">No ended giveaways</p>
            ) : (
              <div className="space-y-4">
                {endedGiveaways.slice(0, 5).map((giveaway: Giveaway) => (
                  <div key={giveaway.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{giveaway.prize}</h3>
                      <p className="text-sm text-muted-foreground">
                        {giveaway.winnerCount} winner(s) - {giveaway.entries?.length || 0} entries
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => rerollMutation.mutate(giveaway.id)}>
                      Reroll
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
