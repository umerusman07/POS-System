"use client"

import type React from "react"

import { ShoppingCart, ClipboardList, LayoutDashboard, UtensilsCrossed, Percent, Users, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TabType, UserRole } from "@/app/page"

interface TopNavigationProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  userRole: UserRole
}

const navItems: { id: TabType; label: string; icon: React.ElementType; managerOnly?: boolean; userOnly?: boolean }[] = [
  { id: "punch", label: "Punch", icon: ShoppingCart },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "completed", label: "Completed Orders", icon: CheckCircle, userOnly: true },
  { id: "cancelled", label: "Cancelled Orders", icon: XCircle, userOnly: true },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, managerOnly: true },
  { id: "menu", label: "Menu", icon: UtensilsCrossed, managerOnly: true },
  { id: "deals", label: "Deals", icon: Percent, managerOnly: true },
  { id: "users", label: "Users", icon: Users, managerOnly: true },
]

export function TopNavigation({ activeTab, setActiveTab, userRole }: TopNavigationProps) {
  const visibleItems = navItems.filter((item) => {
    if (item.managerOnly) return userRole === "manager"
    if (item.userOnly) return userRole === "user"
    return true
  })

  return (
    <nav className="flex h-14 shrink-0 items-center justify-center gap-1 border-b border-border bg-card/50 px-4">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
