"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { apiClient } from "@/lib/api";
import { useGuildStore } from "@/lib/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { selectedGuildId, setSelectedGuildId } = useGuildStore();

  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["auth"],
    queryFn: () => apiClient.checkAuth(),
  });

  const { data: guilds } = useQuery({
    queryKey: ["guilds"],
    queryFn: () => apiClient.getGuilds(),
    enabled: authData?.authenticated,
  });

  useEffect(() => {
    if (!authLoading && !authData?.authenticated) {
      router.push("/");
    }
  }, [authData, authLoading, router]);

  useEffect(() => {
    if (guilds && guilds.length > 0 && !selectedGuildId) {
      setSelectedGuildId(guilds[0].id);
    }
  }, [guilds, selectedGuildId, setSelectedGuildId]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!authData?.authenticated) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
