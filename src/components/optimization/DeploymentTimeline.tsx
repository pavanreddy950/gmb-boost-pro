import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, RotateCcw,
  FileText, Tags, Settings2, Wrench, ShoppingBag, Link2,
  Play, Pause, Loader2, Rocket, Calendar
} from 'lucide-react';

interface Deployment {
  id: string;
  deploy_type: string;
  deploy_day: number;
  scheduled_at: string;
  status: string;
  applied_at: string | null;
  error_message: string | null;
  optimization_suggestions?: {
    suggestion_type: string;
    suggested_content: string;
    user_edited_content: string | null;
  };
}

interface Props {
  deployments: Deployment[];
  onRollback: (id: string) => void;
  jobId?: string;
}

const DEPLOY_TYPE_CONFIG: Record<string, { icon: any; label: string; description: string; color: string }> = {
  description: { icon: FileText, label: 'Description', description: 'Business description update', color: 'from-blue-500 to-cyan-500' },
  hours: { icon: Clock, label: 'Hours', description: 'Business & special hours', color: 'from-sky-500 to-blue-500' },
  categories: { icon: Tags, label: 'Categories', description: 'Secondary categories', color: 'from-purple-500 to-violet-500' },
  attributes: { icon: Settings2, label: 'Attributes', description: 'Business attributes', color: 'from-indigo-500 to-blue-500' },
  services: { icon: Wrench, label: 'Services', description: 'Service descriptions', color: 'from-emerald-500 to-green-500' },
  products: { icon: ShoppingBag, label: 'Products', description: 'Product listings', color: 'from-amber-500 to-orange-500' },
  links: { icon: Link2, label: 'Links', description: 'Social, booking & reply templates', color: 'from-teal-500 to-cyan-500' },
  reply_templates: { icon: Link2, label: 'Templates', description: 'Review reply templates & links', color: 'from-green-500 to-emerald-500' },
};

const STATUS_CONFIG: Record<string, { icon: any; label: string; className: string; dotColor: string }> = {
  pending: { icon: Clock, label: 'Pending', className: 'bg-slate-100 text-slate-600 border-slate-200', dotColor: 'bg-slate-400' },
  scheduled: { icon: Calendar, label: 'Scheduled', className: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  in_progress: { icon: Loader2, label: 'Deploying', className: 'bg-amber-100 text-amber-700 border-amber-200', dotColor: 'bg-amber-500 animate-pulse' },
  applied: { icon: CheckCircle2, label: 'Applied', className: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  rolled_back: { icon: RotateCcw, label: 'Rolled Back', className: 'bg-orange-100 text-orange-700 border-orange-200', dotColor: 'bg-orange-500' },
  cancelled: { icon: Pause, label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-200', dotColor: 'bg-gray-400' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const DeploymentTimeline: React.FC<Props> = ({ deployments, onRollback, jobId }) => {
  if (!deployments || deployments.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
          >
            <Rocket className="w-12 h-12 text-muted-foreground/30 mb-4" />
          </motion.div>
          <h3 className="text-lg font-semibold text-muted-foreground">No Deployment Scheduled</h3>
          <p className="text-sm text-muted-foreground/80 max-w-md mt-1">
            Approve suggestions first, then click "Deploy Changes" to schedule the 7-day gradual deployment.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by day
  const dayGroups = deployments.reduce((acc, d) => {
    const day = d.deploy_day;
    if (!acc[day]) acc[day] = [];
    acc[day].push(d);
    return acc;
  }, {} as Record<number, Deployment[]>);

  const sortedDays = Object.keys(dayGroups).map(Number).sort((a, b) => a - b);

  // Stats
  const applied = deployments.filter(d => d.status === 'applied').length;
  const total = deployments.length;
  const progress = total > 0 ? Math.round((applied / total) * 100) : 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* Progress Header */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-md bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white">
          <CardContent className="py-5 px-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold">Deployment Progress</h3>
                <p className="text-sm text-blue-200/70">{applied} of {total} changes deployed</p>
              </div>
              <span className="text-3xl font-bold text-cyan-400">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-green-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />

        <div className="space-y-3">
          {sortedDays.map((day) => {
            const dayDeployments = dayGroups[day];
            const allApplied = dayDeployments.every(d => d.status === 'applied');
            const anyFailed = dayDeployments.some(d => d.status === 'failed');
            const anyInProgress = dayDeployments.some(d => d.status === 'in_progress');

            return (
              <motion.div key={day} variants={itemVariants} className="relative pl-14">
                {/* Day Node */}
                <div className="absolute left-0 top-3">
                  <motion.div
                    animate={anyInProgress ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ repeat: anyInProgress ? Infinity : 0, duration: 1 }}
                    className={`w-[55px] h-[55px] rounded-2xl flex flex-col items-center justify-center text-white font-bold shadow-lg ${
                      allApplied ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                      anyFailed ? 'bg-gradient-to-br from-red-500 to-red-600' :
                      anyInProgress ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                      'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase leading-none">Day</span>
                    <span className="text-xl leading-none">{day}</span>
                  </motion.div>
                </div>

                {/* Deployment Cards */}
                <div className="space-y-2">
                  {dayDeployments.map((deployment) => {
                    const typeConfig = DEPLOY_TYPE_CONFIG[deployment.deploy_type] || DEPLOY_TYPE_CONFIG.description;
                    const statusConfig = STATUS_CONFIG[deployment.status] || STATUS_CONFIG.pending;
                    const TypeIcon = typeConfig.icon;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <Card key={deployment.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeConfig.color} flex items-center justify-center`}>
                                <TypeIcon className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">{typeConfig.label}</p>
                                <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
                                {deployment.scheduled_at && deployment.status === 'scheduled' && (
                                  <p className="text-xs text-blue-600 mt-0.5">
                                    {new Date(deployment.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                                {deployment.error_message && (
                                  <p className="text-xs text-red-500 mt-0.5">{deployment.error_message}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                                <StatusIcon className={`w-3 h-3 mr-1 ${deployment.status === 'in_progress' ? 'animate-spin' : ''}`} />
                                {statusConfig.label}
                              </Badge>

                              {deployment.status === 'applied' && (
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onRollback(deployment.id)}
                                    className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg"
                                  >
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    Rollback
                                  </Button>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default DeploymentTimeline;
