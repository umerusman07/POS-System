"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TopBar } from "@/components/pos/top-bar"
import { TopNavigation } from "@/components/pos/top-navigation"
import { PunchPanel } from "@/components/pos/punch-panel"
import { OrdersPanel } from "@/components/pos/orders-panel"
import { DashboardPanel } from "@/components/pos/dashboard-panel"
import { MenuPanel } from "@/components/pos/menu-panel"
import { DealsPanel } from "@/components/pos/deals-panel"
import { UsersPanel } from "@/components/pos/users-panel"
import { CompletedOrdersPanel } from "@/components/pos/completed-orders-panel"
import { getAuthToken } from "@/lib/api"
import { Loader2 } from "lucide-react"

export type TabType = "punch" | "orders" | "dashboard" | "menu" | "deals" | "users" | "completed" | "cancelled"
export type UserRole = "manager" | "user"

export default function POSPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("punch")
  const [userRole, setUserRole] = useState<UserRole>("manager")
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check authentication on mount
  useEffect(() => {
    const token = getAuthToken()
    
    if (!token) {
      // No token, redirect to login
      router.push("/login")
      return
    }

    // Token exists, load user data if available
    try {
      const userData = localStorage.getItem("user_data")
      if (userData) {
        const user = JSON.parse(userData)
        // Map backend role to frontend role
        setUserRole(user.role === "Manager" ? "manager" : "user")
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    }

    setIsCheckingAuth(false)
  }, [router])

  const renderPanel = () => {
    switch (activeTab) {
      case "punch":
        return <PunchPanel setActiveTab={setActiveTab} />
      case "orders":
        return <OrdersPanel userRole={userRole} />
      case "dashboard":
        return <DashboardPanel />
      case "menu":
        return <MenuPanel />
      case "deals":
        return <DealsPanel />
      case "users":
        return <UsersPanel />
      case "completed":
        return <CompletedOrdersPanel viewType="completed" />
      case "cancelled":
        return <CompletedOrdersPanel viewType="cancelled" />
      default:
        return <PunchPanel setActiveTab={setActiveTab} />
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopBar />
      <TopNavigation activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} />
      <main className="flex-1 min-h-0 overflow-hidden">{renderPanel()}</main>
    </div>
  )
}
