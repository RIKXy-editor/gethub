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
import { Separator } from "@/components/ui/separator";
import { apiClient, type SubscriptionPlan } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
import {
  Save,
  Send,
  Plus,
  Trash2,
  Eye,
  Palette,
  Type,
  Image,
  MessageSquare,
  Sparkles,
  GripVertical,
} from "lucide-react";

const EMOJIS = ["🎫", "✨", "💎", "🎁", "📌", "🔥", "⭐", "💰", "🎯", "🚀", "💼", "📢", "✅", "❌", "⚠️", "💳"];
const BUTTON_COLORS = ["Primary", "Success", "Danger", "Secondary"];

export default function PanelBuilderPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();

  const [panelEmbed, setPanelEmbed] = useState({
    title: "🎫 Support Tickets",
    description: "Click the button below to create a support ticket.",
    color: "#dc2626",
    image: "",
    thumbnail: "",
    footer: "",
  });
  const [buttonLabel, setButtonLabel] = useState("Open Ticket");
  const [buttonColor, setButtonColor] = useState("Primary");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["config", selectedGuildId],
    queryFn: () => apiClient.getConfig(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: channels } = useQuery({
    queryKey: ["channels", selectedGuildId],
    queryFn: () => apiClient.getChannels(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const { data: savedPlans } = useQuery({
    queryKey: ["plans", selectedGuildId],
    queryFn: () => apiClient.getPlans(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  useEffect(() => {
    if (config) {
      setPanelEmbed({
        title: config.panelEmbed?.title || "🎫 Support Tickets",
        description: config.panelEmbed?.description || "Click the button below to create a support ticket.",
        color: config.panelEmbed?.color || "#dc2626",
        image: config.panelEmbed?.image || "",
        thumbnail: config.panelEmbed?.thumbnail || "",
        footer: config.panelEmbed?.footer || "",
      });
      setButtonLabel(config.buttonLabel || "Open Ticket");
      setButtonColor(config.buttonColor || "Primary");
    }
  }, [config]);

  useEffect(() => {
    if (savedPlans) {
      setPlans(savedPlans);
    }
  }, [savedPlans]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.updateConfig(selectedGuildId, {
        panelEmbed,
        buttonLabel,
        buttonColor,
      });
      await apiClient.updatePlans(selectedGuildId, plans);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Panel settings saved!" });
      queryClient.invalidateQueries({ queryKey: ["config", selectedGuildId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.publishPanel(selectedGuildId, selectedChannel),
    onSuccess: () => {
      toast({ title: "Success", description: "Panel published to Discord!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish panel", variant: "destructive" });
    },
  });

  const insertEmoji = (emoji: string) => {
    setPanelEmbed((prev) => ({
      ...prev,
      description: prev.description + emoji,
    }));
  };

  const formatText = (type: string) => {
    const formats: Record<string, { prefix: string; suffix: string }> = {
      bold: { prefix: "**", suffix: "**" },
      italic: { prefix: "*", suffix: "*" },
      underline: { prefix: "__", suffix: "__" },
      strikethrough: { prefix: "~~", suffix: "~~" },
    };
    const format = formats[type];
    if (format) {
      setPanelEmbed((prev) => ({
        ...prev,
        description: prev.description + format.prefix + "text" + format.suffix,
      }));
    }
  };

  const addPlan = () => {
    setPlans([...plans, { name: "", priceINR: "", priceUSD: "", features: [] }]);
  };

  const updatePlan = (index: number, field: keyof SubscriptionPlan, value: string) => {
    const newPlans = [...plans];
    if (field === "features") {
      newPlans[index].features = value.split(",").map((f) => f.trim());
    } else {
      (newPlans[index] as any)[field] = value;
    }
    setPlans(newPlans);
  };

  const removePlan = (index: number) => {
    setPlans(plans.filter((_, i) => i !== index));
  };

  const getButtonColorClass = () => {
    const colors: Record<string, string> = {
      Primary: "bg-blue-600 hover:bg-blue-700",
      Success: "bg-green-600 hover:bg-green-700",
      Danger: "bg-red-600 hover:bg-red-700",
      Secondary: "bg-gray-600 hover:bg-gray-700",
    };
    return colors[buttonColor] || colors.Primary;
  };

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
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Panel Builder</h2>
          <p className="text-muted-foreground">Design your ticket panel with live preview</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Tabs defaultValue="embed" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="embed">
                <MessageSquare className="mr-2 h-4 w-4" />
                Embed
              </TabsTrigger>
              <TabsTrigger value="button">
                <Sparkles className="mr-2 h-4 w-4" />
                Button
              </TabsTrigger>
              <TabsTrigger value="plans">
                <GripVertical className="mr-2 h-4 w-4" />
                Plans
              </TabsTrigger>
            </TabsList>

            <TabsContent value="embed" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="h-5 w-5" />
                    Panel Embed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={panelEmbed.title}
                      onChange={(e) => setPanelEmbed({ ...panelEmbed, title: e.target.value })}
                      placeholder="🎫 Support Tickets"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="p-1 hover:bg-muted rounded text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1 mb-2">
                      <Button size="sm" variant="outline" onClick={() => formatText("bold")}>
                        <strong>B</strong>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => formatText("italic")}>
                        <em>I</em>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => formatText("underline")}>
                        <u>U</u>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => formatText("strikethrough")}>
                        <s>S</s>
                      </Button>
                    </div>
                    <Textarea
                      value={panelEmbed.description}
                      onChange={(e) => setPanelEmbed({ ...panelEmbed, description: e.target.value })}
                      placeholder="Click the button below to create a ticket"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Color
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={panelEmbed.color}
                          onChange={(e) => setPanelEmbed({ ...panelEmbed, color: e.target.value })}
                          className="w-12 h-10 p-1"
                        />
                        <Input
                          value={panelEmbed.color}
                          onChange={(e) => setPanelEmbed({ ...panelEmbed, color: e.target.value })}
                          placeholder="#dc2626"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Image URL
                    </Label>
                    <Input
                      value={panelEmbed.image}
                      onChange={(e) => setPanelEmbed({ ...panelEmbed, image: e.target.value })}
                      placeholder="https://example.com/image.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Thumbnail URL</Label>
                    <Input
                      value={panelEmbed.thumbnail}
                      onChange={(e) => setPanelEmbed({ ...panelEmbed, thumbnail: e.target.value })}
                      placeholder="https://example.com/thumbnail.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Footer</Label>
                    <Input
                      value={panelEmbed.footer}
                      onChange={(e) => setPanelEmbed({ ...panelEmbed, footer: e.target.value })}
                      placeholder="Editors Club Support"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="button" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Button Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Button Label</Label>
                    <Input
                      value={buttonLabel}
                      onChange={(e) => setButtonLabel(e.target.value)}
                      placeholder="Open Ticket"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Button Color</Label>
                    <Select value={buttonColor} onValueChange={setButtonColor}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BUTTON_COLORS.map((color) => (
                          <SelectItem key={color} value={color}>
                            {color}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plans" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Subscription Plans</span>
                    <Button size="sm" onClick={addPlan}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Plan
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plans.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      No plans configured. Click "Add Plan" to create one.
                    </p>
                  ) : (
                    plans.map((plan, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge>Plan {index + 1}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removePlan(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input
                              value={plan.name}
                              onChange={(e) => updatePlan(index, "name", e.target.value)}
                              placeholder="1 Month"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">INR Price</Label>
                            <Input
                              value={plan.priceINR}
                              onChange={(e) => updatePlan(index, "priceINR", e.target.value)}
                              placeholder="₹595"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">USD Price</Label>
                            <Input
                              value={plan.priceUSD}
                              onChange={(e) => updatePlan(index, "priceUSD", e.target.value)}
                              placeholder="$8"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Publish Panel
              </CardTitle>
              <CardDescription>Send the panel to a Discord channel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Channel</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels?.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => publishMutation.mutate()}
                disabled={!selectedChannel || publishMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Publish to Discord
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>This is how your panel will appear in Discord</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-[#36393f] rounded-lg p-4 text-white">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-sm font-bold">
                    EC
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">Editors Club</span>
                      <Badge variant="secondary" className="text-xs">BOT</Badge>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden"
                      style={{ borderLeft: `4px solid ${panelEmbed.color}` }}
                    >
                      <div className="bg-[#2f3136] p-4">
                        <h3 className="font-semibold text-white mb-2">{panelEmbed.title}</h3>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                          {panelEmbed.description}
                        </p>
                        {panelEmbed.image && (
                          <img
                            src={panelEmbed.image}
                            alt="Panel"
                            className="mt-3 rounded max-w-full"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        {panelEmbed.footer && (
                          <p className="text-gray-400 text-xs mt-3">{panelEmbed.footer}</p>
                        )}
                      </div>
                    </div>
                    <button
                      className={`mt-3 px-4 py-2 rounded text-sm font-medium text-white ${getButtonColorClass()}`}
                    >
                      🎫 {buttonLabel}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
