"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Save, Star, Trophy, Clock, MessageSquare } from "lucide-react";

export default function RatingsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [ratingEnabled, setRatingEnabled] = useState(true);
  const [ratingMessage, setRatingMessage] = useState(
    "Thank you for using our support! Please rate your experience:"
  );

  const { data: config } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiClient.getConfig(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", selectedGuildId],
    queryFn: () => apiClient.getStats(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (config) {
      setRatingEnabled(config.ratingEnabled !== false);
      setRatingMessage(config.ratingMessage || "Thank you for using our support! Please rate your experience:");
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateConfig(selectedGuildId, { ratingEnabled, ratingMessage }),
    onSuccess: () => {
      toast({ title: "Success", description: "Rating settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["config", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

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
          <h2 className="text-3xl font-bold tracking-tight">Ratings System</h2>
          <p className="text-muted-foreground">Configure ticket rating and view staff performance</p>
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
              <Star className="h-5 w-5" />
              Rating Configuration
            </CardTitle>
            <CardDescription>Customize the rating system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Rating System</Label>
                <p className="text-sm text-muted-foreground">
                  Ask users to rate their experience after ticket closure
                </p>
              </div>
              <Switch checked={ratingEnabled} onCheckedChange={setRatingEnabled} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Rating Message
              </Label>
              <Textarea
                value={ratingMessage}
                onChange={(e) => setRatingMessage(e.target.value)}
                placeholder="Thank you for using our support! Please rate your experience:"
                rows={3}
                disabled={!ratingEnabled}
              />
            </div>

            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="bg-card border rounded p-3">
                <p className="text-sm mb-2">{ratingMessage}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= 4 ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Staff Leaderboard
            </CardTitle>
            <CardDescription>Top performing staff members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(stats?.staffLeaderboard || []).map((staff, index) => (
                <div
                  key={staff.userId}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${
                      index === 0
                        ? "bg-yellow-500"
                        : index === 1
                        ? "bg-gray-400"
                        : index === 2
                        ? "bg-amber-600"
                        : "bg-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{staff.username}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{staff.claimed} tickets</span>
                      {staff.avgResponseTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(staff.avgResponseTime / 60)}m avg
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {staff.avgRating?.toFixed(1) || "N/A"}
                    </span>
                  </div>
                </div>
              ))}

              {(!stats?.staffLeaderboard || stats.staffLeaderboard.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No staff ratings yet</p>
                  <p className="text-sm">Ratings will appear here after tickets are closed and rated</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
