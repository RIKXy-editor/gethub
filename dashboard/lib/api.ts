import axios from "axios";

const API_BASE = "/admin";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export interface TicketConfig {
  supportRoleId?: string;
  ticketCategoryId?: string;
  logsChannelId?: string;
  transcriptDM?: boolean;
  cooldownSeconds?: number;
  maxTicketsPerUser?: number;
  enabled?: boolean;
  panelEmbed?: {
    title?: string;
    description?: string;
    color?: string;
    image?: string;
    thumbnail?: string;
    footer?: string;
  };
  buttonLabel?: string;
  buttonColor?: string;
  ticketEmbed?: {
    title?: string;
    description?: string;
  };
  subscriptionPlans?: SubscriptionPlan[];
  paymentMethods?: Record<string, PaymentMethod>;
  categories?: Category[];
  ratingEnabled?: boolean;
  ratingMessage?: string;
  transcriptSettings?: {
    enabled: boolean;
    htmlFormat: boolean;
    textFormat: boolean;
    sendToLogs: boolean;
    dmOpener: boolean;
  };
}

export interface SubscriptionPlan {
  name: string;
  priceINR: string;
  priceUSD: string;
  features?: string[];
}

export interface PaymentMethod {
  name: string;
  embed: {
    title: string;
    description: string;
    color: string;
  };
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  supportRoles: string[];
  maxTickets?: number;
  autoCloseHours?: number;
  active: boolean;
}

export interface TicketStats {
  total: number;
  open: number;
  closed: number;
  avgRating: number;
  ticketsPerDay: { date: string; count: number }[];
  topCategories: { name: string; count: number }[];
  staffLeaderboard: { userId: string; username: string; claimed: number; avgRating: number; avgResponseTime?: number }[];
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  username: string;
  details: string;
  timestamp: string;
}

export interface StaffMember {
  id: string;
  username: string;
  avatar: string;
  ticketsClaimed: number;
  avgRating: number;
  avgResponseTime?: number;
  blacklisted: boolean;
}

export const apiClient = {
  async login(password: string): Promise<{ success: boolean; token?: string }> {
    const res = await api.post("/login", { password });
    if (res.data.success && res.data.token) {
      localStorage.setItem('admin_token', res.data.token);
    }
    return res.data;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('admin_token');
  },

  async checkAuth(): Promise<{ authenticated: boolean }> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      return { authenticated: false };
    }
    try {
      const res = await api.get("/check-auth");
      return res.data;
    } catch {
      localStorage.removeItem('admin_token');
      return { authenticated: false };
    }
  },

  async getGuilds(): Promise<Guild[]> {
    const res = await api.get("/api/discord/guilds");
    return res.data;
  },

  async getConfig(guildId: string): Promise<TicketConfig> {
    const res = await api.get(`/api/config/${guildId}`);
    return res.data;
  },

  async updateConfig(guildId: string, config: Partial<TicketConfig>): Promise<void> {
    await api.put(`/api/config/${guildId}`, config);
  },

  async getPlans(guildId: string): Promise<SubscriptionPlan[]> {
    const res = await api.get(`/api/plans/${guildId}`);
    return res.data;
  },

  async updatePlans(guildId: string, plans: SubscriptionPlan[]): Promise<void> {
    await api.put(`/api/plans/${guildId}`, { plans });
  },

  async getPayments(guildId: string): Promise<Record<string, PaymentMethod>> {
    const res = await api.get(`/api/payments/${guildId}`);
    return res.data;
  },

  async updatePayments(guildId: string, methods: Record<string, PaymentMethod>): Promise<void> {
    await api.put(`/api/payments/${guildId}`, { methods });
  },

  async publishPanel(guildId: string, channelId: string): Promise<void> {
    await api.post(`/api/panels/${guildId}/post`, { channelId });
  },

  async getStats(guildId: string): Promise<TicketStats> {
    const res = await api.get(`/api/stats/${guildId}`);
    return res.data;
  },

  async getLogs(guildId: string, filters?: { action?: string; limit?: number }): Promise<AuditLog[]> {
    const res = await api.get(`/api/logs/${guildId}`, { params: filters });
    return res.data;
  },

  async getCategories(guildId: string): Promise<Category[]> {
    const res = await api.get(`/api/categories/${guildId}`);
    return res.data;
  },

  async updateCategories(guildId: string, categories: Category[]): Promise<void> {
    await api.put(`/api/categories/${guildId}`, { categories });
  },

  async getStaff(guildId: string): Promise<StaffMember[]> {
    const res = await api.get(`/api/staff/${guildId}`);
    return res.data;
  },

  async updateStaff(guildId: string, staffId: string, data: Partial<StaffMember>): Promise<void> {
    await api.put(`/api/staff/${guildId}/${staffId}`, data);
  },

  async getChannels(guildId: string): Promise<{ id: string; name: string; type: number }[]> {
    const res = await api.get(`/api/discord/guilds/${guildId}/channels`);
    return res.data;
  },

  async getRoles(guildId: string): Promise<{ id: string; name: string; color: number }[]> {
    const res = await api.get(`/api/discord/guilds/${guildId}/roles`);
    return res.data;
  },
};

export default apiClient;
