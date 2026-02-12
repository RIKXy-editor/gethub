"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuildStore {
  selectedGuildId: string;
  setSelectedGuildId: (id: string) => void;
}

export const useGuildStore = create<GuildStore>()(
  persist(
    (set) => ({
      selectedGuildId: "",
      setSelectedGuildId: (id) => set({ selectedGuildId: id }),
    }),
    {
      name: "guild-storage",
    }
  )
);
