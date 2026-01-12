"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Filter, Eye, ChevronRight, ChevronLeft, Loader2, RefreshCw, X, Edit, Plus, Minus, Trash2, Utensils, CreditCard, DollarSign, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getAllOrders, updateOrderStatus, updateOrder, getOrderById, getMenuItemsForOrder, getDealsForOrder, type Order as ApiOrder, type OrderStatus as ApiOrderStatus, type OrderType as ApiOrderType } from "@/lib/api/orders"
import type { MenuItem as ApiMenuItem } from "@/lib/api/menu-items"
import type { Deal as ApiDeal } from "@/lib/api/deals"

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
  createdAt: string
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

const statusFilters: OrderStatus[] = ["DRAFT", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "PICKED_UP", "FINISHED", "CANCELLED"]
const typeFilters: OrderType[] = ["DINE", "TAKEAWAY", "DELIVERY"]

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
    paymentStatus: apiOrder.paymentStatus || "UNPAID"
  }
}

interface OrdersPanelProps {
  userRole?: "manager" | "user"
}

interface EditOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: ApiOrder | null
  onOrderUpdated: () => void
}

interface MenuItem {
  id: string
  name: string
  referenceNumber: string
  price: number
}

interface Deal {
  id: string
  name: string
  referenceNumber: string
  price: number
}

interface CartItem {
  id: string
  name: string
  referenceNumber: string
  price: number
  quantity: number
  productType: "ITEM" | "DEAL"
}

