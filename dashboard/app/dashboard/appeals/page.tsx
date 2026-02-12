"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import {
  Save,
  Search,
  Check,
  X,
  MessageSquare,
  Clock,
  User,
  Shield,
  FileText,
  History,
  AlertCircle,
  Send,
} from "lucide-react";

interface AppealsConfig {
  enabled: boolean;
  appealsChannelId: string | null;
  staffRoleId: string | null;
  cooldownDays: number;
  rulesLink: string | null;
  supportServerLink: string | null;
  dmTemplate: {
    title: string;
    description: string;
    color: string;
  };
}

interface Appeal {
  appealId: string;
  guildId: string;
  userId: string;
  userTag: string;
  userAvatar: string;
  caseId: string;
  banReason: string;
  title: string;
  answers: {
    whatHappened: string;
    whyUnban: string;
    agreeRules: string;
  };
  proofLink: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: number;
  updatedAt: number;
  denyReason?: string;
  history: Array<{
    action: string;
    timestamp: number;
    details: string;
    staffId?: string;
  }>;
}

export default function BanAppealsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<AppealsConfig>({
    enabled: false,
    appealsChannelId: null,
    staffRoleId: null,
    cooldownDays: 7,
    rulesLink: null,
    supportServerLink: null,
    dmTemplate: {
      title: "You were banned from {server}",
      description: "You have been banned from **{server}**.\n\n**Reason:** {reason}\n**Case ID:** {caseId}\n\nIf you believe this was a mistake, you can submit an appeal.",
      color: "#e74c3c",
    },
  });

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [messageText, setMessageText] = useState("");
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);

  const { data: appealsConfig, isLoading: configLoading } = useQuery({
    queryKey: ["appealsConfig", selectedGuildId],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/config/${selectedGuildId}`, {
        credentials: "include",
      });
      return response.json();
    },
    enabled: !!selectedGuildId,
  });

  const { data: appeals, isLoading: appealsLoading } = useQuery({
    queryKey: ["appeals", selectedGuildId, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/${selectedGuildId}?${params}`,
        { credentials: "include" }
      );
      return response.json();
    },
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
    if (appealsConfig) {
      setConfig(appealsConfig);
    }
  }, [appealsConfig]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/config/${selectedGuildId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(config),
        }
      );
      if (!response.ok) throw new Error("Failed to save config");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Appeals configuration saved!" });
      queryClient.invalidateQueries({ queryKey: ["appealsConfig", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save configuration", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (appealId: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/${selectedGuildId}/${appealId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Appeal approved! User has been unbanned." });
      queryClient.invalidateQueries({ queryKey: ["appeals", selectedGuildId] });
      setSelectedAppeal(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ appealId, reason }: { appealId: string; reason: string }) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/${selectedGuildId}/${appealId}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reason }),
        }
      );
      if (!response.ok) throw new Error("Failed to deny");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Appeal denied. User has been notified." });
      queryClient.invalidateQueries({ queryKey: ["appeals", selectedGuildId] });
      setSelectedAppeal(null);
      setDenyDialogOpen(false);
      setDenyReason("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to deny appeal", variant: "destructive" });
    },
  });

  const messageMutation = useMutation({
    mutationFn: async ({ appealId, message }: { appealId: string; message: string }) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/appeals/${selectedGuildId}/${appealId}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Message sent to user!" });
      setMessageDialogOpen(false);
      setMessageText("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "DENIED":
        return <Badge className="bg-red-500">Denied</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!selectedGuildId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a server to manage ban appeals</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ban Appeals</h1>
        <p className="text-muted-foreground">
          Manage ban appeals and configure the appeal system
        </p>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Appeals Inbox</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Appeals Inbox
              </CardTitle>
              <CardDescription>
                Review and manage ban appeal requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by user, ID, or case..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Appeals</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="DENIED">Denied</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {appealsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : appeals?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No appeals found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {appeals?.map((appeal: Appeal) => (
                    <div
                      key={appeal.appealId}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                        selectedAppeal?.appealId === appeal.appealId ? "border-primary bg-accent" : ""
                      }`}
                      onClick={() => setSelectedAppeal(appeal)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={appeal.userAvatar || `https://cdn.discordapp.com/embed/avatars/0.png`}
                            alt={appeal.userTag}
                            className="w-10 h-10 rounded-full"
                          />
                          <div>
                            <p className="font-medium">{appeal.userTag}</p>
                            <p className="text-sm text-muted-foreground">
                              {appeal.title} - Case: {appeal.caseId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(appeal.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(appeal.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedAppeal && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Appeal Details: {selectedAppeal.appealId}
                  </div>
                  {getStatusBadge(selectedAppeal.status)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>User</Label>
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                      <img
                        src={selectedAppeal.userAvatar || `https://cdn.discordapp.com/embed/avatars/0.png`}
                        alt={selectedAppeal.userTag}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p className="font-medium">{selectedAppeal.userTag}</p>
                        <p className="text-xs text-muted-foreground">{selectedAppeal.userId}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Case ID</Label>
                    <p className="p-2 bg-muted rounded font-mono">{selectedAppeal.caseId}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ban Reason</Label>
                  <p className="p-2 bg-muted rounded">{selectedAppeal.banReason}</p>
                </div>

                <div className="space-y-2">
                  <Label>What Happened?</Label>
                  <p className="p-3 bg-muted rounded whitespace-pre-wrap">
                    {selectedAppeal.answers.whatHappened}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Why Should We Unban You?</Label>
                  <p className="p-3 bg-muted rounded whitespace-pre-wrap">
                    {selectedAppeal.answers.whyUnban}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agrees to Follow Rules</Label>
                    <p className="p-2 bg-muted rounded">{selectedAppeal.answers.agreeRules}</p>
                  </div>
                  {selectedAppeal.proofLink && (
                    <div className="space-y-2">
                      <Label>Proof Link</Label>
                      <a
                        href={selectedAppeal.proofLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-muted rounded block text-blue-500 hover:underline truncate"
                      >
                        {selectedAppeal.proofLink}
                      </a>
                    </div>
                  )}
                </div>

                {selectedAppeal.denyReason && (
                  <div className="space-y-2">
                    <Label>Deny Reason</Label>
                    <p className="p-2 bg-red-500/10 border border-red-500/20 rounded">
                      {selectedAppeal.denyReason}
                    </p>
                  </div>
                )}

                {selectedAppeal.history && selectedAppeal.history.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      History
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedAppeal.history.map((entry, i) => (
                        <div key={i} className="p-2 bg-muted rounded text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{entry.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAppeal.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button
                      onClick={() => approveMutation.mutate(selectedAppeal.appealId)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve (Unban)
                    </Button>

                    <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <X className="h-4 w-4 mr-2" />
                          Deny
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deny Appeal</DialogTitle>
                          <DialogDescription>
                            Provide a reason for denying this appeal. The user will be notified.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Reason for denial..."
                          value={denyReason}
                          onChange={(e) => setDenyReason(e.target.value)}
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() =>
                              denyMutation.mutate({
                                appealId: selectedAppeal.appealId,
                                reason: denyReason,
                              })
                            }
                            disabled={denyMutation.isPending}
                          >
                            Deny Appeal
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Message
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Message to User</DialogTitle>
                          <DialogDescription>
                            Send a direct message to the user about their appeal.
                          </DialogDescription>
                        </DialogHeader>
                        <Textarea
                          placeholder="Your message..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() =>
                              messageMutation.mutate({
                                appealId: selectedAppeal.appealId,
                                message: messageText,
                              })
                            }
                            disabled={messageMutation.isPending || !messageText.trim()}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Appeals Configuration
              </CardTitle>
              <CardDescription>
                Configure how the ban appeal system works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Appeals System</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow banned users to submit appeals via DM
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Appeals Channel</Label>
                  <Select
                    value={config.appealsChannelId || ""}
                    onValueChange={(value) =>
                      setConfig({ ...config, appealsChannelId: value || null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {channels?.map((channel: { id: string; name: string }) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Staff-only channel for reviewing appeals
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Staff Review Role</Label>
                  <Select
                    value={config.staffRoleId || ""}
                    onValueChange={(value) =>
                      setConfig({ ...config, staffRoleId: value || null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role: { id: string; name: string }) => (
                        <SelectItem key={role.id} value={role.id}>
                          @{role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Role that can approve/deny appeals
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Cooldown (Days)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.cooldownDays}
                  onChange={(e) =>
                    setConfig({ ...config, cooldownDays: parseInt(e.target.value) || 7 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  How long users must wait between appeal submissions
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rules Link (optional)</Label>
                  <Input
                    placeholder="https://..."
                    value={config.rulesLink || ""}
                    onChange={(e) =>
                      setConfig({ ...config, rulesLink: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Server Link (optional)</Label>
                  <Input
                    placeholder="https://discord.gg/..."
                    value={config.supportServerLink || ""}
                    onChange={(e) =>
                      setConfig({ ...config, supportServerLink: e.target.value || null })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">DM Template</h4>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={config.dmTemplate.title}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        dmTemplate: { ...config.dmTemplate, title: e.target.value },
                      })
                    }
                    placeholder="You were banned from {server}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{server}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={4}
                    value={config.dmTemplate.description}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        dmTemplate: { ...config.dmTemplate, description: e.target.value },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{server}"}, {"{reason}"}, {"{caseId}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.dmTemplate.color}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dmTemplate: { ...config.dmTemplate, color: e.target.value },
                        })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      value={config.dmTemplate.color}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          dmTemplate: { ...config.dmTemplate, color: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={() => saveConfigMutation.mutate()}
                disabled={saveConfigMutation.isPending}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
