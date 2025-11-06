import { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { Ticket, Plus, Ban, CheckCircle, Calendar, Percent, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const AdminCoupons = () => {
  const { coupons, fetchCoupons, createCoupon, deactivateCoupon, adminLevel } = useAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    maxUses: '',
    expiresAt: '',
    description: '',
    oneTimePerUser: false,
    singleUse: false,
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreateCoupon = async () => {
    try {
      await createCoupon({
        code: formData.code.toUpperCase(),
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        description: formData.description,
        oneTimePerUser: formData.oneTimePerUser,
        singleUse: formData.singleUse,
      });
      setDialogOpen(false);
      setFormData({
        code: '',
        discountType: 'percentage',
        discountValue: '',
        maxUses: '',
        expiresAt: '',
        description: '',
        oneTimePerUser: false,
        singleUse: false,
      });
    } catch (error) {
      console.error('Error creating coupon:', error);
    }
  };

  const handleDeactivate = async (code: string) => {
    try {
      await deactivateCoupon(code);
    } catch (error) {
      console.error('Error deactivating coupon:', error);
    }
  };

  const getStatusBadge = (coupon: any) => {
    if (!coupon.isActive) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      return <Badge variant="secondary">Max Uses Reached</Badge>;
    }
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const canModify = adminLevel === 'super' || adminLevel === 'moderator';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupon Management</h1>
          <p className="text-gray-500 mt-1">Create and manage discount coupons</p>
        </div>
        {canModify && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Coupon
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Coupons</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.filter((c: any) => c.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.reduce((sum: number, c: any) => sum + (c.currentUses || 0), 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.filter((c: any) =>
                c.expiresAt && new Date(c.expiresAt) < new Date()
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Coupons ({coupons.length})</CardTitle>
          <CardDescription>Manage discount codes and promotions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length > 0 ? (
                  coupons.map((coupon: any) => (
                    <TableRow key={coupon.code}>
                      <TableCell className="font-mono font-bold">
                        {coupon.code}
                      </TableCell>
                      <TableCell>
                        {coupon.discountType === 'percentage' ? (
                          <span className="flex items-center gap-1">
                            <Percent className="h-4 w-4" />
                            {coupon.discountValue}% off
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            ${coupon.discountValue} off
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(coupon)}</TableCell>
                      <TableCell>
                        {coupon.currentUses || 0}
                        {coupon.maxUses && ` / ${coupon.maxUses}`}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {coupon.createdAt && !isNaN(new Date(coupon.createdAt).getTime())
                          ? format(new Date(coupon.createdAt), 'MMM dd, yyyy')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {coupon.expiresAt && !isNaN(new Date(coupon.expiresAt).getTime()) ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(coupon.expiresAt), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          'No expiry'
                        )}
                      </TableCell>
                      <TableCell>
                        {canModify && coupon.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeactivate(coupon.code)}
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No coupons found. Create your first coupon to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Coupon Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
            <DialogDescription>
              Add a new discount coupon for your users
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code</Label>
              <Input
                id="code"
                placeholder="SUMMER2024"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type</Label>
              <Select
                value={formData.discountType}
                onValueChange={(value) => setFormData({ ...formData, discountType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountValue">
                Discount Value {formData.discountType === 'percentage' ? '(%)' : '($)'}
              </Label>
              <Input
                id="discountValue"
                type="number"
                placeholder={formData.discountType === 'percentage' ? '20' : '10'}
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">Max Uses (Optional)</Label>
              <Input
                id="maxUses"
                type="number"
                placeholder="100"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                type="text"
                placeholder="Special discount for premium users"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="oneTimePerUser"
                type="checkbox"
                checked={formData.oneTimePerUser}
                onChange={(e) => setFormData({ ...formData, oneTimePerUser: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="oneTimePerUser" className="cursor-pointer">
                One-time use per user (each user can only use this coupon once)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="singleUse"
                type="checkbox"
                checked={formData.singleUse}
                onChange={(e) => setFormData({ ...formData, singleUse: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="singleUse" className="cursor-pointer">
                🔒 Single use (auto-disable after FIRST use by ANY user)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCoupon} disabled={!formData.code || !formData.discountValue}>
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
