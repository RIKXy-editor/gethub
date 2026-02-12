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
  panelEmbed?: PanelEmbed;
  buttonLabel?: string;
  buttonColor?: string;
  ticketEmbed?: TicketEmbed;
  subscriptionPlans?: SubscriptionPlan[];
  paymentMethods?: Record<string, PaymentMethod>;
  categories?: Category[];
  ratingEnabled?: boolean;
  ratingMessage?: string;
  transcriptSettings?: TranscriptSettings;
}

export interface PanelEmbed {
  title?: string;
  description?: string;
  color?: string;
  image?: string;
  thumbnail?: string;
  footer?: string;
}

export interface TicketEmbed {
  title?: string;
  description?: string;
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

export interface TranscriptSettings {
  enabled: boolean;
  htmlFormat: boolean;
  textFormat: boolean;
  sendToLogs: boolean;
  dmOpener: boolean;
}

export interface TicketStats {
  total: number;
  open: number;
  closed: number;
  avgRating: number;
  ticketsPerDay: { date: string; count: number }[];
  topCategories: { name: string; count: number }[];
  staffLeaderboard: StaffStats[];
}

export interface StaffStats {
  userId: string;
  username: string;
  avatar?: string;
  claimed: number;
  avgRating: number;
  avgResponseTime?: number;
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
