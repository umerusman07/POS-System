"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Loader2, RefreshCw, CheckCircle, XCircle, Eye, Calendar as CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { getAllOrders, type Order as ApiOrder, type OrderStatus as ApiOrderStatus, type OrderType as ApiOrderType } from "@/lib/api/orders"
import { getDashboardStats } from "@/lib/api/dashboard"

type OrderStatus = "DRAFT" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "PICKED_UP" | "FINISHED" | "CANCELLED"
type OrderType = "DINE" | "TAKEAWAY" | "DELIVERY"

interface Order {
  id: string
  orderNumber: string
  type: OrderType
  status: OrderStatus
  items: { name: string; quantity: number; price: number }[]
  subtotal: number
  deliveryCharges: number
  discount: number
  total: number
  customer?: { name: string; phone: string; address?: string }
  createdAt: string // Display time
  createdAtFull: string // Full ISO date string for filtering
  paymentStatus: "PAID" | "UNPAID"
}

const statusColors: Record<OrderStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PREPARING: "bg-warning/20 text-warning",
  READY: "bg-info/20 text-info",
  OUT_FOR_DELIVERY: "bg-blue-500/20 text-blue-500",
  DELIVERED: "bg-success/20 text-success",
  PICKED_UP: "bg-success/20 text-success",
  FINISHED: "bg-success/20 text-success",
  CANCELLED: "bg-destructive/20 text-destructive",
}

