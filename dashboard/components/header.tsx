"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

export function Header() {
  const { selectedGuildId, setSelectedGuildId } = useGuildStore();

  const { data: guilds, isLoading } = useQuery({
    queryKey: ["guilds"],
    queryFn: () => apiClient.getGuilds(),
  });

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {isLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : (
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select server" />
            </SelectTrigger>
            <SelectContent>
              {guilds?.map((guild) => (
                <SelectItem key={guild.id} value={guild.id}>
                  <div className="flex items-center gap-2">
                    {guild.icon ? (
                      <img
                        src={guild.icon}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-muted" />
                    )}
                    {guild.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </header>
  );
}
