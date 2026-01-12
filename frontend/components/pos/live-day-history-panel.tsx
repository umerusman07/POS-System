"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ArrowLeft, Loader2, RefreshCw, DollarSign, ShoppingCart, Utensils, ShoppingBag, Truck, CreditCard, Banknote, TrendingUp, Package, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { getAllOrders } from "@/lib/api/orders"
import type { Order, OrderLine } from "@/lib/api/orders"

interface TodayStats {
  totalSales: number
  totalOrders: number
  deliveryCharges: number
  discount: number
  ordersByType: {
    DINE: number
    TAKEAWAY: number
    DELIVERY: number
  }
  salesByType: {
    DINE: number
    TAKEAWAY: number
    DELIVERY: number
  }
  ordersByStatus: {
    DRAFT: number
    PREPARING: number
    READY: number
    OUT_FOR_DELIVERY: number
    DELIVERED: number
    PICKED_UP: number
    FINISHED: number
    CANCELLED: number
  }
  paymentMethods: {
    CASH: { amount: number; count: number }
    ONLINE: { amount: number; count: number }
  }
  items: Array<{
    name: string
    quantity: number
    revenue: number
  }>
}

// Helper function to check if an order is within today's day cycle (6 AM to 5 AM next day)
// This matches the backend logic: if order is before 6 AM, it belongs to previous day's cycle
function isWithinTodayCycle(orderDate: Date): boolean {
  const now = new Date()
  
  // Determine today's cycle date based on current time
  // If current time is before 6 AM, today's cycle started yesterday at 6 AM
  // If current time is after 6 AM, today's cycle started today at 6 AM
  const cycleDate = new Date(now)
  if (now.getHours() < 6) {
    // Before 6 AM: cycle started yesterday
    cycleDate.setDate(cycleDate.getDate() - 1)
  }
  cycleDate.setHours(0, 0, 0, 0) // Set to start of day for the cycle
  
  // Calculate cycle start (6 AM on cycle date) and end (5 AM next day)
  const cycleStart = new Date(cycleDate)
  cycleStart.setHours(6, 0, 0, 0) // 6 AM
  
  const cycleEnd = new Date(cycleDate)
  cycleEnd.setDate(cycleEnd.getDate() + 1)
  cycleEnd.setHours(5, 0, 0, 0) // 5 AM next day
  
  return orderDate >= cycleStart && orderDate < cycleEnd
}

function calculateTodayStats(orders: Order[]): TodayStats {
  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt)
    return isWithinTodayCycle(orderDate)
  })

  const stats: TodayStats = {
    totalSales: 0,
    totalOrders: todayOrders.length,
    deliveryCharges: 0,
    discount: 0,
    ordersByType: {
      DINE: 0,
      TAKEAWAY: 0,
      DELIVERY: 0,
    },
    salesByType: {
      DINE: 0,
      TAKEAWAY: 0,
      DELIVERY: 0,
    },
    ordersByStatus: {
      DRAFT: 0,
      PREPARING: 0,
      READY: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      PICKED_UP: 0,
      FINISHED: 0,
      CANCELLED: 0,
    },
    paymentMethods: {
      CASH: { amount: 0, count: 0 },
      ONLINE: { amount: 0, count: 0 },
    },
    items: [],
  }

  // Map to track items by name
  const itemsMap = new Map<string, { quantity: number; revenue: number }>()

  todayOrders.forEach((order) => {
    // EXCLUDE DRAFT and CANCELLED orders from all calculations (sales, payment methods, items, etc.)
    // But still count them in ordersByStatus for informational purposes
    const isExcluded = order.status === 'DRAFT' || order.status === 'CANCELLED'
    
    // Orders by status (include all for informational purposes)
    stats.ordersByStatus[order.status] = (stats.ordersByStatus[order.status] || 0) + 1
    
    // Skip calculations for DRAFT and CANCELLED orders
    if (isExcluded) {
      return
    }
    
    // Parse decimal values to numbers
    const subtotal = typeof order.subtotal === 'number' ? order.subtotal : parseFloat(String(order.subtotal || 0))
    const deliveryCharges = typeof order.deliveryCharges === 'number' ? order.deliveryCharges : parseFloat(String(order.deliveryCharges || 0))
    const discount = typeof order.discount === 'number' ? order.discount : parseFloat(String(order.discount || 0))
    const total = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0))
    
    // Calculate total if not provided (subtotal + deliveryCharges - discount)
    const orderTotal = total || (subtotal + deliveryCharges - discount)
    
    // Total sales
    stats.totalSales += orderTotal
    
    // Delivery charges - ONLY for DELIVERY orders
    if (order.orderType === 'DELIVERY') {
      stats.deliveryCharges += deliveryCharges
    }
    
    // Total discount
    stats.discount += discount

    // Orders by type
    stats.ordersByType[order.orderType] = (stats.ordersByType[order.orderType] || 0) + 1
    
    // Sales by type
    stats.salesByType[order.orderType] = (stats.salesByType[order.orderType] || 0) + orderTotal

    // Payment methods
    if (order.paymentMethod) {
      const method = stats.paymentMethods[order.paymentMethod]
      if (method) {
        method.amount += orderTotal
        method.count += 1
      }
    }

    // Process order lines to count items
    if (order.orderLines && Array.isArray(order.orderLines)) {
      order.orderLines.forEach((line: OrderLine) => {
        const itemName = line.nameAtSale
        const existing = itemsMap.get(itemName)
        
        // Parse lineTotal if it's a string/decimal
        const lineQuantity = typeof line.quantity === 'number' ? line.quantity : parseInt(String(line.quantity || 0))
        
        if (existing) {
          existing.quantity += lineQuantity
        } else {
          itemsMap.set(itemName, {
            quantity: lineQuantity,
            revenue: 0, // Not needed anymore
          })
        }
      })
    }
  })

  // Convert items map to array and sort by quantity (no revenue needed)
  stats.items = Array.from(itemsMap.entries())
    .map(([name, data]) => ({
      name,
      quantity: data.quantity,
      revenue: 0, // Not used in display
    }))
    .sort((a, b) => b.quantity - a.quantity)

  return stats
}

