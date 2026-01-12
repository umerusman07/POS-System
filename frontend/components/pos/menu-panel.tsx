"use client"

/**
 * MenuPanel Component
 * 
 * This component displays and manages menu items.
 * It integrates with the backend API endpoints:
 * - GET /api/menu-items - Fetches all menu items on mount
 * - POST /api/menu-items - Creates new menu items (Manager only)
 * 
 * Features:
 * - Fetches menu items from backend on component mount
 * - Creates new menu items via API
 * - Displays menu items in a grid layout
 * - Search functionality for name and reference number
 * - Loading and error states
 * - Form validation matching backend requirements
 */

import { useState, useEffect } from "react"
import { Search, Plus, Edit, ToggleLeft, ToggleRight, Loader2, Trash2, Eye, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { getAllMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, type MenuItem } from "@/lib/api/menu-items"

export function MenuPanel() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [formData, setFormData] = useState({ 
    name: "", 
    referenceNumber: "", 
    description: "", 
    price: "", 
    isActive: true 
  })
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [viewingItem, setViewingItem] = useState<MenuItem | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [showActiveItems, setShowActiveItems] = useState(true)
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

  // Fetch menu items - matches controller: GET /api/menu-items
  const fetchMenuItems = async () => {
    try {
      setIsLoading(true)
      // API call matches backend response: { success: true, count: number, data: { menuItems: [...] } }
      const menuItems = await getAllMenuItems()
      setItems(menuItems)
    } catch (error) {
      console.error("Error fetching menu items:", error)
      
      // Handle authentication errors or other API errors
      let errorMessage = "Failed to fetch menu items"
      if (error instanceof Error) {
        if (error.message.includes("token") || error.message.includes("Access denied")) {
          errorMessage = "Authentication required. Please log in."
        } else {
          errorMessage = error.message
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch menu items on component mount and when dialog closes
  useEffect(() => {
    fetchMenuItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh items when dialog closes (after create/update)
  useEffect(() => {
    if (!isDialogOpen && !isSaving) {
      fetchMenuItems()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, isSaving])

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = showActiveItems ? item.isActive : !item.isActive
    return matchesSearch && matchesStatus
  })

  const toggleActive = async (item: MenuItem) => {
    if (!isManager) {
      toast({
        title: "Access Denied",
        description: "Only managers can update menu items",
        variant: "destructive",
      })
      return
    }

    try {
      const updatedItem = await updateMenuItem(item.id, {
        isActive: !item.isActive,
      })
      setItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)))
      toast({
        title: "Success",
        description: `${updatedItem.name} ${updatedItem.isActive ? "activated" : "deactivated"}`,
      })
    } catch (error) {
      console.error("Error toggling menu item active status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update menu item",
        variant: "destructive",
      })
    }
  }

  const openCreateDialog = () => {
    setEditingItem(null)
    setFormData({ name: "", referenceNumber: "", description: "", price: "", isActive: true })
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: MenuItem) => {
    // Note: Edit functionality not fully implemented as backend doesn't have update endpoint
    setEditingItem(item)
    setFormData({ 
      name: item.name, 
      referenceNumber: item.referenceNumber, 
      description: item.description || "", 
      price: item.price.toString(), 
      isActive: item.isActive 
    })
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validation matching backend requirements
    if (!formData.name.trim() || !formData.referenceNumber.trim() || !formData.price.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Reference Number, Price)",
        variant: "destructive",
      })
      return
    }

    // Validate price is a positive number
    const price = parseFloat(formData.price)
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Validation Error",
        description: "Price must be a positive number",
        variant: "destructive",
      })
      return
    }

    // Validate reference number length (backend max is 30 characters)
    if (formData.referenceNumber.trim().length > 30) {
      toast({
        title: "Validation Error",
        description: "Reference number must be less than 30 characters",
        variant: "destructive",
      })
      return
    }

    // Validate name length (backend max is 120 characters)
    if (formData.name.trim().length > 120) {
      toast({
        title: "Validation Error",
        description: "Name must be less than 120 characters",
        variant: "destructive",
      })
      return
    }

    if (editingItem) {
      // Update existing menu item
      try {
        setIsSaving(true)
        
        const updateData: { name?: string; description?: string; price?: number; isActive?: boolean } = {}
        
        // Always include all fields that can be updated
        updateData.name = formData.name.trim()
        updateData.isActive = formData.isActive
        
        // Include description (can be empty string to clear it)
        updateData.description = formData.description.trim() || ""
        
        // Always include price as a number (backend will parse it)
        updateData.price = price
        
        const updatedItem = await updateMenuItem(editingItem.id, updateData)
        
        // Update item in the list with the response
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? updatedItem : i)))
        
        // Reset form and close dialog
        setIsDialogOpen(false)
        setFormData({ name: "", referenceNumber: "", description: "", price: "", isActive: true })
        setEditingItem(null)
        
        toast({
          title: "Success",
          description: "Menu item updated successfully",
        })
      } catch (error) {
        console.error("Error updating menu item:", error)
        
        let errorMessage = "Failed to update menu item"
        if (error instanceof Error) {
          errorMessage = error.message
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
      return
    }

    try {
      setIsSaving(true)
      
      // Create menu item via API - matches controller: POST /api/menu-items
      const newItem = await createMenuItem({
        name: formData.name.trim(),
        referenceNumber: formData.referenceNumber.trim(),
        description: formData.description.trim() || undefined,
        price: price,
        isActive: formData.isActive,
      })
      
      // Add new item to the list
      setItems((prev) => [...prev, newItem])
      
      // Reset form and close dialog
      setIsDialogOpen(false)
      setFormData({ name: "", referenceNumber: "", description: "", price: "", isActive: true })
      
      // Show success message matching backend response
      toast({
        title: "Success",
        description: "Menu item created successfully",
      })
    } catch (error) {
      console.error("Error creating menu item:", error)
      
      // Handle specific error messages from backend
      let errorMessage = "Failed to create menu item"
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
          <h2 className="text-2xl font-bold text-foreground">Menu Items</h2>
          <p className="text-sm text-muted-foreground">Manage your menu items</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showActiveItems ? "default" : "outline"}
            onClick={() => setShowActiveItems(true)}
            className={showActiveItems ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Active Items
          </Button>
          <Button
            variant={!showActiveItems ? "default" : "outline"}
            onClick={() => setShowActiveItems(false)}
            className={!showActiveItems ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Inactive Items
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            {isManager && (
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingItem ? "Edit Item" : "Create Item"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-secondary"
                  placeholder="Item name"
                  disabled={isSaving}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Reference Number *</Label>
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  className="bg-secondary"
                  placeholder="e.g., MENU001"
                  disabled={isSaving || !!editingItem}
                  readOnly={!!editingItem}
                  required={!editingItem}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-secondary"
                  placeholder="Item description (optional)"
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
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked === true })}
                  disabled={isSaving}
                />
                <Label htmlFor="isActive" className="text-foreground cursor-pointer">
                  Active
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Update Item" : "Create Item"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-secondary pl-10"
        />
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border bg-card">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <div className="text-center">
                <Utensils className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "No items found matching your search." 
                    : showActiveItems 
                      ? "No active menu items found." 
                      : "No inactive menu items found."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-green-100">
                  <TableHead className="w-16 text-center">#</TableHead>
                  <TableHead className="min-w-[200px]">Name</TableHead>
                  <TableHead className="min-w-[150px]">Reference</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="min-w-[120px]">Price</TableHead>
                  <TableHead className="min-w-[100px] text-center">Status</TableHead>
                  <TableHead className="min-w-[180px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-b">
                {filteredItems.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className="transition-colors cursor-pointer"
                    onClick={() => {
                      setViewingItem(item)
                      setIsViewDialogOpen(true)
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center mx-auto">
                        <span className="font-bold text-sm text-green-600">
                          {index + 1}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className="text-xs font-mono bg-muted/50 border-border/60"
                      >
                        {item.referenceNumber}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {item.description || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold text-primary">
                        PKR {typeof item.price === 'string' ? Math.round(parseFloat(item.price)) : Math.round(item.price)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleActive(item)
                        }}
                        className="focus:outline-none transition-transform hover:scale-110"
                        title={item.isActive ? "Deactivate item" : "Activate item"}
                        disabled={!isManager}
                      >
                        {item.isActive ? (
                          <ToggleRight className="h-6 w-6 text-primary" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {isManager && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Item"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(item)
                              }}
                              className="h-8 w-8"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Item"
                              onClick={(e) => {
                                e.stopPropagation()
                                setItemToDelete(item)
                                setIsDeleteDialogOpen(true)
                              }}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      {/* View Item Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-card max-w-2xl">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-xl font-bold text-foreground">Menu Item Details</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="mt-4 space-y-6">
              {/* Header Section */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">{viewingItem.name}</h3>
                  <Badge variant="outline" className="text-xs font-medium px-2 py-1">
                    {viewingItem.referenceNumber}
                  </Badge>
                </div>
                <Badge 
                  variant={viewingItem.isActive ? "default" : "secondary"}
                  className="text-xs font-medium px-3 py-1"
                >
                  {viewingItem.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Description */}
              {viewingItem.description ? (
                <div className="rounded-lg border border-border bg-secondary/50 p-4">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {viewingItem.description}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="text-sm text-muted-foreground italic">No description available</p>
                </div>
              )}

              {/* Price Section */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground uppercase tracking-wide">Price</span>
                  <span className="text-2xl font-bold text-primary">
                    PKR {typeof viewingItem.price === 'string' ? Math.round(parseFloat(viewingItem.price)) : Math.round(viewingItem.price)}
                  </span>
                </div>
              </div>

              {/* Status Info */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Status: {viewingItem.isActive ? "Available" : "Unavailable"}</span>
                  {isManager && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setIsViewDialogOpen(false)
                        openEditDialog(viewingItem)
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Item
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
            <AlertDialogTitle className="text-foreground">Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{itemToDelete?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!itemToDelete) return
                try {
                  setIsDeleting(true)
                  await deleteMenuItem(itemToDelete.id)
                  setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id))
                  toast({
                    title: "Success",
                    description: "Menu item deleted successfully",
                  })
                  setIsDeleteDialogOpen(false)
                  setItemToDelete(null)
                } catch (error) {
                  console.error("Delete menu item error:", error)
                  let errorMessage = "Failed to delete menu item"
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
