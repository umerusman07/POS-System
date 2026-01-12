import { apiGet } from '../api';

export interface DashboardOverview {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalItemsQuantity: number;
  totalDeliveryCharges: number;
  totalDiscount: number;
}

export interface PaymentMethodStats {
  CASH: {
    amount: number;
    count: number;
  };
  ONLINE: {
    amount: number;
    count: number;
  };
}

export interface DayHistoryItem {
  date: string;
  cycleStart: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalItemsQuantity: number;
  totalDeliveryCharges: number;
  totalDiscount: number;
  paymentMethods: PaymentMethodStats;
}

export interface PeriodStats {
  period: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalItemsQuantity: number;
  totalDeliveryCharges: number;
  totalDiscount: number;
  paymentMethods: PaymentMethodStats;
}

export interface OrderSummary {
  totalOrders: number;
  ordersByType: {
    DINE: number;
    TAKEAWAY: number;
    DELIVERY: number;
  };
  ordersByStatus: {
    DRAFT: number;
    PREPARING: number;
    READY: number;
    OUT_FOR_DELIVERY: number;
    DELIVERED: number;
    PICKED_UP: number;
    FINISHED: number;
    CANCELLED: number;
  };
  cancelledOrdersCount: number;
  paymentMethods: {
    CASH: {
      amount: number;
      count: number;
    };
    ONLINE: {
      amount: number;
      count: number;
    };
  };
}

export interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopDeal {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  orderSummary: OrderSummary;
  topItems: TopItem[];
  topDeals: TopDeal[];
  dayHistory: Record<string, DayHistoryItem>;
  monthly: Record<string, PeriodStats>;
  yearly: Record<string, PeriodStats>;
  recentOrders: any[];
}

export interface DashboardResponse {
  success: boolean;
  message: string;
  userRole: string;
  isManager: boolean;
  data: DashboardStats;
}

/**
 * Get dashboard statistics
 * 
 * Backend endpoint: GET /api/dashboard
 * Backend returns: { success: boolean, message: string, userRole: string, isManager: boolean, data: DashboardStats }
 * 
 * @returns Promise<DashboardStats> Dashboard statistics
 * @throws Error if request fails
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // Backend returns: { success, message, userRole, isManager, data: DashboardStats }
  // apiGet returns the entire backend response, so we access response.data
  const response = await apiGet<DashboardStats>('/api/dashboard');
  if (!response || !response.data) {
    throw new Error('Failed to get dashboard statistics');
  }
  // response is the ApiResponse wrapper, response.data contains DashboardStats
  return response.data;
}
