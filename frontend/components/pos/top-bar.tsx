"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, LogOut, Key, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { removeAuthToken } from "@/lib/api"
import { changePassword } from "@/lib/api/auth"
import { useToast } from "@/hooks/use-toast"

export function TopBar() {
  const router = useRouter()
  const { toast } = useToast()
  const [time, setTime] = useState(new Date())
  const [userData, setUserData] = useState<{ username?: string; role?: string; firstName?: string; lastName?: string } | null>(null)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    
    // Load user data from localStorage
    try {
      const storedUserData = localStorage.getItem("user_data")
      if (storedUserData) {
        const user = JSON.parse(storedUserData)
        setUserData(user)
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    }
    
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    removeAuthToken()
    localStorage.removeItem("user_data")
    router.push("/login")
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword.trim() || !newPassword.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in both password fields",
        variant: "destructive",
      })
      return
    }

    // Validate new password length
    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    // Validate new password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
    if (!passwordRegex.test(newPassword)) {
      toast({
        title: "Validation Error",
        description: "New password must contain at least one uppercase letter, one lowercase letter, and one number",
        variant: "destructive",
      })
      return
    }

    try {
      setIsChangingPassword(true)
      await changePassword({
        currentPassword,
        newPassword,
      })

      toast({
        title: "Success",
        description: "Password updated successfully",
      })

      // Reset form and close dialog
      setCurrentPassword("")
      setNewPassword("")
      setIsChangePasswordOpen(false)
    } catch (error) {
      console.error("Change password error:", error)
      
      let errorMessage = "Failed to change password"
      if (error instanceof Error) {
        errorMessage = error.message
        // Check if it's a wrong password error
        if (errorMessage.toLowerCase().includes("current password") || errorMessage.toLowerCase().includes("incorrect")) {
          errorMessage = "Wrong password. Please check your current password."
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const isManager = userData?.role === "Manager" || userData?.role === "manager"
  const displayName = userData?.firstName || userData?.username || "User"
  const displayRole = userData?.role || "User"

  return (
    <>
      <header className="grid h-16 shrink-0 grid-cols-3 items-center border-b border-border bg-card px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Addiction Pizza Kitchen Logo" 
            className="h-12 w-auto object-contain"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Addiction Pizza Kitchen</h1>
            <p className="text-xs text-muted-foreground">Point of Sale</p>
          </div>
        </div>

        {/* Clock - Centered */}
        <div className="hidden text-center md:block">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {time.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3 hover:bg-secondary/50 hover:text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 overflow-hidden">
                  {isManager ? (
                    <img 
                      src="/Manager.png" 
                      alt="Manager" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayRole}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isManager && (
                <>
                  <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                    <Key className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={handleLogout} 
                variant="destructive"
                className="text-destructive focus:text-destructive focus:bg-destructive/10 hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4 text-destructive" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Change Password Dialog */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent className="bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-foreground">
                Current Password
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-secondary pr-10"
                  disabled={isChangingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isChangingPassword}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary pr-10"
                  disabled={isChangingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isChangingPassword}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsChangePasswordOpen(false)}
                className="flex-1"
                disabled={isChangingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isChangingPassword}
              >
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
