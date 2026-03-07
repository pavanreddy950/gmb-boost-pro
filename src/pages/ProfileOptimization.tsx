import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  Sparkles,
  Zap,
  Target,
  Shield,
  Clock,
  History,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Rocket,
  Brain,
  BarChart3,
  Search,
  FileText,
  Tags,
  Image,
  Star,
  MessageSquare,
  Link2,
  Settings2,
  Loader2,
  Play,
  Eye,
} from 'lucide-react';
import { useGoogleBusinessProfileContext } from '@/contexts/GoogleBusinessProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import OptimizationDashboard from '@/components/optimization/OptimizationDashboard';
import SuggestionPreview from '@/components/optimization/SuggestionPreview';
import DeploymentTimeline from '@/components/optimization/DeploymentTimeline';
import ChangeHistory from '@/components/optimization/ChangeHistory';

// Types
interface OptimizationJob {
  id: string;
  status: string;
  audit_score: number;
  created_at: string;
}

interface AuditModule {
  name: string;
  score: number;
  weight: number;
  maxPoints: number;
  points: number;
  recommendations: string[];
  details: Record<string, any>;
}

interface AuditResults {
  overallScore: number;
  scoreLabel: string;
  modules: AuditModule[];
  keywords: {
    extracted: string[];
    gaps: Array<{ keyword: string; inDescription: boolean; inServices: boolean; inCategories: boolean; inProducts: boolean }>;
  };
}

interface Suggestion {
  id: string;
  suggestion_type: string;
  original_content: string | null;
  suggested_content: string;
  ai_reasoning: string | null;
  risk_score: number;
  risk_details: any;
  user_approved: boolean | null;
  user_edited_content: string | null;
  metadata: any;
}

interface Deployment {
  id: string;
  deploy_type: string;
  deploy_day: number;
  scheduled_at: string;
  status: string;
  applied_at: string | null;
  error_message: string | null;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

const pulseVariants = {
  pulse: {
    scale: [1, 1.02, 1],
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' }
  }
};

const shimmer = {
  initial: { backgroundPosition: '-200% 0' },
  animate: {
    backgroundPosition: '200% 0',
    transition: { repeat: Infinity, duration: 3, ease: 'linear' }
  }
};

// Scanning progress steps
const SCAN_STEPS = [
  { label: 'Fetching profile data', icon: Search },
  { label: 'Analyzing categories & attributes', icon: Tags },
  { label: 'Scanning photos & media', icon: Image },
  { label: 'Reviewing customer feedback', icon: Star },
  { label: 'Extracting keywords', icon: Brain },
  { label: 'Running AI analysis', icon: Sparkles },
  { label: 'Calculating risk scores', icon: Shield },
  { label: 'Generating suggestions', icon: Zap },
];

const ProfileOptimization: React.FC = () => {
  const { accounts, isConnected } = useGoogleBusinessProfileContext();
  const { currentUser } = useAuth();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

  // State
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('audit');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);

  // Data state
  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [auditResults, setAuditResults] = useState<AuditResults | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [hasExistingJob, setHasExistingJob] = useState(false);
  const [retryingDeploymentId, setRetryingDeploymentId] = useState<string | null>(null);

  // Get all locations from all accounts
  const allLocations = accounts.flatMap(account =>
    (account.locations || []).map(loc => ({
      ...loc,
      accountId: account.accountId || account.name?.split('/')[1] || '',
      accountName: account.accountName
    }))
  );

  // Load existing job when location is selected
  useEffect(() => {
    if (selectedLocationId && currentUser?.email) {
      loadExistingJob();
    }
  }, [selectedLocationId]);

  const loadExistingJob = async () => {
    try {
      const res = await fetch(
        `${backendUrl}/api/profile-optimizer/jobs/latest/${selectedLocationId}?userId=${encodeURIComponent(currentUser?.email || '')}`,
      );
      const data = await res.json();

      if (data.job) {
        setJob(data.job);
        setAuditResults(data.job.audit_data);
        setSuggestions(data.suggestions || []);
        setDeployments(data.deployments || []);
        setHasExistingJob(true);
      } else {
        setJob(null);
        setAuditResults(null);
        setSuggestions([]);
        setDeployments([]);
        setHasExistingJob(false);
      }
    } catch (error) {
      console.error('Failed to load existing job:', error);
    }
  };

  // Handle location selection
  const handleLocationSelect = (value: string) => {
    const [accountId, locationId] = value.split('::');
    setSelectedLocationId(locationId);
    setSelectedAccountId(accountId);
    setJob(null);
    setAuditResults(null);
    setSuggestions([]);
    setDeployments([]);
  };

