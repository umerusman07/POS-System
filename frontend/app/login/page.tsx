"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { login } from "@/lib/api/auth"
import { setAuthToken } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Validation Error",
        description: "Email and password are required",
        variant: "destructive",
      })
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)

      // Login via API - POST /api/auth/login
      const response = await login({
        email: email.trim(),
        password: password,
      })

      // Store token in localStorage
      setAuthToken(response.token)

      // Store user data in localStorage (optional, for quick access)
      localStorage.setItem('user_data', JSON.stringify(response.user))

      toast({
        title: "Success",
        description: "Login successful! Redirecting...",
      })

      // Redirect to POS page after a short delay
      setTimeout(() => {
        router.push("/")
      }, 1000)
    } catch (error) {
      console.error("Login error:", error)
      
      let errorMessage = "Failed to login"
      if (error instanceof Error) {
        errorMessage = error.message
      }

      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Left half - Logo Image with Text Overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-black overflow-hidden">
        {/* Logo - Smaller, No Blur */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <img 
            src="/logo.png" 
            alt="Addiction Pizza Kitchen Logo" 
            className="object-contain"
            style={{ 
              width: 'auto',
              height: 'auto',
              maxWidth: '70%',
              maxHeight: '70%'
            }}
          />
        </div>
        {/* Text Overlay - Centered Horizontally, Lower Vertically */}
        <div className="absolute inset-0 flex items-end justify-center pb-20 px-12 z-10">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">Addiction Pizza Kitchen</h1>
            <p className="text-lg text-white/90 drop-shadow-md">
              Welcome back! Sign in to access your Point of Sale system.
            </p>
          </div>
        </div>
      </div>

      {/* Right half - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src="/logo.png" 
                alt="Addiction Pizza Kitchen Logo" 
                className="h-24 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Addiction Pizza Kitchen</h1>
            <p className="text-muted-foreground">Point of Sale System</p>
          </div>

          {/* Desktop Title */}
          <div className="hidden lg:block space-y-2">
            <h2 className="text-3xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary"
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary pr-10"
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            © 2024 Addiction Pizza Kitchen. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

