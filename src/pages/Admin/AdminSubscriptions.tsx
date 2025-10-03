import { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Plus, X, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const AdminSubscriptions = () => {
  const { subscriptions, fetchSubscriptions, cancelUserSubscription, createUserSubscription } = useAdmin();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Create subscription form state
  const [formData, setFormData] = useState({
    userId: '',
    email: '',
    profileCount: 1,
    durationMonths: 1,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCancelClick = (subscription: any) => {
    setSelectedSubscription(subscription);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedSubscription) return;

    setIsProcessing(true);
    try {
      await cancelUserSubscription(selectedSubscription.gbpAccountId);
      setCancelDialogOpen(false);
      setSelectedSubscription(null);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!formData.userId || !formData.email || formData.profileCount < 1 || formData.durationMonths < 1) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      await createUserSubscription({
        userId: formData.userId,
        email: formData.email,
        profileCount: formData.profileCount,
        durationMonths: formData.durationMonths,
      });
      setCreateDialogOpen(false);
      setFormData({
        userId: '',
        email: '',
        profileCount: 1,
        durationMonths: 1,
      });
    } catch (error) {
      console.error('Failed to create subscription:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
          <p className="text-gray-500 mt-1">View and manage all user subscriptions</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Subscription
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Subscription</DialogTitle>
              <DialogDescription>
                Create a direct subscription for a user. The subscription will be active immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Enter user ID"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profileCount">Number of Profiles</Label>
                <Select
                  value={formData.profileCount.toString()}
                  onValueChange={(value) => setFormData({ ...formData, profileCount: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select profiles" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 50].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'Profile' : 'Profiles'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Select
                  value={formData.durationMonths.toString()}
                  onValueChange={(value) => setFormData({ ...formData, durationMonths: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="2">2 Months</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="9">9 Months</SelectItem>
                    <SelectItem value="12">1 Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleCreateSubscription} disabled={isProcessing}>
                {isProcessing ? 'Creating...' : 'Create Subscription'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions ({subscriptions.length})</CardTitle>
          <CardDescription>Complete list of active and inactive subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profiles</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sub.planId}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>{sub.profileCount || 0}</TableCell>
                    <TableCell>
                      {sub.subscriptionStartDate
                        ? format(new Date(sub.subscriptionStartDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {sub.subscriptionEndDate
                        ? format(new Date(sub.subscriptionEndDate), 'MMM dd, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {sub.amount} {sub.currency}
                    </TableCell>
                    <TableCell>
                      {sub.status !== 'cancelled' && sub.status !== 'expired' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelClick(sub)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this subscription? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">
                    User: {selectedSubscription.email}
                  </p>
                  <p className="text-sm text-amber-700">
                    Plan: {selectedSubscription.planId} ({selectedSubscription.profileCount} profiles)
                  </p>
                  <p className="text-sm text-amber-700">
                    Status: {selectedSubscription.status}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={isProcessing}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm} disabled={isProcessing}>
              {isProcessing ? 'Cancelling...' : 'Yes, Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubscriptions;
