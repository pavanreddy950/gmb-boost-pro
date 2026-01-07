import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Play, Pause, Zap, RefreshCw } from 'lucide-react';
import { serverAutomationService } from '@/lib/serverAutomationService';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileAutomationStatusProps {
  locationId: string;
  businessName: string;
  compact?: boolean;
}

export function ProfileAutomationStatus({ locationId, businessName, compact = false }: ProfileAutomationStatusProps) {
  const { currentUser } = useAuth();
  const [countdown, setCountdown] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: false });
  
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [schedule, setSchedule] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('');
  const [isServerActive, setIsServerActive] = useState(false);
  const [nextPostTime, setNextPostTime] = useState<Date | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const postTriggeredRef = useRef<boolean>(false);

  // Trigger a post when countdown expires
  const triggerPostOnExpiry = useCallback(async () => {
    if (postTriggeredRef.current) return; // Prevent duplicate triggers
    
    postTriggeredRef.current = true;
    setIsPosting(true);
    
    console.log(`🚀 Countdown expired! Triggering post for ${businessName} (${locationId})`);
    
    try {
      const accountId = localStorage.getItem('google_business_account_id');
      
      // Trigger the post via API
      const success = await serverAutomationService.triggerPost(locationId, {
        businessName,
        schedule,
        frequency,
        userId: currentUser?.uid,
        accountId,
        keywords: businessName,
        categories: [],
      });
      
      if (success) {
        console.log(`✅ Post triggered successfully for ${businessName}`);
      } else {
        console.error(`❌ Failed to trigger post for ${businessName}`);
      }
    } catch (error) {
      console.error(`❌ Error triggering post for ${businessName}:`, error);
    } finally {
      // Reset after 10 seconds to allow for next post
      setTimeout(() => {
        postTriggeredRef.current = false;
        setIsPosting(false);
        fetchServerSchedule(); // Refresh to get next scheduled time
      }, 10000);
    }
  }, [locationId, businessName, schedule, frequency, currentUser?.uid]);

  // 🔥 DATABASE ONLY - Fetch from server (which queries database)
  const fetchServerSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await serverAutomationService.getNextPostTime(locationId);
      
      if (response?.success && response.enabled) {
        setIsEnabled(true);
        setSchedule(response.schedule || '');
        setFrequency(response.frequency || '');
        setIsServerActive(response.hasCronJob || true); // Assume active if enabled in DB
        
        if (response.nextPostTime) {
          setNextPostTime(new Date(response.nextPostTime));
          postTriggeredRef.current = false; // Reset trigger flag when we get new schedule
        }
      } else {
        // No local storage fallback - only trust database via server
        setIsEnabled(false);
        setSchedule('');
        setFrequency('');
        setNextPostTime(null);
      }
    } catch (error) {
      console.error(`[ProfileAutomationStatus] Error fetching status for ${locationId}:`, error);
      // Don't set enabled on error - wait for retry
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  // Calculate countdown
  const calculateCountdown = useCallback(() => {
    if (!isEnabled || !nextPostTime) {
      return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: false };
    }

    const now = new Date();
    const diffMs = nextPostTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: true };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, totalSeconds, isExpired: false };
  }, [isEnabled, nextPostTime]);

  // Initial fetch
  useEffect(() => {
    fetchServerSchedule();
    
    // Refresh every 30 seconds
    const syncInterval = setInterval(fetchServerSchedule, 30000);
    
    return () => clearInterval(syncInterval);
  }, [fetchServerSchedule]);

  // Update countdown every second
  useEffect(() => {
    if (!isEnabled) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isExpired: false });
      return;
    }

    setCountdown(calculateCountdown());

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      const newCountdown = calculateCountdown();
      setCountdown(newCountdown);

      // When countdown expires, trigger the post!
      if (newCountdown.isExpired && !postTriggeredRef.current && !isPosting) {
        console.log(`⏰ Countdown expired for ${businessName}! Triggering post...`);
        triggerPostOnExpiry();
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isEnabled, calculateCountdown, businessName, isPosting, triggerPostOnExpiry]);

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'alternative': return 'Every 2 days';
      case 'weekly': return 'Weekly';
      case 'test30s': return 'Test';
      default: return freq;
    }
  };

  if (!isEnabled) {
    if (compact) {
      return (
        <div className="flex items-center gap-1 text-gray-400">
          <Pause className="h-3 w-3" />
          <span className="text-[10px]">Auto-post off</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-md">
        <Pause className="h-3 w-3 text-gray-500" />
        <span className="text-xs text-gray-500">Auto-posting disabled</span>
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {isServerActive && (
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          )}
          <Zap className="h-3 w-3 text-blue-500" />
          <span className="text-[10px] text-blue-600 font-medium">Auto-post on</span>
        </div>
        
        {/* Countdown */}
        {(countdown.isExpired || isPosting) ? (
          <div className="flex items-center gap-1 text-green-600">
            <div className="animate-spin h-2.5 w-2.5 border border-green-600 border-t-transparent rounded-full" />
            <span className="text-[10px] font-semibold">Posting...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3 text-orange-500" />
            <span className="text-xs font-mono font-bold text-gray-700">
              {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </span>
          </div>
        )}
        
        {/* Schedule info */}
        <span className="text-[9px] text-gray-400">
          {formatFrequency(frequency)} @ {schedule}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isServerActive && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
          <Zap className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-semibold text-blue-700">Auto-Posting Active</span>
        </div>
        <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded">
          {formatFrequency(frequency)}
        </span>
      </div>

      {/* Countdown display */}
      <div className="flex items-center justify-center py-2">
        {(countdown.isExpired || isPosting) ? (
          <div className="flex items-center gap-2 text-green-600">
            <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full" />
            <span className="text-sm font-bold">Posting now...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="bg-white rounded px-2 py-1 shadow-sm">
              <span className="text-lg font-mono font-bold text-blue-600">
                {pad(countdown.hours)}
              </span>
            </div>
            <span className="text-lg font-bold text-blue-400">:</span>
            <div className="bg-white rounded px-2 py-1 shadow-sm">
              <span className="text-lg font-mono font-bold text-blue-600">
                {pad(countdown.minutes)}
              </span>
            </div>
            <span className="text-lg font-bold text-blue-400">:</span>
            <div className="bg-white rounded px-2 py-1 shadow-sm">
              <span className="text-lg font-mono font-bold text-orange-500 animate-pulse">
                {pad(countdown.seconds)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <span className="text-[10px] text-gray-500">
          Next post at {schedule}
        </span>
      </div>
    </div>
  );
}
