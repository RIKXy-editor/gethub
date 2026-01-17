"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Mail, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DMSenderPage() {
  const { selectedGuildId } = useGuildStore();
  const [dm, setDm] = useState({ roleId: "", message: "" });
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: roles } = useQuery({
    queryKey: ["roles", selectedGuildId],
    queryFn: () => apiClient.getRoles(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiClient.sendDM(selectedGuildId, dm),
    onSuccess: (data) => {
      toast({ title: "Success", description: `DM sent to ${data.sent} members!` });
      setResult(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send DMs", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">DM Sender</h1>
        <p className="text-muted-foreground">Send direct messages to members with a specific role</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          DMs are sent to all members with the selected role who have DMs enabled. Use responsibly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose DM
          </CardTitle>
          <CardDescription>Send a message to all members with a specific role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Target Role</Label>
            <Select value={dm.roleId} onValueChange={(v) => setDm({ ...dm, roleId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role: any) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name} ({role.memberCount || 0} members)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={6}
              placeholder="Write your message..."
              value={dm.message}
              onChange={(e) => setDm({ ...dm, message: e.target.value })}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !dm.roleId || !dm.message}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? "Sending..." : "Send DM to Role"}
          </Button>

          {result && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-green-500 font-medium">{result.sent} sent</span>
                {result.failed > 0 && (
                  <span className="text-destructive font-medium ml-2">{result.failed} failed</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
