"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { CheckCircle, XCircle, Loader2, RefreshCw, TrendingUp, Package, DollarSign, Calendar as CalendarIcon, Clock, ShoppingCart, Utensils, ShoppingBag, Truck, CreditCard, Banknote, BarChart3, Award, X, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { getDashboardStats, type DashboardStats, type DayHistoryItem, type PeriodStats } from "@/lib/api/dashboard"
import { CompletedOrdersPanel } from "./completed-orders-panel"
import { LiveDayHistoryPanel } from "./live-day-history-panel"
import { HistoricalPeriodPanel } from "./historical-period-panel"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

type ViewType = "dashboard" | "completed" | "cancelled" | "day-history" | "historical-period"

export function DashboardPanel() {
  const { toast } = useToast()
  const [viewType, setViewType] = useState<ViewType>("dashboard")
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activePeriod, setActivePeriod] = useState<"day" | "month" | "year">("day")
  const [selectedPaymentDate, setSelectedPaymentDate] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [historicalPeriodType, setHistoricalPeriodType] = useState<"day" | "month" | "year" | null>(null)
  const [historicalPeriodValue, setHistoricalPeriodValue] = useState<string | null>(null)
  const [daySearchQuery, setDaySearchQuery] = useState("")
  const [monthSearchQuery, setMonthSearchQuery] = useState("")
  const [yearSearchQuery, setYearSearchQuery] = useState("")
  const isInitialLoad = useRef(true)

  const fetchStats = useCallback(async () => {
    try {
      setIsRefreshing(true)
      if (isInitialLoad.current) {
        setIsLoading(true)
        isInitialLoad.current = false
      }
      
      const data = await getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load dashboard statistics",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [toast]) // Removed 'stats' from dependencies to prevent interval reset

  // Initial fetch on mount
  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Auto-refresh every 10 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
    }, 10000) // Refresh every 10 seconds for more responsive updates

    return () => clearInterval(interval)
  }, [fetchStats])

  if (viewType === "completed") {
    return <CompletedOrdersPanel viewType="completed" />
  }

  if (viewType === "cancelled") {
    return <CompletedOrdersPanel viewType="cancelled" />
  }

  if (viewType === "day-history") {
    return <LiveDayHistoryPanel onBack={() => setViewType("dashboard")} />
  }

  if (viewType === "historical-period" && historicalPeriodType && historicalPeriodValue) {
    return (
      <HistoricalPeriodPanel
        onBack={() => {
          setViewType("dashboard")
          setHistoricalPeriodType(null)
          setHistoricalPeriodValue(null)
        }}
        periodType={historicalPeriodType}
        periodValue={historicalPeriodValue}
      />
    )
  }

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
            <p className="text-muted-foreground">Failed to load dashboard statistics</p>
            <Button onClick={fetchStats} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Convert day history object to array sorted by date (most recent first)
  const dayHistoryArrayRaw = stats.dayHistory ? Object.values(stats.dayHistory).sort((a, b) => 
    new Date(b.cycleStart).getTime() - new Date(a.cycleStart).getTime()
  ) : []

  // Filter day history by search query
  const dayHistoryArray = daySearchQuery 
    ? dayHistoryArrayRaw.filter(day => 
        day.date.toLowerCase().includes(daySearchQuery.toLowerCase()) ||
        format(new Date(day.cycleStart), "dd-MM-yyyy").includes(daySearchQuery) ||
        format(new Date(day.cycleStart), "MMM dd, yyyy").toLowerCase().includes(daySearchQuery.toLowerCase())
      )
    : dayHistoryArrayRaw

  // Convert monthly stats to array sorted by period (most recent first)
  const monthlyArrayRaw = stats.monthly ? Object.entries(stats.monthly)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value })) : []

  // Filter monthly by search query
  const monthlyArray = monthSearchQuery
    ? monthlyArrayRaw.filter(month =>
        month.period.toLowerCase().includes(monthSearchQuery.toLowerCase()) ||
        month.key.toLowerCase().includes(monthSearchQuery.toLowerCase())
      )
    : monthlyArrayRaw

  // Convert yearly stats to array sorted by period (most recent first)
  const yearlyArrayRaw = stats.yearly ? Object.entries(stats.yearly)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, value]) => ({ key, ...value })) : []

  // Filter yearly by search query
  const yearlyArray = yearSearchQuery
    ? yearlyArrayRaw.filter(year =>
        year.period.includes(yearSearchQuery) ||
        year.key.includes(yearSearchQuery)
      )
    : yearlyArrayRaw

  const handleDayClick = (dayDate: string) => {
    setHistoricalPeriodType("day")
    setHistoricalPeriodValue(dayDate)
    setViewType("historical-period")
  }

  const handleMonthClick = (monthKey: string) => {
    setHistoricalPeriodType("month")
    setHistoricalPeriodValue(monthKey)
    setViewType("historical-period")
  }

  const handleYearClick = (yearKey: string) => {
    setHistoricalPeriodType("year")
    setHistoricalPeriodValue(yearKey)
    setViewType("historical-period")
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header with Action Buttons */}
      <div className="border-b border-border/50 bg-gradient-to-r from-green-200/70 via-green-100/50 to-card/95 dark:from-green-800/60 dark:via-green-900/45 dark:to-card/95 backdrop-blur-sm px-6 py-3 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Dashboard</h1>
            <p className="text-xs text-muted-foreground font-medium">View analytics and statistics</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={isRefreshing}
              className="shrink-0 border-border/50 hover:border-border"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={() => setViewType("day-history")}
              className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <History className="h-4 w-4" />
              Day History
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={() => setViewType("completed")}
              className="gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <CheckCircle className="h-4 w-4" />
              Completed Orders
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={() => setViewType("cancelled")}
              className="gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <XCircle className="h-4 w-4" />
              Cancelled Orders
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-6 space-y-6">
          {/* Overview Cards - Professional Redesign */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {/* Total Orders Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50/50 via-card to-card dark:from-blue-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Total Orders
                  </CardTitle>
                  <div className="text-xl font-bold text-foreground mt-1">{stats.overview.totalOrders}</div>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                  <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <p className="text-xs font-medium text-muted-foreground/80">All time orders</p>
              </CardContent>
            </Card>

            {/* Completed Orders Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50/50 via-card to-card dark:from-green-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 dark:bg-green-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-green-500/20 dark:group-hover:bg-green-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Completed
                  </CardTitle>
                  <div className="text-xl font-bold text-foreground mt-1">{stats.overview.completedOrders}</div>
                </div>
                <div className="p-2 rounded-xl bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: stats.overview.totalOrders > 0 
                          ? `${((stats.overview.completedOrders / stats.overview.totalOrders) * 100)}%`
                          : "0%"
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 min-w-[2.5rem] text-right">
                    {stats.overview.totalOrders > 0 
                      ? `${((stats.overview.completedOrders / stats.overview.totalOrders) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Cancelled Orders Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-red-50/50 via-card to-card dark:from-red-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 dark:bg-red-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-red-500/20 dark:group-hover:bg-red-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Cancelled
                  </CardTitle>
                  <div className="text-xl font-bold text-foreground mt-1">{stats.overview.cancelledOrders}</div>
                </div>
                <div className="p-2 rounded-xl bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 dark:border-red-500/30 group-hover:scale-110 transition-transform duration-300">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-600 dark:from-red-400 dark:to-red-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: stats.overview.totalOrders > 0 
                          ? `${((stats.overview.cancelledOrders / stats.overview.totalOrders) * 100)}%`
                          : "0%"
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 min-w-[2.5rem] text-right">
                    {stats.overview.totalOrders > 0 
                      ? `${((stats.overview.cancelledOrders / stats.overview.totalOrders) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Sales Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-primary/5 via-card to-card dark:from-primary/10 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/20 dark:group-hover:bg-primary/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Total Sales
                  </CardTitle>
                  <div className="text-lg font-bold text-foreground mt-1 leading-tight">PKR {stats.overview.totalRevenue.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <p className="text-xs font-medium text-muted-foreground/80">Total revenue</p>
              </CardContent>
            </Card>

            {/* Total Delivery Charges Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-teal-50/50 via-card to-card dark:from-teal-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 dark:bg-teal-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-teal-500/20 dark:group-hover:bg-teal-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Delivery Charges
                  </CardTitle>
                  <div className="text-lg font-bold text-foreground mt-1 leading-tight">PKR {(stats.overview.totalDeliveryCharges || 0).toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 border border-teal-500/20 dark:border-teal-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Truck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <p className="text-xs font-medium text-muted-foreground/80">Total delivery fees</p>
              </CardContent>
            </Card>

            {/* Items Sold Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-50/50 via-card to-card dark:from-orange-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 dark:bg-orange-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-500/20 dark:group-hover:bg-orange-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Items Sold
                  </CardTitle>
                  <div className="text-xl font-bold text-foreground mt-1">{stats.overview.totalItemsQuantity}</div>
                </div>
                <div className="p-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 dark:border-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Package className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <p className="text-xs font-medium text-muted-foreground/80">Total quantity</p>
              </CardContent>
            </Card>

            {/* Total Discount Card */}
            <Card className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50/50 via-card to-card dark:from-purple-950/20 dark:via-card dark:to-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 dark:bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/10 transition-colors duration-300"></div>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-3 relative z-10">
                <div className="space-y-0.5">
                  <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide">
                    Total Discount
                  </CardTitle>
                  <div className="text-lg font-bold text-foreground mt-1 leading-tight">PKR {(stats.overview.totalDiscount || 0).toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 relative z-10">
                <p className="text-xs font-medium text-muted-foreground/80">Discounts given</p>
              </CardContent>
            </Card>
          </div>

          {/* Live Data Section - Payment Methods & Orders by Type */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Payment Methods */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Payment Methods</CardTitle>
                      <CardDescription className="text-xs mt-0.5">Sales by payment method</CardDescription>
                    </div>
                  </div>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] border-border/50 hover:border-border hover:bg-muted/50">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        {selectedPaymentDate ? format(selectedPaymentDate, "dd-MM-yyyy") : "All"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedPaymentDate}
                        onSelect={(date) => {
                          setSelectedPaymentDate(date)
                          setCalendarOpen(false)
                        }}
                        initialFocus
                      />
                      {selectedPaymentDate && (
                        <div className="p-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              setSelectedPaymentDate(undefined)
                              setCalendarOpen(false)
                            }}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Filter
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5">
                {(() => {
                  // Filter payment methods by selected date if any
                  let cashAmount = stats.orderSummary?.paymentMethods.CASH.amount || 0
                  let cashCount = stats.orderSummary?.paymentMethods.CASH.count || 0
                  let onlineAmount = stats.orderSummary?.paymentMethods.ONLINE.amount || 0
                  let onlineCount = stats.orderSummary?.paymentMethods.ONLINE.count || 0
                  
                  if (selectedPaymentDate && stats.dayHistory) {
                    // Find the day cycle for selected date using day cycle logic
                    // If order is before 6 AM, it belongs to previous day's cycle
                    let cycleDate = new Date(selectedPaymentDate)
                    if (selectedPaymentDate.getHours() < 6) {
                      cycleDate.setDate(cycleDate.getDate() - 1)
                    }
                    cycleDate.setHours(0, 0, 0, 0)
                    
                    // Format to match day history key format: "DD-MM-YYYY/DD-MM-YY"
                    const startDate = cycleDate
                    const endDate = new Date(cycleDate)
                    endDate.setDate(endDate.getDate() + 1)
                    const dateKey = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}/${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getFullYear()).slice(-2)}`
                    
                    // Find matching day cycle
                    const dayKey = Object.keys(stats.dayHistory).find(key => key === dateKey)
                    
                    if (dayKey && stats.dayHistory[dayKey]) {
                      const dayData = stats.dayHistory[dayKey]
                      if (dayData.paymentMethods) {
                        cashAmount = dayData.paymentMethods.CASH?.amount || 0
                        cashCount = dayData.paymentMethods.CASH?.count || 0
                        onlineAmount = dayData.paymentMethods.ONLINE?.amount || 0
                        onlineCount = dayData.paymentMethods.ONLINE?.count || 0
                      }
                    } else {
                      cashAmount = 0
                      cashCount = 0
                      onlineAmount = 0
                      onlineCount = 0
                    }
                  }
                  
                  const totalAmount = cashAmount + onlineAmount
                  const cashPercentage = totalAmount > 0 ? (cashAmount / totalAmount) * 100 : 0
                  const onlinePercentage = totalAmount > 0 ? (onlineAmount / totalAmount) * 100 : 0
                  
                  return (
                    <>
                      <div className="group p-3 rounded-xl bg-gradient-to-br from-green-50/80 to-green-50/40 dark:from-green-950/30 dark:to-green-950/10 border border-green-200/60 dark:border-green-900/60 hover:border-green-300 dark:hover:border-green-800 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30">
                              <Banknote className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-semibold text-foreground">Cash</span>
                          </div>
                          <Badge variant="outline" className="bg-green-100/80 dark:bg-green-900/40 text-[10px] border-green-300/50 dark:border-green-800/50">
                            {cashCount} orders
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                            PKR {cashAmount.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-green-100/50 dark:bg-green-900/30 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-green-600 dark:from-green-400 dark:to-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${cashPercentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-green-600/80 dark:text-green-400/80 min-w-[2.5rem] text-right">
                              {cashPercentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="group p-3 rounded-xl bg-gradient-to-br from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 border border-blue-200/60 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30">
                              <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-semibold text-foreground">Online</span>
                          </div>
                          <Badge variant="outline" className="bg-blue-100/80 dark:bg-blue-900/40 text-[10px] border-blue-300/50 dark:border-blue-800/50">
                            {onlineCount} orders
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            PKR {onlineAmount.toLocaleString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-blue-100/50 dark:bg-blue-900/30 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${onlinePercentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-blue-600/80 dark:text-blue-400/80 min-w-[2.5rem] text-right">
                              {onlinePercentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Orders by Type */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Orders by Type</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Distribution by order type</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5">
                <div className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-blue-50/40 dark:from-blue-950/30 dark:to-blue-950/10 border border-blue-200/60 dark:border-blue-900/60 hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30">
                      <Utensils className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Dine In</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">{stats.orderSummary?.ordersByType.DINE || 0}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                      {stats.overview.totalOrders > 0 
                        ? `${((stats.orderSummary?.ordersByType.DINE || 0) / stats.overview.totalOrders * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
                
                <div className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-green-50/80 to-green-50/40 dark:from-green-950/30 dark:to-green-950/10 border border-green-200/60 dark:border-green-900/60 hover:border-green-300 dark:hover:border-green-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30">
                      <ShoppingBag className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Takeaway</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform duration-200">{stats.orderSummary?.ordersByType.TAKEAWAY || 0}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                      {stats.overview.totalOrders > 0 
                        ? `${((stats.orderSummary?.ordersByType.TAKEAWAY || 0) / stats.overview.totalOrders * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
                
                <div className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-50/80 to-purple-50/40 dark:from-purple-950/30 dark:to-purple-950/10 border border-purple-200/60 dark:border-purple-900/60 hover:border-purple-300 dark:hover:border-purple-800 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/20 dark:border-purple-500/30">
                      <Truck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Delivery</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-200">{stats.orderSummary?.ordersByType.DELIVERY || 0}</div>
                    <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                      {stats.overview.totalOrders > 0 
                        ? `${((stats.orderSummary?.ordersByType.DELIVERY || 0) / stats.overview.totalOrders * 100).toFixed(1)}%`
                        : "0%"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Items & Deals */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Items */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Top Items</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Most sold items by quantity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <ScrollArea className="h-[240px]">
                  {stats.topItems && stats.topItems.length > 0 ? (
                    <div className="space-y-2 pr-4">
                      {stats.topItems.map((item, index) => {
                        const isTopThree = index < 3
                        return (
                          <div
                            key={item.id}
                            className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-muted/20 dark:from-card dark:to-muted/10 hover:border-border hover:bg-muted/50 dark:hover:bg-muted/30 hover:shadow-md transition-all duration-200"
                          >
                            <div className={cn(
                              "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border transition-all duration-200",
                              isTopThree 
                                ? "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary/40 text-primary shadow-sm group-hover:scale-110" 
                                : "bg-muted/50 dark:bg-muted/30 border-border/50 text-muted-foreground group-hover:scale-105"
                            )}>
                              #{index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate mb-0.5">{item.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-medium">{item.quantity} sold</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="font-semibold text-primary">PKR {item.revenue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="p-3 rounded-full bg-muted/50 dark:bg-muted/30 mb-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">No items data available</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Items will appear here once sold</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Deals */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Top Deals</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Most sold deals by quantity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <ScrollArea className="h-[240px]">
                  {stats.topDeals && stats.topDeals.length > 0 ? (
                    <div className="space-y-2 pr-4">
                      {stats.topDeals.map((deal, index) => {
                        const isTopThree = index < 3
                        return (
                          <div
                            key={deal.id}
                            className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-border/50 bg-gradient-to-r from-card to-muted/20 dark:from-card dark:to-muted/10 hover:border-border hover:bg-muted/50 dark:hover:bg-muted/30 hover:shadow-md transition-all duration-200"
                          >
                            <div className={cn(
                              "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border transition-all duration-200",
                              isTopThree 
                                ? "bg-gradient-to-br from-primary/20 to-primary/10 dark:from-primary/30 dark:to-primary/20 border-primary/30 dark:border-primary/40 text-primary shadow-sm group-hover:scale-110" 
                                : "bg-muted/50 dark:bg-muted/30 border-border/50 text-muted-foreground group-hover:scale-105"
                            )}>
                              #{index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate mb-0.5">{deal.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-medium">{deal.quantity} sold</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="font-semibold text-primary">PKR {deal.revenue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="p-3 rounded-full bg-muted/50 dark:bg-muted/30 mb-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">No deals data available</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Deals will appear here once sold</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Period-based Statistics */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Period Statistics</CardTitle>
                  <CardDescription className="text-xs mt-0.5">View statistics by day, month, or year</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs value={activePeriod} onValueChange={(v) => setActivePeriod(v as "day" | "month" | "year")}>
                <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 dark:bg-muted/30 border border-border/50 p-1 rounded-lg">
                  <TabsTrigger 
                    value="day" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200"
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Day History
                  </TabsTrigger>
                  <TabsTrigger 
                    value="month" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger 
                    value="year" 
                    className="text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200"
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                    Yearly
                  </TabsTrigger>
                </TabsList>

                {/* Day History Tab */}
                <TabsContent value="day" className="mt-6">
                  <div className="space-y-4">
                    <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-4 mb-4">
                      <p className="text-xs font-medium text-foreground">
                        <span className="font-semibold text-primary">Note:</span> Day cycle runs from 6:00 AM to 5:00 AM next day. Each day record shows orders within this cycle. Click on any day card to view detailed statistics.
                      </p>
                    </div>
                    
                    {/* Search Input for Days */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search days by date (e.g., 12-01-2026, Jan 12, 2026)"
                        value={daySearchQuery}
                        onChange={(e) => setDaySearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {dayHistoryArray.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-full bg-muted/50 dark:bg-muted/30 mb-3">
                          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No day history available</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Day history will appear here once orders are placed</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {dayHistoryArray.map((day, idx) => {
                          // Parse date for display - format is "DD-MM-YYYY/DD-MM-YY" (e.g., "12-01-2026/12-02-26")
                          const [startPart, endPart] = day.date.split("/")
                          const [startDay, startMonth, startYear] = startPart.split("-").map(Number)
                          const [endDay, endMonth, endYearTwoDigit] = endPart.split("-").map(Number)
                          
                          // Format dates as "DD-MM-YY to DD-MM-YY"
                          // Start date: use last 2 digits of year, end date: already 2 digits
                          const displayDate = `${String(startDay).padStart(2, '0')}-${String(startMonth).padStart(2, '0')}-${String(startYear).slice(-2)} to ${String(endDay).padStart(2, '0')}-${String(endMonth).padStart(2, '0')}-${String(endYearTwoDigit).padStart(2, '0')}`
                          
                          return (
                            <Card 
                              key={idx} 
                              className="group border border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 bg-gradient-to-br from-green-200/70 via-green-100/50 to-green-50/30 dark:from-green-800/60 dark:via-green-900/45 dark:to-green-950/30 cursor-pointer"
                              onClick={() => handleDayClick(day.date)}
                            >
                              <CardContent className="p-4 flex items-center justify-center min-h-[80px]">
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                                    {displayDate}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Monthly Tab */}
                <TabsContent value="month" className="mt-6">
                  <div className="space-y-4">
                    <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-4 mb-4">
                      <p className="text-xs font-medium text-foreground">
                        <span className="font-semibold text-primary">Note:</span> Click on any month card to view detailed statistics for that month.
                      </p>
                    </div>
                    
                    {/* Search Input for Months */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search months by name (e.g., January, Jan 2026, 2026-01)"
                        value={monthSearchQuery}
                        onChange={(e) => setMonthSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {monthlyArray.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-full bg-muted/50 dark:bg-muted/30 mb-3">
                          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No monthly data available</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Monthly statistics will appear here once orders are placed</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {monthlyArray.map((month, idx) => (
                          <Card 
                            key={idx} 
                            className="group border border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 bg-gradient-to-br from-green-200/70 via-green-100/50 to-green-50/30 dark:from-green-800/60 dark:via-green-900/45 dark:to-green-950/30 cursor-pointer"
                            onClick={() => handleMonthClick(month.key)}
                          >
                            <CardContent className="p-4 flex items-center justify-center min-h-[80px]">
                              <div className="text-center">
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {month.period}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Yearly Tab */}
                <TabsContent value="year" className="mt-6">
                  <div className="space-y-4">
                    <div className="rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20 dark:border-primary/30 p-4 mb-4">
                      <p className="text-xs font-medium text-foreground">
                        <span className="font-semibold text-primary">Note:</span> Click on any year card to view detailed statistics for that year.
                      </p>
                    </div>
                    
                    {/* Search Input for Years */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search years (e.g., 2026, 2025)"
                        value={yearSearchQuery}
                        onChange={(e) => setYearSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    {yearlyArray.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-full bg-muted/50 dark:bg-muted/30 mb-3">
                          <TrendingUp className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No yearly data available</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Yearly statistics will appear here once orders are placed</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {yearlyArray.map((year, idx) => (
                          <Card 
                            key={idx} 
                            className="group border border-border/50 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 bg-gradient-to-br from-green-200/70 via-green-100/50 to-green-50/30 dark:from-green-800/60 dark:via-green-900/45 dark:to-green-950/30 cursor-pointer"
                            onClick={() => handleYearClick(year.key)}
                          >
                            <CardContent className="p-4 flex items-center justify-center min-h-[80px]">
                              <div className="text-center">
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {year.period}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
