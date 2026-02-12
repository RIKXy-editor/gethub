"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import { Save, FileText, Download, Mail, FileCode, FileType } from "lucide-react";

export default function TranscriptsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [transcriptSettings, setTranscriptSettings] = useState({
    enabled: true,
    htmlFormat: true,
    textFormat: false,
    sendToLogs: true,
    dmOpener: true,
  });

  const { data: config } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiClient.getConfig(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (config?.transcriptSettings) {
      setTranscriptSettings(config.transcriptSettings);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateConfig(selectedGuildId, { transcriptSettings: transcriptSettings }),
    onSuccess: () => {
      toast({ title: "Success", description: "Transcript settings saved!" });
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
          <h2 className="text-3xl font-bold tracking-tight">Transcript Settings</h2>
          <p className="text-muted-foreground">Configure how ticket transcripts are generated</p>
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
              <FileText className="h-5 w-5" />
              Transcript Generation
            </CardTitle>
            <CardDescription>Enable or disable transcript creation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Transcripts</Label>
                <p className="text-sm text-muted-foreground">
                  Generate transcripts when tickets are closed
                </p>
              </div>
              <Switch
                checked={transcriptSettings.enabled}
                onCheckedChange={(checked) =>
                  setTranscriptSettings({ ...transcriptSettings, enabled: checked })
                }
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Transcript Formats</Label>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label className="font-normal">HTML Format</Label>
                    <p className="text-sm text-muted-foreground">
                      Beautiful, styled transcript file
                    </p>
                  </div>
                </div>
                <Switch
                  checked={transcriptSettings.htmlFormat}
                  onCheckedChange={(checked) =>
                    setTranscriptSettings({ ...transcriptSettings, htmlFormat: checked })
                  }
                  disabled={!transcriptSettings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileType className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label className="font-normal">Text Format</Label>
                    <p className="text-sm text-muted-foreground">
                      Plain text transcript file
                    </p>
                  </div>
                </div>
                <Switch
                  checked={transcriptSettings.textFormat}
                  onCheckedChange={(checked) =>
                    setTranscriptSettings({ ...transcriptSettings, textFormat: checked })
                  }
                  disabled={!transcriptSettings.enabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Transcript Destination
            </CardTitle>
            <CardDescription>Where to send generated transcripts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label className="font-normal">Send to Logs Channel</Label>
                  <p className="text-sm text-muted-foreground">
                    Post transcript in the logs channel
                  </p>
                </div>
              </div>
              <Switch
                checked={transcriptSettings.sendToLogs}
                onCheckedChange={(checked) =>
                  setTranscriptSettings({ ...transcriptSettings, sendToLogs: checked })
                }
                disabled={!transcriptSettings.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label className="font-normal">DM to Ticket Opener</Label>
                  <p className="text-sm text-muted-foreground">
                    Send transcript via DM to user
                  </p>
                </div>
              </div>
              <Switch
                checked={transcriptSettings.dmOpener}
                onCheckedChange={(checked) =>
                  setTranscriptSettings({ ...transcriptSettings, dmOpener: checked })
                }
                disabled={!transcriptSettings.enabled}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transcript Preview</CardTitle>
          <CardDescription>Example of how a transcript looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4">
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="bg-primary/10 p-4 border-b">
                <h3 className="font-semibold">Ticket #123 - Transcript</h3>
                <p className="text-sm text-muted-foreground">
                  Opened by @User on Jan 17, 2026
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">User</p>
                    <p className="text-sm">Hello, I need help with my subscription.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">Staff</p>
                    <p className="text-sm">Hi! I'd be happy to help. What seems to be the issue?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
