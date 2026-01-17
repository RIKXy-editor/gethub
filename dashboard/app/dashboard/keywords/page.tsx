"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { AlertTriangle, Plus, X } from "lucide-react";

export default function KeywordsPage() {
  const { selectedGuildId } = useGuildStore();
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["keywords", selectedGuildId],
    queryFn: () => apiClient.getKeywords(selectedGuildId),
    enabled: !!selectedGuildId,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => apiClient.toggleKeywords(selectedGuildId, enabled),
    onSuccess: () => {
      toast({ title: "Success", description: "Keyword system updated!" });
      queryClient.invalidateQueries({ queryKey: ["keywords", selectedGuildId] });
    },
  });

  const addMutation = useMutation({
    mutationFn: (keyword: string) => apiClient.addKeyword(selectedGuildId, keyword),
    onSuccess: () => {
      toast({ title: "Success", description: "Keyword added!" });
      setNewKeyword("");
      queryClient.invalidateQueries({ queryKey: ["keywords", selectedGuildId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (keyword: string) => apiClient.removeKeyword(selectedGuildId, keyword),
    onSuccess: () => {
      toast({ title: "Success", description: "Keyword removed!" });
      queryClient.invalidateQueries({ queryKey: ["keywords", selectedGuildId] });
    },
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      addMutation.mutate(newKeyword.trim().toLowerCase());
    }
  };

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
        <h1 className="text-3xl font-bold">Keyword Warnings</h1>
        <p className="text-muted-foreground">Flag messages containing specific words or phrases</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label>Keyword Warnings Enabled</Label>
              <Switch
                checked={config?.enabled || false}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Keyword</CardTitle>
            <CardDescription>Words or phrases to flag</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
              />
              <Button onClick={handleAddKeyword} disabled={addMutation.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Flagged Keywords ({config?.keywords?.length || 0})</CardTitle>
            <CardDescription>Messages containing these will trigger a warning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {config?.keywords?.length === 0 && (
                <p className="text-muted-foreground">No keywords added yet</p>
              )}
              {config?.keywords?.map((keyword: string) => (
                <Badge key={keyword} variant="secondary" className="flex items-center gap-1 text-sm py-1 px-3">
                  {keyword}
                  <X
                    className="h-3 w-3 cursor-pointer ml-1"
                    onClick={() => removeMutation.mutate(keyword)}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