  // Click "Optimize Profile" → run scan immediately
  const handleOptimizeClick = () => {
    if (!selectedLocationId || !selectedAccountId) return;
    startOptimization();
  };

  const startOptimization = async () => {
    if (!selectedLocationId || !selectedAccountId || !currentUser?.email) return;

    setIsOptimizing(true);
    setScanStep(0);
    setScanProgress(0);

    // Animate scan progress — cap at 99 so it never goes over 100
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 99) return 99;
        if (prev >= 88) return prev + 0.5;
        if (prev >= 70) return prev + Math.random() * 3;
        return prev + Math.random() * 8;
      });
      setScanStep(prev => {
        if (prev >= SCAN_STEPS.length - 1) return SCAN_STEPS.length - 1;
        return prev + (Math.random() > 0.6 ? 1 : 0);
      });
    }, 800);

    try {
      const storedTokens = localStorage.getItem('google_business_tokens');
      if (!storedTokens) {
        throw new Error('No Google Business Profile connection found. Please connect in Settings > Connections.');
      }
      const tokens = JSON.parse(storedTokens);
      if (!tokens.access_token) {
        throw new Error('Invalid token data. Please reconnect your Google Business Profile in Settings.');
      }
      const accessToken = tokens.access_token;

      const res = await fetch(`${backendUrl}/api/profile-optimizer/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          locationId: selectedLocationId,
          accountId: selectedAccountId,
          userId: currentUser.email,
          businessContext: { currency: 'INR', tone: 'professional', targetAudience: 'local_residents', priceRange: 'mid_range' },
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Optimization failed');

      setScanProgress(100);
      setScanStep(SCAN_STEPS.length - 1);

      // Small delay for the progress animation to complete
      await new Promise(r => setTimeout(r, 500));

      setJob(data.job);
      setAuditResults(data.audit);
      setSuggestions(data.suggestions || []);
      // deployments are returned directly by the backend (existing history preserved)
      setDeployments(data.deployments || []);
      setHasExistingJob(true);

      const newCount = (data.suggestions || []).filter((s: any) =>
        !deployments.some(d => d.suggestion_id === s.id)
      ).length;
      toast({
        title: 'Optimization Complete',
        description: `Score: ${data.audit?.overallScore || 0}/100 · ${data.suggestions?.length || 0} total suggestions`,
      });
    } catch (error: any) {
      console.error('Optimization error:', error);
      toast({
        title: 'Optimization Failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      clearInterval(progressInterval);
      setIsOptimizing(false);
      setScanProgress(0);
      setScanStep(0);
    }
  };

  // Handle suggestion actions
  const handleApproveSuggestion = async (suggestionId: string, editedContent?: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/profile-optimizer/suggestions/${suggestionId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedContent, jobId: job?.id }),
      });
      const data = await res.json();
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, ...data } : s));
      toast({ title: 'Suggestion approved' });
    } catch (error) {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/profile-optimizer/suggestions/${suggestionId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job?.id }),
      });
      const data = await res.json();
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, ...data } : s));
      toast({ title: 'Suggestion rejected' });
    } catch (error) {
      toast({ title: 'Failed to reject', variant: 'destructive' });
    }
  };

  const handleRegenerateSuggestion = async (suggestionId: string, feedback?: string) => {
    try {
      const storedTokens = localStorage.getItem('google_business_tokens');
      const tokens = storedTokens ? JSON.parse(storedTokens) : {};
      const accessToken = tokens.access_token || '';
      const res = await fetch(`${backendUrl}/api/profile-optimizer/suggestions/${suggestionId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          feedback,
          jobId: job?.id,
          userId: currentUser?.email,
          locationId: selectedLocationId,
          accountId: selectedAccountId,
        }),
      });
      const data = await res.json();
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, ...data } : s));
      toast({ title: 'Suggestion regenerated' });
    } catch (error) {
      toast({ title: 'Failed to regenerate', variant: 'destructive' });
    }
  };

  // Deploy actions
  const handleScheduleDeployment = async () => {
    if (!job?.id) return;
    try {
      const storedTokens = localStorage.getItem('google_business_tokens');
      const tokens = storedTokens ? JSON.parse(storedTokens) : {};
      const accessToken = tokens.access_token || '';

      const res = await fetch(`${backendUrl}/api/profile-optimizer/deploy/${job.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ locationId: selectedLocationId, accountId: selectedAccountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deploy failed');
      setDeployments(data.schedule || []);

      // Update score — use backend projection if available, otherwise reload from DB
      if (data.newScore !== null && data.newScore !== undefined && data.newAudit) {
        setAuditResults(data.newAudit);
        setJob(prev => prev ? { ...prev, audit_score: data.newScore } : prev);
      } else {
        // Fallback: re-fetch the job row which has the updated audit_score saved by the backend
        await loadExistingJob();
      }

      const applied = (data.schedule || []).filter((d: any) => d.gbp_applied).length;
      const total = (data.schedule || []).length;
      toast({
        title: 'Changes Deployed!',
        description: `${applied}/${total} changes pushed to Google Business Profile${data.newScore !== null && data.newScore !== undefined ? ` · Score: ${data.newScore}/100` : ''}`,
      });
      setActiveTab('deploy');
    } catch (error: any) {
      toast({ title: 'Failed to deploy', description: error.message, variant: 'destructive' });
    }
  };

  const handleRollback = async (deploymentId: string) => {
    try {
      await fetch(`${backendUrl}/api/profile-optimizer/deploy/${deploymentId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job?.id }),
      });
      await loadExistingJob();
      toast({ title: 'Change rolled back' });
    } catch (error) {
      toast({ title: 'Failed to rollback', variant: 'destructive' });
    }
  };

  const handleRetryDeployment = async (deploymentId: string) => {
    if (!job?.id || !selectedLocationId) return;
    setRetryingDeploymentId(deploymentId);
    try {
      const storedTokens = localStorage.getItem('google_business_tokens');
      const tokens = storedTokens ? JSON.parse(storedTokens) : {};
      const accessToken = tokens.access_token || '';

      const res = await fetch(
        `${backendUrl}/api/profile-optimizer/deploy/${job.id}/retry/${deploymentId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ locationId: selectedLocationId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');

      // Update the specific deployment in state
      const updated: any = data.deployment;
      setDeployments(prev => prev.map(d => d.id === deploymentId ? { ...d, ...updated } : d));

      if (updated.gbp_applied) {
        toast({ title: 'Retry successful!', description: 'Change pushed to Google Business Profile.' });
      } else {
        toast({
          title: 'Still needs manual action',
          description: updated.gbp_note || 'Could not auto-deploy — set manually in GBP.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({ title: 'Retry failed', description: error.message, variant: 'destructive' });
    } finally {
      setRetryingDeploymentId(null);
    }
  };

  // Counts
  const approvedCount = suggestions.filter(s => s.user_approved === true).length;
  const pendingCount = suggestions.filter(s => s.user_approved === null).length;
  // Suggestions that are approved but don't yet have a deployment record
  const deployedSuggestionIds = new Set(deployments.map((d: any) => d.suggestion_id).filter(Boolean));
  const approvedNotDeployedCount = suggestions.filter(
    s => s.user_approved === true && !deployedSuggestionIds.has(s.id)
  ).length;

  // ==========================================
  // RENDER
  // ==========================================

  // Not connected state
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Card className="border-0 shadow-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-900" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Connect Your Google Business Profile</h2>
              <p className="text-muted-foreground max-w-md">
                Connect your Google account first to start optimizing your business profiles with AI.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
    {/* Coming Soon Overlay */}
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md" style={{minHeight: '100%'}}>
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary via-blue-500 to-cyan-400 flex items-center justify-center shadow-2xl shadow-primary/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
        </div>
        <h2 className="text-4xl font-bold text-white tracking-tight">Coming Soon</h2>
        <p className="text-lg text-white/70 max-w-md">We're working hard to bring you a powerful Profile Optimization experience. Stay tuned!</p>
        <div className="flex gap-2 mt-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '0ms'}} />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay: '150ms'}} />
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay: '300ms'}} />
        </div>
      </div>
    </div>
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

        {/* ===== HEADER ===== */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="relative"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-primary/25">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white"
              />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Profile Optimizer</h1>
              <p className="text-sm text-muted-foreground">One-click AI optimization for your Google Business Profile</p>
            </div>
          </div>

          {/* Location Selector */}
          <div className="flex items-center gap-3">
            <Select onValueChange={handleLocationSelect}>
              <SelectTrigger className="w-[320px] h-11 border-2 border-border/50 bg-white/80 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 rounded-xl shadow-sm">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl border-0">
                {accounts.map((account) => {
                  const locations = account.locations || [];
                  const accountId = account.accountId || account.name?.split('/')[1] || '';
                  // Only show group header if account has multiple locations
                  if (locations.length > 1) {
                    return (
                      <SelectGroup key={account.name}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
                          {account.accountName}
                        </SelectLabel>
                        {locations.map((loc) => (
                          <SelectItem
                            key={loc.locationId}
                            value={`${accountId}::${loc.locationId}`}
                            className="px-3 py-2.5 cursor-pointer rounded-lg mx-1 hover:bg-primary/5"
                          >
                            <span className="font-medium">{loc.displayName}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  }
                  // Single location per account - just show the location directly
                  return locations.map((loc) => (
                    <SelectItem
                      key={loc.locationId}
                      value={`${accountId}::${loc.locationId}`}
                      className="px-3 py-2.5 cursor-pointer rounded-lg mx-1 hover:bg-primary/5"
                    >
                      <span className="font-medium">{loc.displayName}</span>
                    </SelectItem>
                  ));
                })}
              </SelectContent>
            </Select>

            {/* Optimize Button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleOptimizeClick}
                disabled={!selectedLocationId || isOptimizing}
                className="h-11 px-6 rounded-xl bg-gradient-to-r from-primary via-blue-600 to-cyan-500 hover:from-primary/90 hover:via-blue-600/90 hover:to-cyan-500/90 text-white font-semibold shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all duration-300"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Optimize Profile
                  </>
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* ===== SCANNING ANIMATION ===== */}
        <AnimatePresence>
          {isOptimizing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white overflow-hidden relative">
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
                      animate={{
                        x: [Math.random() * 800, Math.random() * 800],
                        y: [Math.random() * 200, Math.random() * 200],
                        opacity: [0, 1, 0],
                      }}
                      transition={{ repeat: Infinity, duration: 3 + i, delay: i * 0.5 }}
                      style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                    />
                  ))}
                </div>

                <CardContent className="relative py-8 px-8">
                  <div className="flex items-center gap-6">
                    {/* AI Brain Animation */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="relative flex-shrink-0"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                        <Brain className="w-10 h-10 text-white" />
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-lg"
                      />
                    </motion.div>

                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">Deep Profile Scan</h3>
                          <p className="text-sm text-blue-200/80">Analyzing across 13 optimization modules · AI generation takes 30–60 seconds</p>
                        </div>
                        <span className="text-2xl font-bold text-cyan-400">{Math.round(scanProgress)}%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400"
                          animate={{ width: `${scanProgress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>

                      {/* Current step */}
                      <div className="flex items-center gap-3">
                        {SCAN_STEPS.map((step, i) => {
                          const StepIcon = step.icon;
                          const isActive = i === scanStep;
                          const isDone = i < scanStep;
                          return (
                            <motion.div
                              key={i}
                              animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ repeat: isActive ? Infinity : 0, duration: 0.8 }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                                isDone ? 'bg-green-500/20 text-green-400' :
                                isActive ? 'bg-cyan-400/20 text-cyan-400 ring-2 ring-cyan-400/40' :
                                'bg-white/5 text-white/30'
                              }`}
                            >
                              {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                            </motion.div>
                          );
                        })}
                      </div>

                      <p className="text-sm text-blue-200/60 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {SCAN_STEPS[scanStep]?.label || 'Processing...'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== NO LOCATION SELECTED ===== */}
        {!selectedLocationId && !isOptimizing && (
          <motion.div variants={itemVariants}>
            <Card className="border-2 border-dashed border-border/50 bg-gradient-to-br from-slate-50/80 to-blue-50/30 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="mb-6"
                >
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-cyan-500/10 flex items-center justify-center border border-primary/20">
                    <Target className="w-12 h-12 text-primary/60" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-foreground mb-2">Select a Location to Optimize</h3>
                <p className="text-muted-foreground max-w-md text-sm">
                  Choose a Google Business Profile location from the dropdown above to start the AI-powered optimization process.
                </p>
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
                  {[
                    { icon: BarChart3, label: '13 Audit Modules', color: 'from-blue-500 to-cyan-500' },
                    { icon: Sparkles, label: 'AI Suggestions', color: 'from-purple-500 to-pink-500' },
                    { icon: Shield, label: 'Google Safe', color: 'from-green-500 to-emerald-500' },
                    { icon: Zap, label: 'Instant Deploy', color: 'from-amber-500 to-orange-500' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/80 shadow-sm border border-border/30"
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ===== MAIN CONTENT (after optimization) ===== */}
        {selectedLocationId && auditResults && !isOptimizing && (
          <motion.div variants={itemVariants}>
            {/* Score Summary Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <Card className="border-0 shadow-lg bg-gradient-to-r from-white via-white to-blue-50/50 overflow-hidden">
                <CardContent className="py-4 px-6">
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-4">
                      {/* Score Circle */}
                      <div className="relative w-16 h-16">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-gray-100" strokeWidth="8" />
                          <motion.circle
                            cx="50" cy="50" r="42" fill="none"
                            strokeWidth="8" strokeLinecap="round"
                            className={
                              auditResults.overallScore >= 75 ? 'text-green-500' :
                              auditResults.overallScore >= 60 ? 'text-yellow-500' :
                              auditResults.overallScore >= 40 ? 'text-orange-500' : 'text-red-500'
                            }
                            stroke="currentColor"
                            strokeDasharray={`${auditResults.overallScore * 2.64} 264`}
                            initial={{ strokeDasharray: '0 264' }}
                            animate={{ strokeDasharray: `${auditResults.overallScore * 2.64} 264` }}
                            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold">{auditResults.overallScore}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Optimization Score</p>
                        <p className="text-xl font-bold">{auditResults.overallScore}/100</p>
                        <Badge variant={
                          auditResults.overallScore >= 75 ? 'default' :
                          auditResults.overallScore >= 40 ? 'secondary' : 'destructive'
                        } className="mt-1 text-xs">
                          {auditResults.scoreLabel || (
                            auditResults.overallScore >= 90 ? 'Excellent' :
                            auditResults.overallScore >= 75 ? 'Good' :
                            auditResults.overallScore >= 60 ? 'Average' :
                            auditResults.overallScore >= 40 ? 'Below Average' : 'Poor'
                          )}
                        </Badge>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{suggestions.length}</p>
                        <p className="text-xs text-muted-foreground">Suggestions</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
                        <p className="text-xs text-muted-foreground">Approved</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {approvedNotDeployedCount > 0 && (
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={handleScheduleDeployment}
                            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl shadow-lg shadow-green-500/25"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Deploy {approvedNotDeployedCount} Change{approvedNotDeployedCount !== 1 ? 's' : ''}
                          </Button>
                        </motion.div>
                      )}
                      <Button variant="outline" size="icon" onClick={handleOptimizeClick} className="rounded-xl">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tab Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="h-12 bg-white/80 backdrop-blur-sm border border-border/50 shadow-sm rounded-xl p-1 gap-1">
                {[
                  { value: 'audit', icon: BarChart3, label: 'Audit & Score' },
                  { value: 'suggestions', icon: Sparkles, label: 'AI Suggestions', count: suggestions.length },
                  { value: 'deploy', icon: Clock, label: 'Deployment', count: deployments.length },
                  { value: 'history', icon: History, label: 'History' },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/25 rounded-lg px-4 h-9 transition-all duration-300 gap-2"
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] rounded-full bg-primary/10 text-primary data-[state=active]:bg-white/20 data-[state=active]:text-white">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab 1: Audit Dashboard */}
              <TabsContent value="audit" className="mt-4">
                <OptimizationDashboard
                  auditResults={auditResults}
                  keywords={auditResults.keywords}
                />
              </TabsContent>

              {/* Tab 2: AI Suggestions */}
              <TabsContent value="suggestions" className="mt-4">
                <SuggestionPreview
                  suggestions={suggestions}
                  onApprove={handleApproveSuggestion}
                  onReject={handleRejectSuggestion}
                  onRegenerate={handleRegenerateSuggestion}
                />
              </TabsContent>

              {/* Tab 3: Deployment */}
              <TabsContent value="deploy" className="mt-4">
                <DeploymentTimeline
                  deployments={deployments}
                  onRollback={handleRollback}
                  onRetry={handleRetryDeployment}
                  retryingId={retryingDeploymentId}
                  jobId={job?.id}
                />
              </TabsContent>

              {/* Tab 4: History */}
              <TabsContent value="history" className="mt-4">
                <ChangeHistory locationId={selectedLocationId} />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {/* ===== SELECTED BUT NO JOB YET ===== */}
        {selectedLocationId && !auditResults && !isOptimizing && (
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-white to-primary/5 overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="mb-6"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-xl shadow-primary/30">
                    <Rocket className="w-10 h-10 text-white" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold mb-2">Ready to Optimize</h3>
                <p className="text-muted-foreground max-w-md text-sm mb-6">
                  Click the "Optimize Profile" button to start a deep AI-powered audit across all 13 ranking modules.
                </p>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={handleOptimizeClick}
                    size="lg"
                    className="rounded-xl bg-gradient-to-r from-primary via-blue-600 to-cyan-500 text-white font-semibold shadow-xl shadow-primary/30 px-8"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Start AI Optimization
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>

    </div>
    </div>
  );
};

export default ProfileOptimization;
