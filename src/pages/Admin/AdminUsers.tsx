import { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, UserCog, Ban, CheckCircle, XCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';

const AdminUsers = () => {
  const { users, fetchUsers, updateUserRole, toggleUserStatus, cancelUserSubscription, adminLevel } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'role' | 'status' | null>(null);

  useEffect(() => {
    fetchUsers({ search: searchQuery, status: statusFilter });
  }, [searchQuery, statusFilter]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
  };

  const openDialog = (user: any, type: 'role' | 'status') => {
    setSelectedUser(user);
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    await updateUserRole(selectedUser.uid, 'admin', 'moderator');
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    await toggleUserStatus(selectedUser.uid, !selectedUser.disabled);
    setDialogOpen(false);
    setSelectedUser(null);
  };

  const getStatusBadge = (subscription: any) => {
    if (!subscription) return <Badge variant="secondary">No Subscription</Badge>;

    switch (subscription.status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{subscription.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1">Manage users, subscriptions, and permissions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find users by email, name, or status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
          <CardDescription>Complete list of registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>GBP Connected</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>
                        {user.disabled ? (
                          <Badge variant="destructive">
                            <Ban className="h-3 w-3 mr-1" />
                            Suspended
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.subscription)}</TableCell>
                      <TableCell>
                        {user.gbpAccountId ? (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50">
                            <XCircle className="h-3 w-3 mr-1 text-gray-400" />
                            No
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {adminLevel === 'super' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDialog(user, 'role')}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              Role
                            </Button>
                          )}
                          {(adminLevel === 'super' || adminLevel === 'moderator') && (
                            <Button
                              variant={user.disabled ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => openDialog(user, 'status')}
                            >
                              {user.disabled ? 'Activate' : 'Suspend'}
                            </Button>
                          )}
                          {user.gbpAccountId && user.subscription?.status === 'active' && (adminLevel === 'super' || adminLevel === 'moderator') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (window.confirm(`Are you sure you want to cancel the subscription for ${user.email}?`)) {
                                  try {
                                    await cancelUserSubscription(user.gbpAccountId);
                                  } catch (error) {
                                    console.error('Error cancelling subscription:', error);
                                  }
                                }
                              }}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancel Sub
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for actions */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'role' ? 'Update User Role' : 'Toggle User Status'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'role'
                ? `Make ${selectedUser?.email} an admin`
                : `${selectedUser?.disabled ? 'Activate' : 'Suspend'} ${selectedUser?.email}'s account`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={dialogType === 'role' ? handleUpdateRole : handleToggleStatus}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
