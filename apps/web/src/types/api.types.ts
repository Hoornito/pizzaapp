export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface ReportData {
  period: 'daily' | 'weekly' | 'monthly' | 'annual';
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  deliveredOrders: number;
  cancelledOrders: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topPromotions: Array<{ name: string; quantity: number; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  postres?: {
    unidadesVendidas: number;
    ingreso: number;
    entradas: number;
    salidas: number;
    stockDisponible: number;
  };
}

export interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  activeOrders: number;
  pendingOrders: number;
  deliveredToday: number;
  revenueByDay: Array<{ date: string; revenue: number }>;
  recentOrders: any[];
}