function EditOrderDialog({ open, onOpenChange, order, onOrderUpdated }: EditOrderDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [deliveryCharges, setDeliveryCharges] = useState("")
  const [discount, setDiscount] = useState("")
  const [orderType, setOrderType] = useState<ApiOrderType>("DINE")
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID")
  const [cart, setCart] = useState<CartItem[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch menu items and deals
  useEffect(() => {
    if (open && order) {
      const fetchData = async () => {
        try {
          setIsLoadingData(true)
          const [items, dealsData] = await Promise.all([
            getMenuItemsForOrder(),
            getDealsForOrder()
          ])
          
          const activeItems = items.map(item => ({
            id: item.id,
            name: item.name,
            referenceNumber: item.referenceNumber,
            price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
          }))
          
          const activeDeals = dealsData.map(deal => ({
            id: deal.id,
            name: deal.name,
            referenceNumber: deal.referenceNumber,
            price: typeof deal.price === 'string' ? parseFloat(deal.price) : deal.price,
          }))
          
          setMenuItems(activeItems)
          setDeals(activeDeals)
        } catch (error) {
          console.error("Error fetching data:", error)
          toast({
            title: "Error",
            description: "Failed to load menu items and deals",
            variant: "destructive",
          })
        } finally {
          setIsLoadingData(false)
        }
      }
      fetchData()
    }
  }, [open, order, toast])

  // Initialize form when order changes
  useEffect(() => {
    if (order) {
      setOrderType(order.orderType)
      setCustomerName(order.customerName || "")
      setCustomerPhone(order.customerPhone || "")
      setCustomerAddress(order.customerAddress || "")
      setDeliveryCharges(order.deliveryCharges?.toString() || "")
      setDiscount(order.discount?.toString() || "")
      setPaymentMethod(order.paymentMethod)
      setPaymentStatus(order.paymentStatus)
    }
  }, [order])

  // Convert order lines to cart items when menu items/deals are loaded
  useEffect(() => {
    if (order && menuItems.length > 0 && deals.length > 0) {
      const cartItems: CartItem[] = order.orderLines.map(line => {
        // Find the item or deal to get current price
        const item = menuItems.find(m => m.id === line.productId)
        const deal = deals.find(d => d.id === line.productId)
        const currentPrice = item?.price || deal?.price || parseFloat(line.unitPriceAtSale.toString())
        
        return {
          id: line.productId,
          name: line.nameAtSale,
          referenceNumber: item?.referenceNumber || deal?.referenceNumber || "",
          price: currentPrice,
          quantity: typeof line.quantity === 'number' ? line.quantity : parseInt(String(line.quantity)) || 0,
          productType: line.productType
        }
      })
      setCart(cartItems)
    } else if (order && (menuItems.length === 0 && deals.length === 0)) {
      // Fallback: use order line data directly if menu items/deals not loaded yet
      const cartItems: CartItem[] = order.orderLines.map(line => ({
        id: line.productId,
        name: line.nameAtSale,
        referenceNumber: "",
        price: parseFloat(line.unitPriceAtSale.toString()),
        quantity: typeof line.quantity === 'number' ? line.quantity : parseInt(String(line.quantity)) || 0,
        productType: line.productType
      }))
      setCart(cartItems)
    }
  }, [order, menuItems, deals])

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         deal.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const addMenuItemToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.productType === "ITEM")
      if (existing) {
        return prev.map((i) => (i.id === item.id && i.productType === "ITEM" ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { ...item, quantity: 1, productType: "ITEM" as const }]
    })
  }

  const addDealToCart = (deal: Deal) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === deal.id && i.productType === "DEAL")
      if (existing) {
        return prev.map((i) => (i.id === deal.id && i.productType === "DEAL" ? { ...i, quantity: i.quantity + 1 } : i))
      }
      return [...prev, { ...deal, quantity: 1, productType: "DEAL" as const }]
    })
  }

  const updateQuantity = (id: string, productType: "ITEM" | "DEAL", delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id && item.productType === productType ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0),
    )
  }

  const removeItem = (id: string, productType: "ITEM" | "DEAL") => {
    setCart((prev) => prev.filter((item) => !(item.id === id && item.productType === productType)))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryChargesNum = orderType === "DELIVERY" ? (parseFloat(deliveryCharges) || 0) : 0
  const discountNum = parseFloat(discount) || 0
  const total = subtotal + deliveryChargesNum - discountNum

  const handleSave = async () => {
    if (!order) return

    // Validate cart is not empty
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Order must have at least one item",
        variant: "destructive",
      })
      return
    }

    // Validate delivery orders
    if (orderType === "DELIVERY") {
      if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
        toast({
          title: "Error",
          description: "Delivery orders require customer name, phone, and address",
          variant: "destructive",
        })
        return
      }
      if (!deliveryCharges || parseFloat(deliveryCharges) <= 0) {
        toast({
          title: "Error",
          description: "Delivery orders require delivery charges",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsLoading(true)
      
      // Prepare order lines for update
      const orderLines = cart.map(item => ({
        productType: item.productType,
        productId: item.id,
        quantity: item.quantity
      }))

      const updateData: {
        orderType?: ApiOrderType
        customerName?: string | null
        customerPhone?: string | null
        customerAddress?: string | null
        deliveryCharges?: number
        discount?: number
        paymentMethod?: "CASH" | "ONLINE" | null
        paymentStatus?: "PAID" | "UNPAID"
        orderLines?: Array<{ productType: "ITEM" | "DEAL"; productId: string; quantity: number }>
      } = {
        orderType: orderType,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        customerAddress: customerAddress.trim() || null,
        deliveryCharges: orderType === "DELIVERY" ? (parseFloat(deliveryCharges) || 0) : undefined,
        discount: parseFloat(discount) || 0,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        orderLines: orderLines
      }

      await updateOrder(order.id, updateData)
      toast({
        title: "Success",
        description: `Order ${order.orderNumber} updated successfully`,
      })
      onOrderUpdated()
    } catch (error) {
      console.error("Error updating order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update order",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[98vw] w-[98vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with gradient */}
        <div className="shrink-0 border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-card/95 dark:from-primary/20 dark:via-primary/10 dark:to-card/95 px-6 py-4">
          <DialogHeader className="p-0">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Edit Order {order.orderNumber}
            </DialogTitle>
          </DialogHeader>
        </div>
        
        <div className="flex-1 min-h-0 overflow-hidden flex gap-6 p-6">
          {/* Left Side - Menu Items & Deals */}
          <div className="w-1/2 flex flex-col border-r border-border/50 pr-6 overflow-hidden min-h-0">
            <div className="mb-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-secondary/50 border-border/50 pl-10 h-10 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {isLoadingData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6 pr-4">
                  {/* Deals Section */}
                  {filteredDeals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/10 border border-orange-500/20">
                          <span className="text-lg">🔥</span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground">Hot Deals</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {filteredDeals.map((deal) => (
                          <button
                            key={deal.id}
                            onClick={() => addDealToCart(deal)}
                            className="group relative flex flex-col rounded-xl border border-border/50 bg-gradient-to-br from-orange-50/50 to-card dark:from-orange-950/20 dark:to-card p-3 text-left shadow-sm hover:shadow-md hover:border-primary/50 hover:border-2 transition-all duration-300"
                          >
                            <span className="text-xs font-bold text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">{deal.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono bg-secondary/50 border-border/60 px-1.5 py-0 w-fit mb-2">
                              {deal.referenceNumber}
                            </Badge>
                            <span className="text-sm font-bold text-primary mt-auto">PKR {deal.price.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Menu Items Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                        <Utensils className="h-4 w-4 text-primary" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground">Menu Items</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {filteredItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => addMenuItemToCart(item)}
                          className="group relative flex flex-col rounded-xl border border-border/50 bg-card p-3 text-left shadow-sm hover:shadow-md hover:border-primary/50 hover:border-2 transition-all duration-300"
                        >
                          <span className="text-xs font-bold text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">{item.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono bg-secondary/50 border-border/60 px-1.5 py-0 w-fit mb-2">
                            {item.referenceNumber}
                          </Badge>
                          <span className="text-sm font-bold text-primary mt-auto">PKR {item.price.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Side - Order Details & Cart */}
          <div className="w-1/2 flex flex-col overflow-hidden min-h-0">
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-6 pr-4">
                {/* Order Type */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/20">
                      <Utensils className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Order Type</h4>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Delivery Type</label>
                    <Select
                      value={orderType}
                      onValueChange={(value) => {
                        setOrderType(value as ApiOrderType)
                        // Clear customer info if changing away from DELIVERY
                        if (value !== "DELIVERY") {
                          setCustomerName("")
                          setCustomerPhone("")
                          setCustomerAddress("")
                          setDeliveryCharges("")
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 bg-background border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DINE">DINE</SelectItem>
                        <SelectItem value="TAKEAWAY">TAKEAWAY</SelectItem>
                        <SelectItem value="DELIVERY">DELIVERY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 border border-blue-500/20">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Customer Information</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name{orderType === "DELIVERY" && " *"}</label>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Customer name"
                          className="h-10 bg-background border-border/50 focus:border-primary/50 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Phone{orderType === "DELIVERY" && " *"}</label>
                        <Input
                          value={customerPhone}
                          onChange={(e) => {
                            // Only allow numbers
                            const value = e.target.value.replace(/\D/g, '')
                            setCustomerPhone(value)
                          }}
                          placeholder="Customer phone"
                          className="h-10 bg-background border-border/50 focus:border-primary/50 focus:ring-primary/20"
                          type="tel"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Address{orderType === "DELIVERY" && " *"}</label>
                      <Textarea
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Customer address"
                        className="min-h-[70px] bg-background border-border/50 focus:border-primary/50 focus:ring-primary/20 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/20">
                      <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Payment Information</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payment Method</label>
                      <Select
                        value={paymentMethod || ""}
                        onValueChange={(value) => setPaymentMethod(value === "CASH" || value === "ONLINE" ? value : null)}
                      >
                        <SelectTrigger className="h-10 bg-background border-border/50">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">CASH</SelectItem>
                          <SelectItem value="ONLINE">ONLINE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payment Status</label>
                      <Select
                        value={paymentStatus}
                        onValueChange={(value) => setPaymentStatus(value as "PAID" | "UNPAID")}
                      >
                        <SelectTrigger className="h-10 bg-background border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNPAID">UNPAID</SelectItem>
                          <SelectItem value="PAID">PAID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Charges and Discount */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10 border border-purple-500/20">
                      <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Charges & Discount</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {orderType === "DELIVERY" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Delivery Charges</label>
                        <Input
                          type="number"
                          value={deliveryCharges}
                          onChange={(e) => setDeliveryCharges(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="h-10 bg-background border-border/50 focus:border-primary/50 focus:ring-primary/20"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Discount</label>
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="h-10 bg-background border-border/50 focus:border-primary/50 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Cart Items */}
                <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/40 to-secondary/20 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                      <Utensils className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Order Items</h4>
                    {cart.length > 0 && (
                      <Badge variant="outline" className="ml-auto bg-background/50 border-border/60">
                        {cart.length} {cart.length === 1 ? 'item' : 'items'}
                      </Badge>
                    )}
                  </div>
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 rounded-full bg-muted/30 dark:bg-muted/20">
                          <Utensils className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">No items in cart</p>
                        <p className="text-xs text-muted-foreground/70">Add items from the left panel</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={`${item.id}-${item.productType}`} className="group flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="font-semibold text-sm text-foreground truncate mb-1">{item.name}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-mono bg-secondary/50 border-border/60 px-1.5 py-0">
                                {item.referenceNumber}
                              </Badge>
                              <span className="text-xs font-medium text-primary">PKR {item.price.toFixed(2)} each</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                              onClick={() => updateQuantity(item.id, item.productType, -1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-10 text-center font-bold text-sm bg-secondary/50 px-2 py-1 rounded-md border border-border/30">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                              onClick={() => updateQuantity(item.id, item.productType, 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40"
                              onClick={() => removeItem(item.id, item.productType)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-5 shadow-md">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-primary/20 border border-primary/30">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Order Summary</h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground font-medium">Subtotal</span>
                      <span className="font-semibold text-foreground">PKR {subtotal.toFixed(2)}</span>
                    </div>
                    {orderType === "DELIVERY" && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground font-medium">Delivery Charges</span>
                        <span className="font-semibold text-foreground">PKR {deliveryChargesNum.toFixed(2)}</span>
                      </div>
                    )}
                    {discountNum > 0 && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground font-medium">Discount</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">-PKR {discountNum.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-primary/20">
                      <span className="font-bold text-base text-foreground">Total</span>
                      <span className="font-bold text-xl text-primary">PKR {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/50 pt-5 px-6 pb-6 bg-gradient-to-r from-card/50 to-card/95">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isLoading}
            className="h-10 px-6 border-border/50 hover:bg-secondary/80 font-medium"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || cart.length === 0}
            className="h-10 px-6 font-semibold shadow-md hover:shadow-lg transition-shadow"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OrdersPanel({ userRole = "user" }: OrdersPanelProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL")
  const [typeFilter, setTypeFilter] = useState<OrderType | "ALL">("ALL")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [orderToUpdatePayment, setOrderToUpdatePayment] = useState<Order | null>(null)
  const [newPaymentStatus, setNewPaymentStatus] = useState<"PAID" | "UNPAID">("PAID")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<ApiOrder | null>(null)
  const [backConfirmDialogOpen, setBackConfirmDialogOpen] = useState(false)
  const [orderToGoBack, setOrderToGoBack] = useState<Order | null>(null)
  const [previousStatus, setPreviousStatus] = useState<OrderStatus | null>(null)
  const isManager = userRole === "manager"

  const fetchOrders = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setIsLoading(true)
      
      const filters: {
        status?: ApiOrderStatus
        orderType?: ApiOrderType
        page?: number
        limit?: number
      } = {}

      if (statusFilter !== "ALL") {
        filters.status = statusFilter as ApiOrderStatus
      }
      if (typeFilter !== "ALL") {
        filters.orderType = typeFilter as ApiOrderType
      }

      const response = await getAllOrders(filters)
      const displayOrders = response.orders.map(convertApiOrderToDisplay)
      // Filter out FINISHED and CANCELLED orders from main orders page
      const activeOrders = displayOrders.filter(order => 
        order.status !== "FINISHED" && order.status !== "CANCELLED"
      )
      setOrders(activeOrders)
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
  }, [statusFilter, typeFilter, toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Refresh orders when component becomes visible (e.g., after creating an order)
  useEffect(() => {
    // Refresh on mount
    fetchOrders()
    const handleFocus = () => {
      fetchOrders()
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [fetchOrders])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const getNextAction = (order: Order): { label: string; action: OrderStatus } | null => {
    const { status, type } = order

    // Terminal statuses have no next action
    if (status === "FINISHED" || status === "CANCELLED") {
      return null
    }

    // Get next action based on order type and current status
    switch (type) {
      case "DINE":
        switch (status) {
          case "DRAFT":
            return { label: "Start Preparing", action: "PREPARING" }
          case "PREPARING":
            return { label: "Mark Ready", action: "READY" }
          case "READY":
            return { label: "Finish", action: "FINISHED" }
          default:
            return null
        }
      case "TAKEAWAY":
        switch (status) {
          case "DRAFT":
            return { label: "Start Preparing", action: "PREPARING" }
          case "PREPARING":
            return { label: "Mark Ready", action: "READY" }
          case "READY":
            return { label: "Picked Up", action: "PICKED_UP" }
          case "PICKED_UP":
            return { label: "Finish", action: "FINISHED" }
          default:
            return null
        }
      case "DELIVERY":
        switch (status) {
          case "DRAFT":
            return { label: "Start Preparing", action: "PREPARING" }
          case "PREPARING":
            return { label: "Mark Ready", action: "READY" }
          case "READY":
            return { label: "Out for Delivery", action: "OUT_FOR_DELIVERY" }
          case "OUT_FOR_DELIVERY":
            return { label: "Delivered", action: "DELIVERED" }
          case "DELIVERED":
            return { label: "Finish", action: "FINISHED" }
          default:
            return null
        }
      default:
        return null
    }
  }

  // Get previous status for manager back button
  const getPreviousStatus = (order: Order): OrderStatus | null => {
    const { status, type } = order

    // DRAFT is the first status, can't go back
    if (status === "DRAFT" || status === "CANCELLED") {
      return null
    }

    // Terminal statuses can't go back (unless manager wants to reopen)
    // For FINISHED, allow going back to previous status
    switch (type) {
      case "DINE":
        switch (status) {
          case "PREPARING":
            return "DRAFT"
          case "READY":
            return "PREPARING"
          case "FINISHED":
            return "READY"
          default:
            return null
        }
      case "TAKEAWAY":
        switch (status) {
          case "PREPARING":
            return "DRAFT"
          case "READY":
            return "PREPARING"
          case "PICKED_UP":
            return "READY"
          case "FINISHED":
            return "PICKED_UP"
          default:
            return null
        }
      case "DELIVERY":
        switch (status) {
          case "PREPARING":
            return "DRAFT"
          case "READY":
            return "PREPARING"
          case "OUT_FOR_DELIVERY":
            return "READY"
          case "DELIVERED":
            return "OUT_FOR_DELIVERY"
          case "FINISHED":
            return "DELIVERED"
          default:
            return null
        }
      default:
        return null
    }
  }

  // Print receipt function
  const printReceipt = (order: ApiOrder) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to print receipt",
        variant: "destructive",
      })
      return
    }

    // Format date and time
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    // Build receipt HTML
    const receiptHTML = `
  <!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${order.orderNumber}</title>

  <style>
    @media print {
      @page {
        size: 80mm auto;
        margin: 3mm;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: "Courier New", monospace;
      font-size: 10px;
      line-height: 1.25;
      width: 72mm;
      margin: 0 auto;
      padding: 4px;
      color: #000;
      background: #fff;
    }

    .center { text-align: center; }
    .bold { font-weight: 700; }

    .dash {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }

    h1 {
      font-size: 13px;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }

    .subtext {
      font-size: 9.5px;
      line-height: 1.2;
    }

    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      gap: 6px;
    }

    .left {
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }

    .right {
      white-space: nowrap;
      text-align: right;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      font-size: 9.5px;
      font-weight: 700;
      padding: 2px 0;
      border-bottom: 1px dashed #000;
    }

    tbody td {
      padding: 2px 0;
      vertical-align: top;
    }

    .col-item { width: 56%; }
    .col-qty { width: 10%; text-align: right; }
    .col-price { width: 17%; text-align: right; }
    .col-total { width: 17%; text-align: right; }

    .item-name {
      font-weight: 700;
      font-size: 10px;
      line-height: 1.15;
    }

    .totals { margin-top: 4px; }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .grand {
      border-top: 1px solid #000;
      padding-top: 4px;
      margin-top: 4px;
      font-size: 11.5px;
      font-weight: 800;
    }

    .footer { margin-top: 6px; font-size: 10px; }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="center">
  <h1>ADDICTION PIZZA KITCHEN</h1>
  <div class="subtext">0316-6846546 | 0306-5546546</div>
</div>

  <div class="dash"></div>

  <!-- ORDER NUMBER + DATE/TIME -->
  <div class="row">
    <div class="left"><span class="bold"># ${order.orderNumber}</span></div>
    <div class="right">${dateStr} ${timeStr}</div>
  </div>

  <!-- ONLY DELIVERY (CENTER + BOLD) -->
  <div class="center bold" style="margin: 4px 0 2px 0;">
    ${order.orderType || 'DELIVERY'}
  </div>

  <!-- CUSTOMER -->
  ${(order.customerName || order.customerPhone) ? `
    <div class="left" style="margin-bottom: 2px;">
      <span class="bold">Name:</span> ${order.customerName || '-'} | <span class="bold">Phone:</span> ${order.customerPhone || '-'}
    </div>
  ` : ''}

  <!-- ADDRESS -->
  ${order.customerAddress ? `
    <div class="left" style="margin-bottom: 2px;">
      <span class="bold">Address:</span> ${order.customerAddress}
    </div>
  ` : ''}

  <div class="dash"></div>

  <!-- ITEMS START -->
  <table>
    <thead>
      <tr>
        <th class="col-item" style="text-align:left;">Item</th>
        <th class="col-qty">Qty</th>
        <th class="col-price">Price</th>
        <th class="col-total">Total</th>
      </tr>
    </thead>

    <tbody>
      ${order.orderLines.map((line:any) => `
      <tr>
        <td class="col-item">
          <div class="item-name">${line.nameAtSale}</div>
        </td>
        <td class="col-qty">${line.quantity}</td>
        <td class="col-price">${parseFloat(line.unitPriceAtSale.toString()).toFixed(0)}</td>
        <td class="col-total">${parseFloat(line.lineTotal.toString()).toFixed(0)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="dash"></div>

  <!-- TOTALS -->
  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>PKR ${parseFloat(order.subtotal.toString()).toFixed(0)}</span>
    </div>

    ${order.deliveryCharges && parseFloat(order.deliveryCharges.toString()) > 0 ? `
    <div class="total-row">
      <span>Delivery</span>
      <span>PKR ${parseFloat(order.deliveryCharges.toString()).toFixed(0)}</span>
    </div>
    ` : ''}

    ${order.discount && parseFloat(order.discount.toString()) > 0 ? `
    <div class="total-row">
      <span>Discount</span>
      <span>-PKR ${parseFloat(order.discount.toString()).toFixed(0)}</span>
    </div>
    ` : ''}

    <div class="total-row grand">
      <span>TOTAL</span>
      <span>PKR ${parseFloat(order.total.toString()).toFixed(0)}</span>
    </div>
  </div>

  <div class="footer center">
    <div class="dash"></div>
    <p>Thank you!</p>
  </div>

</body>
</html>


    `

    // Write content and print
    printWindow.document.write(receiptHTML)
    printWindow.document.close()
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        // Close window after printing (optional - you can remove this if you want to keep it open)
        setTimeout(() => {
          printWindow.close()
        }, 100)
      }, 250)
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus, currentStatus?: OrderStatus) => {
    try {
      // If changing from DRAFT to PREPARING, we need to print the receipt
      const shouldPrint = currentStatus === "DRAFT" && newStatus === "PREPARING"
      
      // Update the order status
      const updatedOrder = await updateOrderStatus(orderId, newStatus as ApiOrderStatus)
      
      // If we should print, print the receipt using the updated order
      if (shouldPrint) {
        try {
          printReceipt(updatedOrder)
          toast({
            title: "Order Started & Receipt Printed",
            description: `Order ${updatedOrder.orderNumber} is now PREPARING. Receipt has been printed.`,
            duration: 3000,
          })
        } catch (printError) {
          console.error("Error printing receipt:", printError)
          // Still show success for status update even if print fails
          toast({
            title: "Order Started",
            description: `Order status updated to ${newStatus}, but receipt printing failed.`,
            variant: "default",
          })
        }
      } else {
        toast({
          title: "Success",
          description: `Order status updated to ${newStatus}`,
        })
      }
      
      fetchOrders() // Refresh orders
      setCancelDialogOpen(false)
      setOrderToCancel(null)
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update order status",
        variant: "destructive",
      })
    }
  }

  const handleCancelClick = (order: Order) => {
    setOrderToCancel(order)
    setCancelDialogOpen(true)
  }

  const handlePaymentStatusClick = (order: Order) => {
    setOrderToUpdatePayment(order)
    // Toggle payment status
    setNewPaymentStatus(order.paymentStatus === "PAID" ? "UNPAID" : "PAID")
    setPaymentDialogOpen(true)
  }

  const handleUpdatePaymentStatus = async () => {
    if (!orderToUpdatePayment) return
    
    try {
      await updateOrder(orderToUpdatePayment.id, { paymentStatus: newPaymentStatus })
      toast({
        title: "Success",
        description: `Order marked as ${newPaymentStatus}`,
      })
      fetchOrders() // Refresh orders
      setPaymentDialogOpen(false)
      setOrderToUpdatePayment(null)
    } catch (error) {
      console.error("Error updating payment status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payment status",
        variant: "destructive",
      })
    }
  }

  const handleBackConfirm = async () => {
    if (!orderToGoBack || !previousStatus) return
    
    try {
      await handleStatusUpdate(orderToGoBack.id, previousStatus, orderToGoBack.status)
      setBackConfirmDialogOpen(false)
      setOrderToGoBack(null)
      setPreviousStatus(null)
    } catch (error) {
      // Error is already handled in handleStatusUpdate
      setBackConfirmDialogOpen(false)
      setOrderToGoBack(null)
      setPreviousStatus(null)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {/* Filters Header */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-secondary pl-10"
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={isRefreshing}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                statusFilter === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              All
            </button>
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setTypeFilter("ALL")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              typeFilter === "ALL"
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            All Types
          </button>
          {typeFilters.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                typeFilter === type
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <ScrollArea className="flex-1 h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No orders found</p>
            <Button variant="outline" size="sm" onClick={fetchOrders} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pr-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOrders.map((order) => {
              const nextAction = getNextAction(order)

              return (
                <div
                  key={order.id}
                  className="group relative flex flex-col rounded-2xl border border-border/50 bg-card p-0 shadow-md shadow-black/5 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 overflow-hidden h-full"
                >
                  {/* Header Section */}
                  <div className="flex items-center justify-between p-5 pb-4 border-b border-border/30 bg-gradient-to-r from-card to-card/95 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xl font-bold tracking-tight text-foreground">{order.orderNumber}</span>
                      <span className="text-xs text-muted-foreground font-medium">{order.createdAt}</span>
                    </div>
                    <Badge className={cn(statusColors[order.status], "shadow-sm font-semibold px-3 py-1.5 text-xs")}>
                      {order.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col flex-1 p-5 pt-4 min-h-0">
                    <div className="space-y-4 flex-1">
                      {/* Order Type */}
                      <div>
                        <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 border-border/50 bg-secondary/40">
                          {order.type}
                        </Badge>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-1.5">
                        {order.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-secondary/30 border border-border/20">
                            <span className="text-xs font-medium text-foreground truncate flex-1">{item.name}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground bg-background/70 px-2 py-0.5 rounded ml-2 flex-shrink-0">
                              {item.quantity}x
                            </span>
                          </div>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-[10px] text-muted-foreground italic text-center pt-0.5">
                            +{order.items.length - 2} more items
                          </p>
                        )}
                      </div>

                      {/* Price and Payment Status */}
                      <div className="pt-3 border-t border-border/30">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
                          <Badge 
                            variant={order.paymentStatus === "PAID" ? "default" : "secondary"}
                            className={cn(
                              "cursor-pointer hover:opacity-90 transition-opacity font-semibold px-3 py-1.5 text-xs",
                              order.paymentStatus === "PAID" ? "bg-green-600 hover:bg-green-700 shadow-sm" : ""
                            )}
                            onClick={() => handlePaymentStatusClick(order)}
                          >
                            {order.paymentStatus}
                          </Badge>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-primary tracking-tight">
                            PKR {(typeof order.total === 'number' ? order.total : parseFloat(String(order.total)) || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Always at bottom */}
                    <div className="flex gap-2 pt-3 mt-auto border-t border-border/30 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-background border-border/50 hover:bg-secondary/60 hover:border-primary/40 hover:text-foreground text-foreground font-medium text-xs"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                    {/* Edit Button - Show for DRAFT status (both user and manager) */}
                    {order.status === "DRAFT" && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 bg-background border-border/50 hover:bg-secondary/60 hover:border-primary/40 transition-all"
                        onClick={async () => {
                          try {
                            const fullOrder = await getOrderById(order.id)
                            setOrderToEdit(fullOrder)
                            setEditDialogOpen(true)
                          } catch (error) {
                            console.error("Error fetching order for edit:", error)
                            toast({
                              title: "Error",
                              description: "Failed to load order details",
                              variant: "destructive",
                            })
                          }
                        }}
                        title="Edit Order"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Manager Back Button */}
                    {isManager && getPreviousStatus(order) && (
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0 bg-background border-border/50 hover:bg-secondary/60 hover:border-primary/40 transition-all"
                        onClick={() => {
                          const prevStatus = getPreviousStatus(order)
                          if (prevStatus) {
                            setOrderToGoBack(order)
                            setPreviousStatus(prevStatus)
                            setBackConfirmDialogOpen(true)
                          }
                        }}
                        title={`Go back to ${getPreviousStatus(order)}`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                    {nextAction && (
                      <Button 
                        size="sm" 
                        className="flex-1 font-semibold shadow-sm hover:shadow-md transition-all text-xs"
                        onClick={() => handleStatusUpdate(order.id, nextAction.action, order.status)}
                      >
                        {nextAction.label}
                        <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isManager && order.status !== "FINISHED" && order.status !== "CANCELLED" && (
                      <Button 
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 hover:border-destructive/40 transition-all"
                        onClick={() => handleCancelClick(order)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  </div>
                </div>
            )
          })}
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
                      Created: {new Date(selectedOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel order {orderToCancel?.orderNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orderToCancel && handleStatusUpdate(orderToCancel.id, "CANCELLED", orderToCancel.status)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Payment Status Confirmation Dialog */}
      <AlertDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {newPaymentStatus === "PAID" ? "Mark as Paid" : "Mark as Unpaid"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark order {orderToUpdatePayment?.orderNumber} as {newPaymentStatus}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdatePaymentStatus}>
              Yes, Mark as {newPaymentStatus}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Back Confirmation Dialog */}
      <AlertDialog open={backConfirmDialogOpen} onOpenChange={setBackConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change order {orderToGoBack?.orderNumber} status from {orderToGoBack?.status} to {previousStatus}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleBackConfirm}>
              Yes, Go Back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Order Dialog */}
      <EditOrderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        order={orderToEdit}
        onOrderUpdated={() => {
          fetchOrders()
          setEditDialogOpen(false)
          setOrderToEdit(null)
        }}
      />
    </div>
  )
}
