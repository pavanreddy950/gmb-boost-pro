import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GlobalPostingTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: any[];
}

export function GlobalPostingTimeModal({ isOpen, onClose, profiles }: GlobalPostingTimeModalProps) {
  const { currentUser } = useAuth();
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [selectedHour, setSelectedHour] = useState('10'); // 1-12 format
  const [selectedMinute, setSelectedMinute] = useState('00'); // 00-59
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedFrequency, setSelectedFrequency] = useState<'daily' | 'alternative' | 'weekly'>('daily');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResults, setUpdateResults] = useState<{ locationId: string; name: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedHour('10');
      setSelectedMinute('00');
      setSelectedPeriod('AM');
      setSelectedFrequency('daily');
      setShowResults(false);
      setUpdateResults([]);
    }
  }, [isOpen]);

  // Generate hour options (1-12 for 12-hour format) in correct order
  const hourOptions = [
    { value: '1', label: '01' },
    { value: '2', label: '02' },
    { value: '3', label: '03' },
    { value: '4', label: '04' },
    { value: '5', label: '05' },
    { value: '6', label: '06' },
    { value: '7', label: '07' },
    { value: '8', label: '08' },
    { value: '9', label: '09' },
    { value: '10', label: '10' },
    { value: '11', label: '11' },
    { value: '12', label: '12' }
  ];

  // Generate minute options (0-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: i.toString().padStart(2, '0')
  }));

  // Convert selected time parts to 24-hour format for backend
  const getTime24Hour = () => {
    let hour = parseInt(selectedHour);
    
    if (selectedPeriod === 'AM') {
      // AM: 12 AM = 00:xx, 1-11 AM = 01:xx to 11:xx
      if (hour === 12) {
        hour = 0;
      }
    } else {
      // PM: 12 PM = 12:xx, 1-11 PM = 13:xx to 23:xx
      if (hour !== 12) {
        hour += 12;
      }
    }
    
    const result = `${hour.toString().padStart(2, '0')}:${selectedMinute}`;
    console.log(`[GlobalPostingTime] Converting ${selectedHour}:${selectedMinute} ${selectedPeriod} → ${result}`);
    return result;
  };

  // Update selectedTime whenever parts change
  useEffect(() => {
    const time24 = getTime24Hour();
    setSelectedTime(time24);
    console.log(`[GlobalPostingTime] Time updated: ${selectedHour}:${selectedMinute} ${selectedPeriod} = ${time24}`);
  }, [selectedHour, selectedMinute, selectedPeriod]);

  // Get display time for UI
  const getDisplayTime = () => {
    const hourDisplay = selectedHour.padStart(2, '0');
    return `${hourDisplay}:${selectedMinute} ${selectedPeriod}`;
  };

  const handleApplyGlobalTime = async () => {
    if (!currentUser?.uid) {
      toast.error('Please login first');
      return;
    }

    setIsUpdating(true);
    setUpdateResults([]);
    setShowResults(false);

    const results: { locationId: string; name: string; success: boolean; error?: string }[] = [];
    const accountId = localStorage.getItem('google_business_account_id');

    // 🔥 DATABASE ONLY - Call the global-time API which updates ALL profiles in database
    try {
      console.log(`[GlobalPostingTime] Updating all profiles to ${selectedTime} (${selectedFrequency})`);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/automation/global-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule: selectedTime,
          frequency: selectedFrequency,
          userId: currentUser.uid,
          gbpAccountId: accountId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reason === 'no_subscription') {
          toast.error('❌ No valid subscription. Please upgrade to enable auto-posting.');
          setIsUpdating(false);
          return;
        }
        throw new Error(data.error || 'Failed to update');
      }

      console.log(`[GlobalPostingTime] API Response:`, data);

      // Show results from API
      if (data.results && data.results.length > 0) {
        for (const result of data.results) {
          results.push({
            locationId: result.locationId,
            name: result.businessName || result.locationId,
            success: result.success,
            error: result.error
          });
        }
      } else {
        // No results returned - might mean no profiles found
        toast.warning('No profiles found to update. Please ensure auto-posting is enabled for your profiles.');
      }

      setUpdateResults(results);
      setShowResults(true);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0 && successCount > 0) {
        toast.success(`✅ Updated ${successCount} profile(s) to post at ${getDisplayTime()}`);
        
        // Trigger page refresh after 2 seconds to show updated countdowns
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else if (successCount > 0) {
        toast.warning(`Updated ${successCount} profile(s), ${failCount} failed`);
      } else if (results.length === 0) {
        toast.info('No profiles updated');
      } else {
        toast.error('Failed to update profiles');
      }
    } catch (error: any) {
      console.error('[GlobalPostingTime] Error:', error);
      toast.error(`Failed to update: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setShowResults(false);
    setUpdateResults([]);
    onClose();
  };

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Every Day';
      case 'alternative': return 'Every 2 Days';
      case 'weekly': return 'Weekly';
      default: return freq;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Set Global Posting Time
          </DialogTitle>
          <DialogDescription>
            Apply the same posting schedule to all your business profiles at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showResults ? (
            <>
              {/* Custom Time Selection with Hour:Minute:AM/PM */}
              <div className="space-y-2">
                <Label>Posting Time</Label>
                <div className="flex items-center gap-2">
                  {/* Hour Select */}
                  <Select value={selectedHour} onValueChange={setSelectedHour}>
                    <SelectTrigger className="w-20">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[9999]" position="popper" sideOffset={4}>
                      {hourOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <span className="text-xl font-bold text-gray-500">:</span>
                  
                  {/* Minute Select */}
                  <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                    <SelectTrigger className="w-20">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48 z-[9999]" position="popper" sideOffset={4}>
                      {minuteOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* AM/PM Select */}
                  <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as 'AM' | 'PM')}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                      <SelectItem value="AM">AM</SelectItem>
                      <SelectItem value="PM">PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  All profiles will post at this time ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </p>
              </div>

              {/* Frequency Selection */}
              <div className="space-y-2">
                <Label htmlFor="globalFrequency">Posting Frequency</Label>
                <Select value={selectedFrequency} onValueChange={(v) => setSelectedFrequency(v as any)}>
                  <SelectTrigger id="globalFrequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="alternative">Every 2 Days</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Profiles Summary */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  <strong>{profiles?.length || 0} profile(s)</strong> will be updated to post <strong>{formatFrequency(selectedFrequency)}</strong> at{' '}
                  <strong>{getDisplayTime()}</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleApplyGlobalTime} 
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Apply to All Profiles
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-3">
                <h4 className="font-medium">Update Results</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {updateResults.map((result) => (
                    <div 
                      key={result.locationId}
                      className={`p-3 rounded-lg border ${
                        result.success 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${
                          result.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {result.name}
                        </span>
                      </div>
                      {!result.success && result.error && (
                        <p className="text-xs text-red-600 mt-1 ml-6">{result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
