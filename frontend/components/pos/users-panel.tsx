"use client"

import { useState, useEffect } from "react"
import { Search, Plus, Edit, ToggleLeft, ToggleRight, Key, User as UserIcon, Loader2, Eye, EyeOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { getAllUsers, createUser, updateUser, resetUserPassword, deleteUser, type User } from "@/lib/api/users"

export function UsersPanel() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "User" as "Manager" | "User",
    isActive: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Reset Password Dialog State
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  // Delete User Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showActiveUsers, setShowActiveUsers] = useState(true)

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const fetchedUsers = await getAllUsers()
      setUsers(fetchedUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch users",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
    const matchesSearch = user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      fullName.toLowerCase().includes(query)
    const matchesStatus = showActiveUsers ? user.isActive : !user.isActive
    return matchesSearch && matchesStatus
  })

  const toggleActive = async (user: User) => {
    try {
      const updatedUser = await updateUser(user.id, {
        isActive: !user.isActive,
      })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)))
      toast({
        title: "Success",
        description: `User ${updatedUser.isActive ? "activated" : "deactivated"} successfully`,
      })
    } catch (error) {
      console.error("Error toggling user active status:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive",
      })
    }
  }

  const openCreateDialog = () => {
    setEditingUser(null)
    setFormData({
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "User",
      isActive: true,
    })
    setShowPassword(false)
    setIsDialogOpen(true)
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role as "Manager" | "User",
      isActive: user.isActive,
    })
    setShowPassword(false)
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation for create
    if (!editingUser) {
      if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim()) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields (Username, Email, Password)",
          variant: "destructive",
        })
        return
      }

      // Username validation
      if (formData.username.length < 3 || formData.username.length > 100) {
        toast({
          title: "Validation Error",
          description: "Username must be between 3 and 100 characters",
          variant: "destructive",
        })
        return
      }

      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        toast({
          title: "Validation Error",
          description: "Username can only contain letters, numbers, and underscores",
          variant: "destructive",
        })
        return
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        toast({
          title: "Validation Error",
          description: "Please provide a valid email address",
          variant: "destructive",
        })
        return
      }

      // Password validation
      if (formData.password.length < 6) {
        toast({
          title: "Validation Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsSaving(true)

      if (editingUser) {
        // Update user - only firstName, lastName, isActive can be updated
        // Backend API: PATCH /api/users/:id
        // Expected body: { firstName?, lastName?, isActive? }
        // Backend controller: updateUserController in backend/src/controllers/user.controller.js
        const updateData: { firstName?: string | null; lastName?: string | null; isActive?: boolean } = {
          firstName: formData.firstName.trim() || null,
          lastName: formData.lastName.trim() || null,
          isActive: formData.isActive,
        }

        // Call the update API endpoint (PATCH /api/users/:id)
        const updatedUser = await updateUser(editingUser.id, updateData)
        
        // Update the users list with the response from backend
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedUser : u)))
        
        toast({
          title: "Success",
          description: "User updated successfully",
        })
      } else {
        // Create new user
        const newUser = await createUser({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          firstName: formData.firstName.trim() || undefined,
          lastName: formData.lastName.trim() || undefined,
          isActive: formData.isActive,
        })
        setUsers((prev) => [...prev, newUser])
        toast({
          title: "Success",
          description: "User created successfully",
        })
      }

      setIsDialogOpen(false)
      setFormData({
        username: "",
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "User",
        isActive: true,
      })
    } catch (error) {
      console.error("Error saving user:", error)
      let errorMessage = "Failed to save user"
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

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user)
    setNewPassword("")
    setShowResetPassword(false)
    setIsResetPasswordOpen(true)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordUser) return

    // Validation
    if (!newPassword.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a new password",
        variant: "destructive",
      })
      return
    }

    // Validate password length
    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    // Validate password complexity
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
      setIsResettingPassword(true)
      await resetUserPassword(resetPasswordUser.id, {
        newPassword: newPassword,
      })

      toast({
        title: "Success",
        description: "Password reset successfully",
      })

      // Reset form and close dialog
      setNewPassword("")
      setIsResetPasswordOpen(false)
    } catch (error) {
      console.error("Reset password error:", error)
      let errorMessage = "Failed to reset password"
      if (error instanceof Error) {
        errorMessage = error.message
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsResettingPassword(false)
    }
  }

  const openDeleteDialog = (user: User) => {
    setUserToDelete(user)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    try {
      setIsDeleting(true)
      await deleteUser(userToDelete.id)
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      toast({
        title: "Success",
        description: "User deleted successfully",
      })
      setIsDeleteDialogOpen(false)
      setUserToDelete(null)
    } catch (error) {
      console.error("Delete user error:", error)
      let errorMessage = "Failed to delete user"
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
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">Manage staff accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={showActiveUsers ? "default" : "outline"}
            onClick={() => setShowActiveUsers(true)}
            className={showActiveUsers ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Active Users
          </Button>
          <Button
            variant={!showActiveUsers ? "default" : "outline"}
            onClick={() => setShowActiveUsers(false)}
            className={!showActiveUsers ? "" : "bg-secondary hover:bg-secondary/80"}
          >
            Inactive Users
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingUser ? "Edit User" : "Create User"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-foreground">Username *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="bg-secondary"
                  placeholder="username"
                  disabled={!!editingUser || isSaving}
                  required={!editingUser}
                />
                {!editingUser && (
                  <p className="text-xs text-muted-foreground">
                    3-100 characters, letters, numbers, and underscores only
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-secondary"
                  placeholder="email@example.com"
                  disabled={!!editingUser || isSaving}
                  required={!editingUser}
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label className="text-foreground">Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="bg-secondary pr-10"
                      placeholder="Password"
                      disabled={isSaving}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isSaving}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">First Name</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="bg-secondary"
                    placeholder="First name"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Last Name</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="bg-secondary"
                    placeholder="Last name"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: "Manager" | "User") => setFormData({ ...formData, role: value })}
                  disabled={isSaving || !!editingUser}
                >
                  <SelectTrigger className="bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                {editingUser && (
                  <p className="text-xs text-muted-foreground">Role cannot be changed after user creation</p>
                )}
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
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users..."
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
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <div className="text-center">
                <UserIcon className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? "No users found matching your search." 
                    : showActiveUsers 
                      ? "No active users found." 
                      : "No inactive users found."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-green-100">
                  <TableHead className="w-16 text-center">#</TableHead>
                  <TableHead className="w-12">
                    <div className="flex h-10 w-10 items-center justify-center">
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[200px]">Name</TableHead>
                  <TableHead className="min-w-[180px]">Username</TableHead>
                  <TableHead className="min-w-[220px]">Email</TableHead>
                  <TableHead className="min-w-[100px]">Role</TableHead>
                  <TableHead className="min-w-[100px] text-center">Status</TableHead>
                  <TableHead className="min-w-[180px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr:last-child]:border-b">
                {filteredUsers.map((user, index) => {
                  const fullName = user.firstName || user.lastName
                    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                    : null
                  
                  return (
                    <TableRow
                      key={user.id}
                      className="transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center justify-center mx-auto">
                          <span className="font-bold text-sm text-green-600">
                            {index + 1}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <UserIcon className="h-5 w-5 text-primary" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {fullName || user.username}
                          </span>
                          {fullName && (
                            <span className="text-xs text-muted-foreground">{user.username}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">{user.username}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.role === "Manager" ? "default" : "secondary"}
                          className="font-medium"
                        >
                          {user.role === "Manager" ? "Manager" : "Staff"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => toggleActive(user)}
                          className="focus:outline-none transition-transform hover:scale-110"
                          title={user.isActive ? "Deactivate user" : "Activate user"}
                        >
                          {user.isActive ? (
                            <ToggleRight className="h-6 w-6 text-primary" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset Password"
                            onClick={() => openResetPasswordDialog(user)}
                            className="h-8 w-8"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit User"
                            onClick={() => openEditDialog(user)}
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete User"
                            onClick={() => openDeleteDialog(user)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Reset Password for {resetPasswordUser?.firstName || resetPasswordUser?.lastName
                ? `${resetPasswordUser.firstName || ""} ${resetPasswordUser.lastName || ""}`.trim()
                : resetPasswordUser?.username}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">
                New Password *
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary pr-10"
                  disabled={isResettingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isResettingPassword}
                >
                  {showResetPassword ? (
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
                onClick={() => {
                  setIsResetPasswordOpen(false)
                  setResetPasswordUser(null)
                  setNewPassword("")
                }}
                className="flex-1"
                disabled={isResettingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isResettingPassword}
              >
                {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {userToDelete?.firstName || userToDelete?.lastName
                  ? `${userToDelete.firstName || ""} ${userToDelete.lastName || ""}`.trim()
                  : userToDelete?.username}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
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
