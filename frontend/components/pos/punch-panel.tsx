"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Minus, Trash2, Printer, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { 
  getMenuItemsForOrder, 
  getDealsForOrder, 
  createOrder,
  type OrderType,
  type PaymentMethod as ApiPaymentMethod,
  type Order
} from "@/lib/api/orders"
import type { MenuItem as ApiMenuItem } from "@/lib/api/menu-items"
import type { Deal as ApiDeal } from "@/lib/api/deals"

type PaymentMethod = "CASH" | "ONLINE"

interface MenuItem {
  id: string
  name: string
  referenceNumber: string
  price: number
  description?: string
}

interface Deal {
  id: string
  name: string
  referenceNumber: string
  price: number
  description?: string
  dealItems?: Array<{
    menuItem?: {
      id: string
      name: string
      referenceNumber: string
      price: number
      description?: string
    }
    quantity: number
  }>
}

interface CartItem {
  id: string
  name: string
  referenceNumber: string
  price: number
  quantity: number
  productType: "ITEM" | "DEAL"
}

interface PunchPanelProps {
  setActiveTab?: (tab: "punch" | "orders" | "dashboard" | "menu" | "deals" | "users") => void
}

export function PunchPanel({ setActiveTab }: PunchPanelProps) {
  const { toast } = useToast()
  const [orderType, setOrderType] = useState<OrderType>("DINE")
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID")
  const [deliveryCharges, setDeliveryCharges] = useState<string>("")
  const [discount, setDiscount] = useState<string>("")
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "" })
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)

  // Fetch menu items and deals from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [items, dealsData] = await Promise.all([
          getMenuItemsForOrder(),
          getDealsForOrder()
        ])
        
        const activeItems = items.map(item => ({
          id: item.id,
          name: item.name,
          referenceNumber: item.referenceNumber,
          price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
          description: item.description
        }))
        
        const activeDeals = dealsData.map(deal => ({
          id: deal.id,
          name: deal.name,
          referenceNumber: deal.referenceNumber,
          price: typeof deal.price === 'string' ? parseFloat(deal.price) : deal.price,
          description: deal.description,
          dealItems: deal.dealItems
        }))
        
        setMenuItems(activeItems)
        setDeals(activeDeals)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load menu items and deals",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [toast])

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

  // Reset customer info and delivery charges when order type changes
  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type)
    if (type !== "DELIVERY") {
      setCustomerInfo({ name: "", phone: "", address: "" })
      setDeliveryCharges("")
    } else {
      setCustomerInfo({ name: "", phone: "", address: "" })
    }
    // Discount can remain when order type changes
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

  const clearCart = () => setCart([])

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryChargesNum = orderType === "DELIVERY" ? (parseFloat(deliveryCharges) || 0) : 0
  const discountNum = parseFloat(discount) || 0
  const total = subtotal + deliveryChargesNum - discountNum

  // Print receipt function
  const printReceipt = (order: Order) => {
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

  // Print cafe receipt function (kitchen receipt - no prices, only items and quantities)
  const printCafeReceipt = (order: Order) => {
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

    // Build cafe receipt HTML (simplified - no prices)
    const receiptHTML = `
  <!DOCTYPE html>
<html>
<head>
  <title>Cafe Receipt - ${order.orderNumber}</title>

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

    .col-item { width: 70%; }
    .col-qty { width: 30%; text-align: right; }

    .item-name {
      font-weight: 700;
      font-size: 10px;
      line-height: 1.15;
    }

    .footer { margin-top: 6px; font-size: 10px; }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="center">
  <h1>ADDICTION PIZZA KITCHEN</h1>
  <div class="subtext">CAFE RECEIPT</div>
</div>

  <div class="dash"></div>

  <!-- ORDER NUMBER + DATE/TIME -->
  <div class="row">
    <div class="left"><span class="bold">Order # ${order.orderNumber}</span></div>
    <div class="right">${dateStr} ${timeStr}</div>
  </div>

  <!-- ORDER TYPE (CENTER + BOLD) -->
  <div class="center bold" style="margin: 4px 0 2px 0;">
    ${order.orderType || 'DELIVERY'}
  </div>

  <div class="dash"></div>

  <!-- ITEMS START (NO PRICES) -->
  <table>
    <thead>
      <tr>
        <th class="col-item" style="text-align:left;">Item</th>
        <th class="col-qty">Qty</th>
      </tr>
    </thead>

    <tbody>
      ${order.orderLines.map((line:any) => `
      <tr>
        <td class="col-item">
          <div class="item-name">${line.nameAtSale}</div>
        </td>
        <td class="col-qty">${line.quantity}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="dash"></div>

  <div class="footer center">
    <p>Kitchen Copy</p>
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

  // Map frontend payment method to backend payment method
  const mapPaymentMethod = (method: PaymentMethod): ApiPaymentMethod | null => {
    if (method === "CASH") return "CASH"
    if (method === "ONLINE") return "ONLINE"
    return null
  }

  const handleCreateOrder = async (status: "DRAFT" | "PREPARING" = "DRAFT") => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Cart is empty. Please add items to create an order.",
        variant: "destructive",
      })
      return
    }

    // Validate delivery orders require customer details
    if (orderType === "DELIVERY") {
      if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
        toast({
          title: "Error",
          description: "Delivery orders require customer name, phone, and address",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsCreatingOrder(true)

      const orderData = {
        orderType,
        paymentMethod: mapPaymentMethod(paymentMethod),
        paymentStatus,
        customerName: customerInfo.name || null,
        customerPhone: customerInfo.phone || null,
        customerAddress: customerInfo.address || null,
        deliveryCharges: orderType === "DELIVERY" ? deliveryChargesNum : undefined,
        discount: discountNum > 0 ? discountNum : undefined,
        orderLines: cart.map(item => ({
          productType: item.productType,
          productId: item.id,
          quantity: item.quantity
        }))
      }

      const createdOrder = await createOrder(orderData)

      // If status is PREPARING, update the order status and print both receipts
      if (status === "PREPARING") {
        const { updateOrderStatus } = await import("@/lib/api/orders")
        const updatedOrder = await updateOrderStatus(createdOrder.id, "PREPARING")
        
        // Print customer receipt first
        printReceipt(updatedOrder)
        
        // Print cafe receipt after a short delay (so they print one after another)
        setTimeout(() => {
          printCafeReceipt(updatedOrder)
        }, 500)
        
        // Show success popup
        toast({
          title: "Order Printed",
          description: `Both receipts for Order ${updatedOrder.orderNumber} have been printed. Order is now in PREPARING status.`,
          duration: 3000,
        })

        // Navigate to orders page after a short delay
        if (setActiveTab) {
          setTimeout(() => {
            setActiveTab("orders")
          }, 1000)
        }
      } else {
        // For DRAFT orders, just show success message
        toast({
          title: "Success",
          description: `Order ${createdOrder.orderNumber} saved as draft`,
        })
      }

      // Clear cart and reset form
      clearCart()
      setCustomerInfo({ name: "", phone: "", address: "" })
      setPaymentMethod("CASH")
      setPaymentStatus("UNPAID")
      setDeliveryCharges("")
      setDiscount("")
      setOrderType("DINE")
    } catch (error) {
      console.error("Error creating order:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create order",
        variant: "destructive",
      })
    } finally {
      setIsCreatingOrder(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Column - Menu Items */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-secondary pl-10"
          />
        </div>

        {/* Deals Section */}
        {filteredDeals.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">🔥 Hot Deals</h3>
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {filteredDeals.map((deal) => {
                const dealItemsText = deal.dealItems
                  ?.map(di => di.menuItem ? `${di.menuItem.name} (x${di.quantity})` : `Item (x${di.quantity})`)
                  .join(" + ") || "Deal items"
                
                return (
                  <button
                    key={deal.id}
                    onClick={() => addDealToCart(deal)}
                    className="group flex min-w-[190px] flex-col rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-orange-500/10 p-3 text-left shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 border border-primary/20 shadow-sm">
                        <span className="text-base">🔥</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">{deal.name}</span>
                        <Badge variant="outline" className="text-[8px] font-mono bg-secondary/50 border-border/60 px-1 py-0 mt-0.5">
                          {deal.referenceNumber}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">{dealItemsText}</span>
                    <div className="mt-auto pt-1.5 border-t border-border/30">
                      <span className="text-sm font-bold text-primary">PKR {deal.price.toFixed(2)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Items Grid */}
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu Items</h3>
        <ScrollArea className="flex-1 h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading menu items...</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 pr-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addMenuItemToCart(item)}
                  className="group flex flex-col rounded-xl border border-border/50 bg-card p-3 text-left shadow-sm hover:shadow-md hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300"
                >
                  <span className="text-xs font-bold text-foreground leading-tight line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">{item.name}</span>
                  <Badge variant="outline" className="text-[9px] font-mono bg-secondary/50 border-border/60 px-1 py-0 w-fit mb-2">
                    {item.referenceNumber}
                  </Badge>
                  <div className="mt-auto pt-1.5 border-t border-border/20">
                    <span className="text-sm font-bold text-primary">PKR {item.price.toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Column - Cart & Order Details */}
      <div className="flex w-[420px] shrink-0 flex-col border-l border-border bg-card overflow-hidden">
        {/* Cart Header - Always at Top */}
        <div className="flex items-center justify-between border-b border-border p-1.5 bg-card/50">
          <div className="flex-1 flex items-center justify-center gap-1.5">
            <h3 className="text-[10px] font-semibold text-foreground">Current Order</h3>
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {orderType} • DRAFT
            </Badge>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearCart}>
              <X className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>

        {/* Cart Items - Scrollable */}
        <ScrollArea className="flex-1 h-0">
          <div className="p-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-2 text-4xl">🛒</div>
                <p className="text-sm text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground">Tap items to add</p>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map((item, index) => (
                  <div key={`${item.id}-${item.productType}-${index}`} className="flex items-center gap-1 rounded-md bg-secondary/50 p-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-0.5">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {item.productType === "DEAL" ? item.referenceNumber : item.name}
                        </p>
                        <Badge variant="outline" className="text-[8px] px-0.5 py-0 h-3.5">
                          {item.productType}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-4 w-4 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.productType, -1)}
                      >
                        <Minus className="h-2 w-2" />
                      </Button>
                      <span className="w-3.5 text-center text-[10px] font-semibold">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-4 w-4 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.productType, 1)}
                      >
                        <Plus className="h-2 w-2" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 text-destructive"
                        onClick={() => removeItem(item.id, item.productType)}
                      >
                        <Trash2 className="h-2 w-2" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Order Type & Customer Details - Compact Scrollable Section */}
        <div className="border-t border-border bg-card/30 shrink-0 max-h-[250px] overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2">
            {/* Order Type, Payment Method & Payment Status - Parallel Vertical Layout */}
            <div className="mb-2 grid grid-cols-3 gap-2">
              {/* Order Type */}
              <div className="flex flex-col items-center">
                <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Order Type</h3>
                <div className="flex flex-col gap-0.5 w-full">
                  {(["DINE", "TAKEAWAY", "DELIVERY"] as OrderType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleOrderTypeChange(type)}
                      className={cn(
                        "rounded-md px-1.5 py-1 text-[9px] font-medium transition-all",
                        orderType === type
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex flex-col items-center">
                <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Payment Method</h3>
                <div className="flex flex-col gap-0.5 w-full">
                  {(["CASH", "ONLINE"] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "rounded-md px-1.5 py-1 text-[9px] font-medium transition-all",
                        paymentMethod === method
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status */}
              <div className="flex flex-col items-center">
                <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Payment Status</h3>
                <div className="flex flex-col gap-0.5 w-full">
                  {(["PAID", "UNPAID"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setPaymentStatus(status)}
                      className={cn(
                        "rounded-md px-1.5 py-1 text-[9px] font-medium transition-all",
                        paymentStatus === status
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Customer Info Fields - Compact */}
            {(orderType === "DINE" || orderType === "TAKEAWAY" || orderType === "DELIVERY") && (
              <div className="space-y-1">
                <h3 className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Customer Details</h3>
                {orderType === "DELIVERY" && (
                  <div className="grid grid-cols-4 gap-1">
                    <Input
                      placeholder="Name *"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px] col-span-2"
                      required
                    />
                    <Input
                      placeholder="Phone *"
                      value={customerInfo.phone}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/\D/g, '')
                        setCustomerInfo({ ...customerInfo, phone: value })
                      }}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px] col-span-2"
                      required
                      type="tel"
                    />
                    <Input
                      placeholder="Address *"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px] col-span-3"
                      required
                    />
                    <Input
                      type="number"
                      placeholder="Charges *"
                      value={deliveryCharges}
                      onChange={(e) => setDeliveryCharges(e.target.value)}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px] col-span-1"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}
                {(orderType === "DINE" || orderType === "TAKEAWAY") && (
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      placeholder="Name (optional)"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px]"
                    />
                    <Input
                      placeholder="Phone (optional)"
                      value={customerInfo.phone}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/\D/g, '')
                        setCustomerInfo({ ...customerInfo, phone: value })
                      }}
                      className="bg-secondary text-[10px] h-6 placeholder:text-[9px]"
                      type="tel"
                    />
                  </div>
                )}
              </div>
            )}
            </div>
          </ScrollArea>
        </div>

        {/* Totals - Fixed at Bottom */}
        <div className="border-t border-border p-3 bg-card shrink-0">
          <div className="mb-3 flex items-start gap-4">
            {/* Totals Section - Left Side */}
            <div className="flex-1 space-y-1.5 text-sm">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>PKR {subtotal.toFixed(2)}</span>
              </div>
              {orderType === "DELIVERY" && deliveryChargesNum > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Delivery Charges</span>
                  <span>PKR {deliveryChargesNum.toFixed(2)}</span>
                </div>
              )}
              {discountNum > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Discount</span>
                  <span className="text-green-600">-PKR {discountNum.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-1.5 mt-2 px-2 py-1.5 rounded-md bg-green-50/50 dark:bg-green-950/20 border-green-200/30 dark:border-green-800/30">
                <span>Total</span>
                <span className="text-primary">PKR {Math.max(0, total).toFixed(2)}</span>
              </div>
            </div>

            {/* Discount Field - Right Side */}
            <div className="flex-shrink-0 w-32">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Discount:</label>
              <Input
                type="number"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="bg-secondary text-xs h-8 w-full"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 bg-transparent" 
              disabled={cart.length === 0 || isCreatingOrder}
              onClick={() => handleCreateOrder("DRAFT")}
            >
              {isCreatingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save Draft"
              )}
            </Button>
            <Button 
              className="flex-1 gap-2" 
              disabled={cart.length === 0 || isCreatingOrder}
              onClick={() => handleCreateOrder("PREPARING")}
            >
              {isCreatingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Confirm & Print
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