// Convert API order to display order
const convertApiOrderToDisplay = (apiOrder: ApiOrder): Order => {
  const items = (apiOrder.orderLines || []).map(line => ({
    name: line.nameAtSale || "Unknown Item",
    quantity: typeof line.quantity === 'number' ? line.quantity : parseInt(String(line.quantity)) || 0,
    price: typeof line.unitPriceAtSale === 'number' ? line.unitPriceAtSale : parseFloat(String(line.unitPriceAtSale)) || 0
  }))

  const customer = apiOrder.customerName || apiOrder.customerPhone ? {
    name: apiOrder.customerName || "",
    phone: apiOrder.customerPhone || "",
    address: apiOrder.customerAddress || undefined
  } : undefined

  let createdAt = "N/A"
  try {
    if (apiOrder.createdAt) {
      createdAt = new Date(apiOrder.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    }
  } catch (error) {
    console.error("Error parsing date:", error)
  }

  // Ensure values are numbers
  const subtotalValue = typeof apiOrder.subtotal === 'number' 
    ? apiOrder.subtotal 
    : typeof apiOrder.subtotal === 'string'
      ? parseFloat(apiOrder.subtotal) || 0
      : 0

  const deliveryChargesValue = typeof apiOrder.deliveryCharges === 'number'
    ? apiOrder.deliveryCharges
    : typeof apiOrder.deliveryCharges === 'string'
      ? parseFloat(apiOrder.deliveryCharges) || 0
      : 0

  const discountValue = typeof apiOrder.discount === 'number'
    ? apiOrder.discount
    : typeof apiOrder.discount === 'string'
      ? parseFloat(apiOrder.discount) || 0
      : 0

  const totalValue = typeof apiOrder.total === 'number' 
    ? apiOrder.total 
    : typeof apiOrder.total === 'string' 
      ? parseFloat(apiOrder.total) || 0
      : subtotalValue + deliveryChargesValue - discountValue

  return {
    id: apiOrder.id,
    orderNumber: apiOrder.orderNumber || "N/A",
    type: apiOrder.orderType,
    status: apiOrder.status,
    items,
    subtotal: subtotalValue,
    deliveryCharges: deliveryChargesValue,
    discount: discountValue,
    total: totalValue,
    customer,
    createdAt,
    createdAtFull: apiOrder.createdAt || new Date().toISOString(), // Store full ISO date
    paymentStatus: apiOrder.paymentStatus || "UNPAID"
  }
}

interface CompletedOrdersPanelProps {
  viewType: "completed" | "cancelled"
}

/**
 * Helper function to check if a date falls within the custom day cycle (6 AM to 5 AM next day)
 */
const isWithinCustomDayCycle = (orderDate: Date, targetDate: Date): boolean => {
  // Create the start of the cycle (6 AM on target date)
  const cycleStart = new Date(targetDate)
  cycleStart.setHours(6, 0, 0, 0) // 6:00 AM
  
  // Create the end of the cycle (5 AM next day)
  const cycleEnd = new Date(targetDate)
  cycleEnd.setDate(cycleEnd.getDate() + 1)
  cycleEnd.setHours(5, 0, 0, 0) // 5:00 AM next day
  
  return orderDate >= cycleStart && orderDate < cycleEnd
}

/**
 * Get day cycle key from an order date
 */
const getDayCycleKey = (orderDate: Date): string => {
  let cycleDate = new Date(orderDate)
  
  // If order is before 6 AM, it belongs to previous day's cycle
  if (orderDate.getHours() < 6) {
    cycleDate.setDate(cycleDate.getDate() - 1)
  }
  
  // Set to start of the day for the cycle
  cycleDate.setHours(0, 0, 0, 0)
  
  // Format date like "12-01-2026/12-02-26"
  const startDate = cycleDate
  const endDate = new Date(cycleDate)
  endDate.setDate(endDate.getDate() + 1)
  
  return `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}/${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getFullYear()).slice(-2)}`
}

export function CompletedOrdersPanel({ viewType }: CompletedOrdersPanelProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setIsLoading(true)
      
      const filters: {
        status?: ApiOrderStatus
        page?: number
        limit?: number
      } = {
        status: viewType === "completed" ? "FINISHED" : "CANCELLED",
        limit: 100 // Use max allowed limit
      }

      // Fetch orders
      const response = await getAllOrders(filters)
      const displayOrders = response.orders.map(convertApiOrderToDisplay)
      setOrders(displayOrders)

    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load orders",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [viewType, toast])

  // Reset date filter when view type changes
  useEffect(() => {
    setSelectedDate(undefined)
  }, [viewType])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Filter by date if selected
    if (selectedDate) {
      const orderDate = new Date(order.createdAtFull)
      // Check if order falls within the selected date's day cycle (6 AM to 5 AM next day)
      const cycleDate = new Date(selectedDate)
      const isInCycle = isWithinCustomDayCycle(orderDate, cycleDate)
      return matchesSearch && isInCycle
    }
    
    return matchesSearch
  })

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {viewType === "completed" ? "Completed Orders" : "Cancelled Orders"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {viewType === "completed" ? "All finished orders" : "All cancelled orders"}
            {filteredOrders.length !== orders.length && (
              <span className="ml-2">
                • Showing {filteredOrders.length} of {orders.length} orders
              </span>
            )}
            {selectedDate && (
              <span className="ml-2 text-primary">
                • Filtered by: {format(selectedDate, "dd-MM-yyyy")} (6 AM - 5 AM cycle)
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={isRefreshing}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Search and Day Filter */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-secondary pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[280px] justify-start text-left font-normal bg-secondary",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "dd-MM-yyyy")
                  ) : (
                    <span>Select date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    setCalendarOpen(false)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDate(undefined)}
                className="h-10 w-10 shrink-0"
                title="Clear date filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {selectedDate && (
          <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
            <strong>Note:</strong> Day cycle runs from 6:00 AM to 5:00 AM next day. Showing orders for: {format(selectedDate, "dd-MM-yyyy")}
          </div>
        )}
      </div>

      {/* Orders Grid */}
      <ScrollArea className="flex-1 h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 text-6xl">
              {viewType === "completed" ? <CheckCircle className="h-16 w-16 text-muted-foreground" /> : <XCircle className="h-16 w-16 text-muted-foreground" />}
            </div>
            <p className="text-lg font-semibold text-foreground">No {viewType === "completed" ? "completed" : "cancelled"} orders found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {selectedDate 
                ? `No orders found for the selected date. Try selecting a different date or clear the filter.`
                : viewType === "completed" 
                  ? "Completed orders will appear here" 
                  : "Cancelled orders will appear here"}
            </p>
            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(undefined)}
                className="mt-4"
              >
                Clear Date Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 pr-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="group flex flex-col rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">{order.orderNumber}</span>
                  <Badge className={cn(statusColors[order.status], "text-[10px] px-1.5 py-0.5")}>{order.status}</Badge>
                </div>

                <div className="mb-2 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{order.type}</Badge>
                  <span className="text-[10px] text-muted-foreground">{order.createdAt}</span>
                </div>

                <div className="mb-2 flex-1 space-y-0.5">
                  {order.items.slice(0, 2).map((item, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      {item.quantity}x {item.name}
                    </p>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-[10px] text-muted-foreground">+{order.items.length - 2} more items</p>
                  )}
                </div>

                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base font-bold text-primary">PKR {(typeof order.total === 'number' ? order.total : parseFloat(String(order.total)) || 0).toFixed(2)}</span>
                  <Badge variant={order.paymentStatus === "PAID" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                    {order.paymentStatus}
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1.5 hover:bg-secondary/60 hover:border-primary/40 hover:text-foreground text-foreground font-medium text-[10px] h-7"
                  onClick={() => setSelectedOrder(order)}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  View Details
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Order Detail Drawer */}
      <Sheet open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <SheetContent className="bg-card w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
            <SheetTitle className="text-2xl font-bold text-foreground">Order Details</SheetTitle>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Order #{selectedOrder?.orderNumber}</p>
          </SheetHeader>
          {selectedOrder && (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-6 py-4 space-y-5">
                {/* Status and Type Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pb-4 border-b border-border/30">
                  <Badge className={cn(statusColors[selectedOrder.status], "px-3 py-1.5 text-xs font-semibold shadow-sm")}>
                    {selectedOrder.status}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1.5 text-xs font-semibold border-border/60 bg-secondary/40">
                    {selectedOrder.type}
                  </Badge>
                  <Badge 
                    variant={selectedOrder.paymentStatus === "PAID" ? "default" : "secondary"}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold",
                      selectedOrder.paymentStatus === "PAID" ? "bg-green-600 hover:bg-green-700 text-white shadow-sm" : ""
                    )}
                  >
                    {selectedOrder.paymentStatus}
                  </Badge>
                </div>

                {/* Customer Information */}
                {selectedOrder.customer && (selectedOrder.customer.name || selectedOrder.customer.phone || selectedOrder.customer.address) && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 space-y-3 shadow-sm">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border/30 text-center">Customer Information</h4>
                    <div className="space-y-2.5">
                      {(selectedOrder.customer.name || selectedOrder.customer.phone) && (
                        <div className="flex items-center gap-4">
                          {selectedOrder.customer.name && (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs text-muted-foreground font-semibold">Name:</span>
                              <span className="text-sm font-medium text-foreground">{selectedOrder.customer.name}</span>
                            </div>
                          )}
                          {selectedOrder.customer.phone && (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs text-muted-foreground font-semibold">Phone:</span>
                              <span className="text-sm font-medium text-foreground">{selectedOrder.customer.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedOrder.customer.address && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground min-w-[70px] font-semibold">Address:</span>
                          <span className="text-sm font-medium text-foreground flex-1">{selectedOrder.customer.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-center pb-2 border-b border-border/30">Order Items</h4>
                  <div className="rounded-xl border border-border/50 bg-secondary/20 divide-y divide-border/50 overflow-hidden">
                    {selectedOrder.items.map((item, idx) => {
                      const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0
                      const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity)) || 0
                      const itemTotal = price * quantity
                      return (
                        <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-secondary/40 transition-colors">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded-md border border-border/30">
                                {quantity}x
                              </span>
                              <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">PKR {price.toFixed(2)} each</span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-base font-bold text-primary">PKR {itemTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-center pb-2 border-b border-border/30">Order Summary</h4>
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium text-foreground">PKR {selectedOrder.subtotal?.toFixed(2) || "0.00"}</span>
                    </div>
                    {selectedOrder.deliveryCharges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Charges</span>
                        <span className="font-medium text-foreground">PKR {selectedOrder.deliveryCharges.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-green-600">-PKR {selectedOrder.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-sm font-bold text-foreground uppercase tracking-wider">Total Amount</span>
                      <span className="text-2xl font-bold text-primary">
                        PKR {(typeof selectedOrder.total === 'number' ? selectedOrder.total : parseFloat(String(selectedOrder.total)) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Date */}
                {selectedOrder.createdAt && (
                  <div className="pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground text-center font-medium">
                      Created: {new Date(selectedOrder.createdAtFull).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
