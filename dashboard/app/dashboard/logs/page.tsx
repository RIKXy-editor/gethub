"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, type AuditLog } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { ClipboardList, Download, Search, Filter, Clock } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  ticket_created: "bg-green-500",
  ticket_claimed: "bg-blue-500",
  ticket_closed: "bg-red-500",
  ticket_reopened: "bg-yellow-500",
  config_updated: "bg-purple-500",
  panel_published: "bg-cyan-500",
};

const ACTION_LABELS: Record<string, string> = {
  ticket_created: "Created",
  ticket_claimed: "Claimed",
  ticket_closed: "Closed",
  ticket_reopened: "Reopened",
  config_updated: "Config",
  panel_published: "Published",
};

export default function LogsPage() {
  const { selectedGuildId } = useGuildStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["logs", selectedGuildId, actionFilter],
    queryFn: () =>
      apiClient.getLogs(selectedGuildId, {
        action: actionFilter !== "all" ? actionFilter : undefined,
        limit: 100,
      }),
    enabled: !!selectedGuildId,
  });

  const filteredLogs = (logs || []).filter(
    (log) =>
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    if (!filteredLogs.length) return;

    const headers = ["Timestamp", "Action", "User", "Details"];
    const rows = filteredLogs.map((log) => [
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.username,
      log.details,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

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
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">View activity and configuration changes</p>
        </div>
        <Button onClick={exportToCSV} disabled={!filteredLogs.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>Recent actions and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="ticket_created">Ticket Created</SelectItem>
                <SelectItem value="ticket_claimed">Ticket Claimed</SelectItem>
                <SelectItem value="ticket_closed">Ticket Closed</SelectItem>
                <SelectItem value="ticket_reopened">Ticket Reopened</SelectItem>
                <SelectItem value="config_updated">Config Updated</SelectItem>
                <SelectItem value="panel_published">Panel Published</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      ACTION_COLORS[log.action] || "bg-gray-500"
                    }`}
                  />
                  <Badge variant="outline" className="min-w-20 justify-center">
                    {ACTION_LABELS[log.action] || log.action}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium">{log.username}</p>
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No logs found</p>
              <p className="text-sm text-muted-foreground">
                Activity will be recorded as actions are performed
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
