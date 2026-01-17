"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Users, Star, Clock, Shield, ShieldOff } from "lucide-react";

export default function StaffPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff", selectedGuildId],
    queryFn: () => apiClient.getStaff(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const toggleBlacklistMutation = useMutation({
    mutationFn: ({ staffId, blacklisted }: { staffId: string; blacklisted: boolean }) =>
      apiClient.updateStaff(selectedGuildId, staffId, { blacklisted }),
    onSuccess: () => {
      toast({ title: "Success", description: "Staff status updated!" });
      queryClient.invalidateQueries({ queryKey: ["staff", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff", variant: "destructive" });
    },
  });

  if (!selectedGuildId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a server</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Staff Management</h2>
        <p className="text-muted-foreground">View and manage support staff members</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(staff || []).map((member) => (
          <Card key={member.id} className={member.blacklisted ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt=""
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{member.username}</CardTitle>
                  {member.blacklisted && (
                    <Badge variant="destructive" className="mt-1">Blacklisted</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Tickets Claimed</p>
                  <p className="text-2xl font-bold">{member.ticketsClaimed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Avg Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-2xl font-bold">
                      {member.avgRating?.toFixed(1) || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {member.avgResponseTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Avg response: {Math.round(member.avgResponseTime / 60)} minutes</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {member.blacklisted ? (
                    <ShieldOff className="h-4 w-4 text-destructive" />
                  ) : (
                    <Shield className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm">
                    {member.blacklisted ? "Blacklisted" : "Active"}
                  </span>
                </div>
                <Switch
                  checked={!member.blacklisted}
                  onCheckedChange={(checked) =>
                    toggleBlacklistMutation.mutate({
                      staffId: member.id,
                      blacklisted: !checked,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {(!staff || staff.length === 0) && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No staff data available</p>
              <p className="text-sm text-muted-foreground">
                Staff members will appear here after they claim tickets
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