interface LiveDayHistoryPanelProps {
  onBack: () => void
}

export function LiveDayHistoryPanel({ onBack }: LiveDayHistoryPanelProps) {
  const { toast } = useToast()
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchTodayStats = useCallback(async () => {
    try {
      setIsRefreshing(true)
      if (!stats) setIsLoading(true)

      // Get all orders (we'll filter for today on client side)
      // Fetch in batches to ensure we get all orders
      // API limit is max 100, so we'll use 100 per page
      let allOrders: Order[] = []
      let page = 1
      let hasMore = true
      const limit = 100 // Maximum allowed by API

      while (hasMore && page <= 50) { // Limit to 50 pages (5000 orders max, should be more than enough)
        const response = await getAllOrders({ page, limit })
        allOrders = [...allOrders, ...response.orders]
        
        // Check if we've reached the last page
        if (response.pagination) {
          if (page >= response.pagination.totalPages) {
            hasMore = false
          } else {
            page++
          }
        } else if (response.orders.length < limit) {
          // No more orders if we got less than the limit
          hasMore = false
        } else {
          page++
        }
      }

      // Debug: Log fetched orders count
      console.log("Fetched total orders:", allOrders.length)
      
      // Debug: Log sample order structure
      if (allOrders.length > 0) {
        console.log("Sample order:", {
          id: allOrders[0].id,
          subtotal: allOrders[0].subtotal,
          deliveryCharges: allOrders[0].deliveryCharges,
          total: allOrders[0].total,
          orderType: allOrders[0].orderType,
          paymentMethod: allOrders[0].paymentMethod,
          status: allOrders[0].status,
          orderLinesCount: allOrders[0].orderLines?.length || 0
        })
      }
      
      const todayStats = calculateTodayStats(allOrders)
      console.log("Today's stats calculated:", todayStats)
      setStats(todayStats)
    } catch (error) {
      console.error("Error fetching today's stats:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load today's statistics",
        variant: "destructive",
      })
      // Set empty stats on error so UI still renders
      setStats({
        totalSales: 0,
        totalOrders: 0,
        deliveryCharges: 0,
        discount: 0,
        ordersByType: { DINE: 0, TAKEAWAY: 0, DELIVERY: 0 },
        salesByType: { DINE: 0, TAKEAWAY: 0, DELIVERY: 0 },
        ordersByStatus: {
          DRAFT: 0,
          PREPARING: 0,
          READY: 0,
          OUT_FOR_DELIVERY: 0,
          DELIVERED: 0,
          PICKED_UP: 0,
          FINISHED: 0,
          CANCELLED: 0,
        },
        paymentMethods: { CASH: { amount: 0, count: 0 }, ONLINE: { amount: 0, count: 0 } },
        items: [],
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [stats, toast])

  useEffect(() => {
    fetchTodayStats()
  }, [])

  // Auto-refresh every 10 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTodayStats()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [fetchTodayStats])

  // Get current day cycle info
  const cycleInfo = useMemo(() => {
    const now = new Date()
    
    // Determine today's cycle date based on current time
    const cycleDate = new Date(now)
    if (now.getHours() < 6) {
      cycleDate.setDate(cycleDate.getDate() - 1)
    }
    cycleDate.setHours(0, 0, 0, 0)
    
    const cycleStart = new Date(cycleDate)
    cycleStart.setHours(6, 0, 0, 0) // 6 AM
    
    const cycleEnd = new Date(cycleDate)
    cycleEnd.setDate(cycleEnd.getDate() + 1)
    cycleEnd.setHours(5, 0, 0, 0) // 5 AM next day
    
    return {
      start: cycleStart,
      end: cycleEnd,
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Failed to load today's statistics</p>
            <Button onClick={fetchTodayStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalSalesByType = stats.salesByType.DINE + stats.salesByType.TAKEAWAY + stats.salesByType.DELIVERY

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-card/95 dark:from-green-800/60 dark:via-green-900/45 dark:to-card/95 backdrop-blur-sm px-6 py-3 shadow-md">
        <div className="relative flex flex-col items-center gap-2">
          {/* Back Button - Top Left */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="absolute left-0 top-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {/* Centered Title and Info */}
          <div className="flex flex-col items-center text-center space-y-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Live Day History
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Real-time statistics for today (6 AM - 5 AM cycle)
            </p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              <span>
                Cycle: {format(cycleInfo.start, "MMM dd, HH:mm")} - {format(cycleInfo.end, "MMM dd, HH:mm")}
              </span>
            </div>
          </div>
          
          {/* Refresh Button - Top Right */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTodayStats}
            disabled={isRefreshing}
            className="absolute right-0 top-0 shrink-0 border-border/50 hover:border-border"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-4 space-y-4">
          {/* Main Stats Cards - Professional Design */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Sales */}
            <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-primary/40 transition-all duration-300 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Total Sales (Today)</p>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      PKR {stats.totalSales.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">Revenue today</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 hover:shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
            </div>

            {/* Total Orders */}
            <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-blue-500/40 transition-all duration-300 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Total Orders (Today)</p>
                    <div className="text-2xl font-bold text-foreground mb-1">{stats.totalOrders}</div>
                    <p className="text-[10px] text-muted-foreground/80">Orders received today</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-blue-500/10 flex-shrink-0 bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/20 transition-shadow duration-300">
                    <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Charges */}
            <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-purple-500/40 transition-all duration-300 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Delivery Charges</p>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      PKR {stats.deliveryCharges.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">From delivery orders</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-purple-500/10 flex-shrink-0 bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/20 transition-shadow duration-300">
                    <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Total Discount */}
            <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-pink-500/40 transition-all duration-300 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Total Discount</p>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      PKR {stats.discount.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">Discounts given today</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md shadow-pink-500/10 flex-shrink-0 bg-gradient-to-br from-pink-500/20 to-pink-500/10 border border-pink-500/20 hover:shadow-lg hover:shadow-pink-500/20 transition-shadow duration-300">
                    <TrendingUp className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Orders by Status & Sales by Order Type */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Orders by Status */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all duration-300 overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-transparent dark:from-green-800/60 dark:via-green-900/45 dark:to-transparent">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Orders by Status</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Current status distribution</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-border/50 bg-muted/30 dark:bg-muted/20 text-center hover:border-border hover:bg-muted/50 dark:hover:bg-muted/30 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Draft</div>
                    <div className="text-lg font-bold text-foreground">{stats.ordersByStatus.DRAFT || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-yellow-200/60 dark:border-yellow-900/60 bg-gradient-to-br from-yellow-50/80 to-yellow-50/40 dark:from-yellow-950/30 dark:to-yellow-950/10 text-center hover:border-yellow-300 dark:hover:border-yellow-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Preparing</div>
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.ordersByStatus.PREPARING || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 text-center hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Ready</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.ordersByStatus.READY || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 to-indigo-50/40 dark:from-indigo-950/30 dark:to-indigo-950/10 text-center hover:border-indigo-300 dark:hover:border-indigo-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Out for Delivery</div>
                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{stats.ordersByStatus.OUT_FOR_DELIVERY || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-cyan-200/60 dark:border-cyan-900/60 bg-gradient-to-br from-cyan-50/80 to-cyan-50/40 dark:from-cyan-950/30 dark:to-cyan-950/10 text-center hover:border-cyan-300 dark:hover:border-cyan-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Delivered</div>
                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{stats.ordersByStatus.DELIVERED || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-teal-200/60 dark:border-teal-900/60 bg-gradient-to-br from-teal-50/80 to-teal-50/40 dark:from-teal-950/30 dark:to-teal-950/10 text-center hover:border-teal-300 dark:hover:border-teal-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Picked Up</div>
                    <div className="text-lg font-bold text-teal-600 dark:text-teal-400">{stats.ordersByStatus.PICKED_UP || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-green-200/60 dark:border-green-900/60 bg-gradient-to-br from-green-50/80 to-green-50/40 dark:from-green-950/30 dark:to-green-950/10 text-center hover:border-green-300 dark:hover:border-green-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Finished</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.ordersByStatus.FINISHED || 0}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-red-200/60 dark:border-red-900/60 bg-gradient-to-br from-red-50/80 to-red-50/40 dark:from-red-950/30 dark:to-red-950/10 text-center hover:border-red-300 dark:hover:border-red-800 transition-all duration-200">
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Cancelled</div>
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.ordersByStatus.CANCELLED || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales by Order Type */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all duration-300 overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-transparent dark:from-green-800/60 dark:via-green-900/45 dark:to-transparent">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Sales by Order Type</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Revenue breakdown by order type</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Dine In */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30">
                      <Utensils className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground">Dine In</span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {stats.ordersByType.DINE} orders
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                      PKR {stats.salesByType.DINE.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {totalSalesByType > 0 
                        ? `${((stats.salesByType.DINE / totalSalesByType) * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>

                {/* Takeaway */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-green-200/60 dark:border-green-900/60 bg-gradient-to-r from-green-50/80 to-green-50/40 dark:from-green-950/30 dark:to-green-950/10 hover:border-green-300 dark:hover:border-green-800 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30">
                      <ShoppingBag className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground">Takeaway</span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {stats.ordersByType.TAKEAWAY} orders
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-green-600 dark:text-green-400">
                      PKR {stats.salesByType.TAKEAWAY.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {totalSalesByType > 0 
                        ? `${((stats.salesByType.TAKEAWAY / totalSalesByType) * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>

                {/* Delivery */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-purple-200/60 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/80 to-purple-50/40 dark:from-purple-950/30 dark:to-purple-950/10 hover:border-purple-300 dark:hover:border-purple-800 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30">
                      <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground">Delivery</span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {stats.ordersByType.DELIVERY} orders
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                      PKR {stats.salesByType.DELIVERY.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {totalSalesByType > 0 
                        ? `${((stats.salesByType.DELIVERY / totalSalesByType) * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all duration-300 overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-transparent dark:from-green-800/60 dark:via-green-900/45 dark:to-transparent">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">Sales by Payment Method</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Revenue breakdown by payment type</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Cash */}
                <div className="p-3 rounded-xl border border-green-200/60 dark:border-green-900/60 bg-gradient-to-br from-green-50/80 to-green-50/40 dark:from-green-950/30 dark:to-green-950/10 hover:border-green-300 dark:hover:border-green-800 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30">
                        <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Cash</span>
                    </div>
                    <Badge variant="outline" className="bg-green-100/60 dark:bg-green-900/40 text-[10px] border-green-300/50 dark:border-green-800/50 font-mono">
                      {stats.paymentMethods.CASH.count} orders
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      PKR {stats.paymentMethods.CASH.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-green-100/50 dark:bg-green-900/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                          style={{ 
                            width: stats.totalSales > 0 
                              ? `${(stats.paymentMethods.CASH.amount / stats.totalSales) * 100}%`
                              : "0%"
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-green-600/80 dark:text-green-400/80 min-w-[2.5rem] text-right">
                        {stats.totalSales > 0 
                          ? `${((stats.paymentMethods.CASH.amount / stats.totalSales) * 100).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Online */}
                <div className="p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30">
                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Online</span>
                    </div>
                    <Badge variant="outline" className="bg-blue-100/60 dark:bg-blue-900/40 text-[10px] border-blue-300/50 dark:border-blue-800/50 font-mono">
                      {stats.paymentMethods.ONLINE.count} orders
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      PKR {stats.paymentMethods.ONLINE.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-blue-100/50 dark:bg-blue-900/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                          style={{ 
                            width: stats.totalSales > 0 
                              ? `${(stats.paymentMethods.ONLINE.amount / stats.totalSales) * 100}%`
                              : "0%"
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80 min-w-[2.5rem] text-right">
                        {stats.totalSales > 0 
                          ? `${((stats.paymentMethods.ONLINE.amount / stats.totalSales) * 100).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Sold Today */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 transition-all duration-300 overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-transparent dark:from-green-800/60 dark:via-green-900/45 dark:to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Items Sold Today</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">All items and deals sold (sorted by quantity)</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <ScrollArea className="h-[300px]">
                {stats.items.length > 0 ? (
                  <div className="space-y-2 pr-4">
                    {stats.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 dark:bg-muted/10 hover:border-border hover:bg-muted/40 dark:hover:bg-muted/20 transition-all duration-200"
                      >
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border shadow-sm transition-all duration-200",
                          index < 3 
                            ? "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary/40 text-primary group-hover:shadow-md" 
                            : "bg-muted/40 dark:bg-muted/30 border-border/50 text-muted-foreground"
                        )}>
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-foreground truncate mb-0.5">{item.name}</div>
                          <div className="text-xs text-muted-foreground font-medium">
                            {item.quantity} sold
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/30 dark:bg-muted/20 mb-3">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No items sold today</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Items will appear here once sold</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
