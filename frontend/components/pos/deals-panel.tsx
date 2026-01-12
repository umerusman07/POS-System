"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Edit, ToggleLeft, ToggleRight, Package, Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { getAllDeals, createDeal, updateDeal, deleteDeal, type Deal, type DealItem } from "@/lib/api/deals"
import { getAllMenuItems, type MenuItem } from "@/lib/api/menu-items"

export function DealsPanel() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [formData, setFormData] = useState({ 
    name: "", 
    referenceNumber: "", 
    description: "", 
    price: "", 
    isActive: true,
    dealItems: [] as Array<{ menuItemId: string; quantity: number }>
  })
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [viewingDeal, setViewingDeal] = useState<Deal | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [showActiveDeals, setShowActiveDeals] = useState(true)
  const { toast } = useToast()

  // Check if user is manager
  useEffect(() => {
    try {
      const userData = localStorage.getItem("user_data")
      if (userData) {
        const user = JSON.parse(userData)
        setIsManager(user.role === "Manager" || user.role === "manager")
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    }
  }, [])

  // Fetch deals and menu items
  const fetchDeals = async () => {
    try {
      setIsLoading(true)
      const fetchedDeals = await getAllDeals()
      setDeals(fetchedDeals)
    } catch (error) {
      console.error("Error fetching deals:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch deals",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const items = await getAllMenuItems()
      setMenuItems(items.filter(item => item.isActive))
    } catch (error) {
      console.error("Error fetching menu items:", error)
    }
  }

  useEffect(() => {
    fetchDeals()
    fetchMenuItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh when dialog closes
  useEffect(() => {
    if (!isDialogOpen && !isSaving) {
      fetchDeals()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, isSaving])

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = showActiveDeals ? deal.isActive : !deal.isActive
    return matchesSearch && matchesStatus
  })

  const toggleActive = async (deal: Deal) => {
    if (!isManager) {
      toast({
        title: "Access Denied",
        description: "Only managers can update deals",
        variant: "destructive",
      })
      return
    }

    try {
      const updatedDeal = await updateDeal(deal.id, {
        isActive: !deal.isActive,
      })
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? updatedDeal : d)))
      toast({
        title: "Success",
        description: `${updatedDeal.name} ${updatedDeal.isActive ? "activated" : "deactivated"}`,
      })
    } catch (error) {
      console.error("Error toggling deal active status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update deal",
        variant: "destructive",
      })
    }
  }

  const openCreateDialog = () => {
    setEditingDeal(null)
    setFormData({ 
      name: "", 
      referenceNumber: "", 
      description: "", 
      price: "", 
      isActive: true,
      dealItems: []
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (deal: Deal) => {
    setEditingDeal(deal)
    setFormData({ 
      name: deal.name, 
      referenceNumber: deal.referenceNumber,
      description: deal.description || "", 
      price: deal.price.toString(), 
      isActive: deal.isActive,
      dealItems: deal.dealItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }))
    })
    setIsDialogOpen(true)
  }

  const addDealItem = () => {
    setFormData({
      ...formData,
      dealItems: [...formData.dealItems, { menuItemId: "", quantity: 1 }]
    })
  }

  const removeDealItem = (index: number) => {
    setFormData({
      ...formData,
      dealItems: formData.dealItems.filter((_, i) => i !== index)
    })
  }

  const updateDealItem = (index: number, field: "menuItemId" | "quantity", value: string | number) => {
    const updated = [...formData.dealItems]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, dealItems: updated })
  }

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim() || !formData.referenceNumber.trim() || !formData.price.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Reference Number, Price)",
        variant: "destructive",
      })
      return
    }

    if (formData.dealItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one menu item to the deal",
        variant: "destructive",
      })
      return
    }

    // Validate all deal items have menuItemId
    if (formData.dealItems.some(item => !item.menuItemId)) {
      toast({
        title: "Validation Error",
        description: "Please select a menu item for all deal items",
        variant: "destructive",
      })
      return
    }

    const price = parseFloat(formData.price)
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be a positive number",
        variant: "destructive",
      })
      return
    }

    if (editingDeal) {
      // Update deal
      try {
        setIsSaving(true)
        
        const updateData: { name: string; description?: string; price: number; isActive: boolean; dealItems: Array<{ menuItemId: string; quantity: number }> } = {
          name: formData.name.trim(),
          isActive: formData.isActive,
          price: price,
          dealItems: formData.dealItems.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity
          }))
        }
        
        if (formData.description.trim()) {
          updateData.description = formData.description.trim()
        } else {
          updateData.description = ""
        }
        
        const updatedDeal = await updateDeal(editingDeal.id, updateData)
        setDeals((prev) => prev.map((d) => (d.id === editingDeal.id ? updatedDeal : d)))
        
        setIsDialogOpen(false)
        setFormData({ name: "", referenceNumber: "", description: "", price: "", isActive: true, dealItems: [] })
        setEditingDeal(null)
        
        toast({
          title: "Success",
          description: "Deal updated successfully",
        })
      } catch (error) {
        console.error("Error updating deal:", error)
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to update deal",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
      return
    }

    // Create deal
    try {
      setIsSaving(true)
      
      const newDeal = await createDeal({
        name: formData.name.trim(),
        referenceNumber: formData.referenceNumber.trim(),
        description: formData.description.trim() || undefined,
        price: price,
        isActive: formData.isActive,
        dealItems: formData.dealItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        }))
      })
      
      setDeals((prev) => [...prev, newDeal])
      setIsDialogOpen(false)
      setFormData({ name: "", referenceNumber: "", description: "", price: "", isActive: true, dealItems: [] })
      
      toast({
        title: "Success",
        description: "Deal created successfully",
      })
    } catch (error) {
      console.error("Error creating deal:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create deal",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Deals</h2>
          <p className="text-sm text-muted-foreground">Manage combo deals and offers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showActiveDeals ? "default" : "outline"}
            onClick={() => setShowActiveDeals(true)}
            className={showActiveDeals ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Active Deals
          </Button>
          <Button
            variant={!showActiveDeals ? "default" : "outline"}
            onClick={() => setShowActiveDeals(false)}
            className={!showActiveDeals ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Inactive Deals
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            {isManager && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Create Deal
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="bg-card max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingDeal ? "Edit Deal" : "Create Deal"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Deal Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-secondary"
                  placeholder="Deal name"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Reference Number *</Label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  className="bg-secondary"
                  placeholder="e.g., DEAL001"
                  disabled={isSaving || !!editingDeal}
                  readOnly={!!editingDeal}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-secondary"
                  placeholder="Deal description (optional)"
                  rows={3}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Price (PKR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="bg-secondary"
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Deal Items *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addDealItem} disabled={isSaving}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>
                {formData.dealItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Select
                      value={item.menuItemId}
                      onValueChange={(value) => updateDealItem(index, "menuItemId", value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="bg-secondary flex-1">
                        <SelectValue placeholder="Select menu item" />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((menuItem) => (
                          <SelectItem key={menuItem.id} value={menuItem.id}>
                            {menuItem.name} ({menuItem.referenceNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateDealItem(index, "quantity", parseInt(e.target.value) || 1)}
                      className="bg-secondary w-20"
                      placeholder="Qty"
                      disabled={isSaving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDealItem(index)}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {formData.dealItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">Click "Add Item" to add menu items to this deal</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={isSaving}
                />
                <Label htmlFor="isActive" className="text-foreground cursor-pointer">
                  Active
                </Label>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDeal ? "Update Deal" : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-secondary pl-10"
        />
      </div>

      <ScrollArea className="flex-1 h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">
                {searchQuery 
                  ? "No deals found matching your search." 
                  : showActiveDeals 
                    ? "No active deals found." 
                    : "No inactive deals found."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 pr-4 md:grid-cols-2 lg:grid-cols-4">
            {filteredDeals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => {
                  setViewingDeal(deal)
                  setIsViewDialogOpen(true)
                }}
                className="group relative flex flex-col rounded-2xl border border-border/50 bg-card shadow-md shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden"
              >

                <div className="p-3 space-y-2">
                  {/* Header Section */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/10 flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 hover:shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-foreground mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">
                          {deal.name}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className="text-[10px] font-mono bg-secondary/50 border-border/60 px-1.5 py-0.5"
                        >
                          {deal.referenceNumber}
                        </Badge>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActive(deal)
                      }} 
                      className="flex-shrink-0 focus:outline-none transition-transform hover:scale-110 p-1 rounded-lg hover:bg-secondary/50"
                    >
                      {deal.isActive ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  {deal.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 leading-snug">
                      {deal.description}
                    </p>
                  )}

                  {/* Deal Items */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Includes
                      </span>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground">
                        {deal.dealItems.length} {deal.dealItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {deal.dealItems.slice(0, 2).map((item, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-[10px] font-medium bg-secondary/80 border-border/60 px-1.5 py-0.5"
                        >
                          {item.menuItem?.name || "Unknown"} ×{item.quantity}
                        </Badge>
                      ))}
                      {deal.dealItems.length > 2 && (
                        <Badge 
                          variant="secondary" 
                          className="text-[10px] font-medium bg-secondary/80 border-border/60 px-1.5 py-0.5"
                        >
                          +{deal.dealItems.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price and Actions Section */}
                  <div className="pt-1.5 border-t border-border/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                          Price
                        </div>
                        <span className="text-lg font-bold text-primary">
                          PKR {typeof deal.price === 'string' ? parseFloat(deal.price).toFixed(2) : deal.price.toFixed(2)}
                        </span>
                      </div>
                      {isManager && (
                        <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(deal)
                            }}
                            className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={(e) => {
                              e.stopPropagation()
                              setDealToDelete(deal)
                              setIsDeleteDialogOpen(true)
                            }}
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* View Deal Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-xl font-bold text-foreground">Deal Details</DialogTitle>
          </DialogHeader>
          {viewingDeal && (
            <div className="mt-4 space-y-6">
              {/* Header Section */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">{viewingDeal.name}</h3>
                      <Badge variant="outline" className="text-xs font-medium px-2 py-1 mt-1">
                        {viewingDeal.referenceNumber}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={viewingDeal.isActive ? "default" : "secondary"}
                  className="text-xs font-medium px-3 py-1"
                >
                  {viewingDeal.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Description */}
              {viewingDeal.description ? (
                <div className="rounded-lg border border-border bg-secondary/50 p-4">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {viewingDeal.description}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="text-sm text-muted-foreground italic">No description available</p>
                </div>
              )}

              {/* Deal Items */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">Deal Items</h4>
                <div className="rounded-lg border border-border bg-secondary/30 divide-y divide-border">
                  {viewingDeal.dealItems && viewingDeal.dealItems.length > 0 ? (
                    viewingDeal.dealItems.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {item.quantity}x
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {item.menuItem?.name || "Unknown Item"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center">
                      <p className="text-sm text-muted-foreground italic">No items in this deal</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Section */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground uppercase tracking-wide">Deal Price</span>
                  <span className="text-2xl font-bold text-primary">
                    PKR {typeof viewingDeal.price === 'string' ? parseFloat(viewingDeal.price).toFixed(2) : viewingDeal.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Status Info */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Status: {viewingDeal.isActive ? "Available" : "Unavailable"}</span>
                  {isManager && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsViewDialogOpen(false)
                        openEditDialog(viewingDeal)
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Deal
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Deal</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{dealToDelete?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!dealToDelete) return
                try {
                  setIsDeleting(true)
                  await deleteDeal(dealToDelete.id)
                  setDeals((prev) => prev.filter((d) => d.id !== dealToDelete.id))
                  toast({
                    title: "Success",
                    description: "Deal deleted successfully",
                  })
                  setIsDeleteDialogOpen(false)
                  setDealToDelete(null)
                } catch (error) {
                  console.error("Delete deal error:", error)
                  let errorMessage = "Failed to delete deal"
                  if (error instanceof Error) {
                    errorMessage = error.message
                  }
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  })
                } finally {
                  setIsDeleting(false)
                }
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
