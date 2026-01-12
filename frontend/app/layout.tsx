import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/pos/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Addiction Pizza Kitchen POS",
  description: "Modern Point of Sale System",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <body className={`font-sans antialiased h-full overflow-hidden`}>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
