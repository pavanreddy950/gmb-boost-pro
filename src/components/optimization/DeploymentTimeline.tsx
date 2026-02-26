import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, RotateCcw,
  FileText, Tags, Settings2, Wrench, ShoppingBag, Link2,
  Loader2, Rocket, Info
} from 'lucide-react';

interface Deployment {
  id: string;
  deploy_type: string;
  deploy_day: number;
  scheduled_at: string;
  status: string;
  applied_at: string | null;
  error_message: string | null;
  gbp_applied?: boolean;
  gbp_note?: string | null;
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
  description: { icon: FileText, label: 'Business Description', description: 'Description update pushed to GBP', color: 'from-blue-500 to-cyan-500' },
  hours: { icon: Clock, label: 'Business Hours', description: 'Hours pushed to GBP', color: 'from-sky-500 to-blue-500' },
  categories: { icon: Tags, label: 'Categories', description: 'Review suggested categories in GBP', color: 'from-purple-500 to-violet-500' },
  attributes: { icon: Settings2, label: 'Attributes', description: 'Review suggested attributes in GBP', color: 'from-indigo-500 to-blue-500' },
  services: { icon: Wrench, label: 'Services', description: 'Services pushed to GBP', color: 'from-emerald-500 to-green-500' },
  products: { icon: ShoppingBag, label: 'Products', description: 'Review suggested products in GBP', color: 'from-amber-500 to-orange-500' },
  links: { icon: Link2, label: 'Links', description: 'Review links in GBP', color: 'from-teal-500 to-cyan-500' },
  reply_templates: { icon: Link2, label: 'Reply Templates', description: 'Review reply templates', color: 'from-green-500 to-emerald-500' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const DeploymentTimeline: React.FC<Props> = ({ deployments, onRollback }) => {
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
          <h3 className="text-lg font-semibold text-muted-foreground">No Changes Deployed Yet</h3>
          <p className="text-sm text-muted-foreground/80 max-w-md mt-1">
            Approve suggestions then click "Deploy Changes" to push them to your Google Business Profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  const applied = deployments.filter(d => d.status === 'applied').length;
  const gbpPushed = deployments.filter(d => d.gbp_applied).length;
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
                <h3 className="text-lg font-bold">Deployment Complete</h3>
                <p className="text-sm text-blue-200/70">
                  {gbpPushed} of {total} changes pushed live to Google Business Profile
                </p>
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

      {/* Deployment Cards */}
      <div className="space-y-2">
        {deployments.map((deployment) => {
          const typeConfig = DEPLOY_TYPE_CONFIG[deployment.deploy_type] || DEPLOY_TYPE_CONFIG.description;
          const TypeIcon = typeConfig.icon;
          const isApplied = deployment.status === 'applied';
          const isFailed = deployment.status === 'failed';
          const gbpPushedThisOne = deployment.gbp_applied;
          const hasNote = !!deployment.gbp_note;

          return (
            <motion.div key={deployment.id} variants={itemVariants}>
              <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${typeConfig.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <TypeIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{typeConfig.label}</p>

                        {/* GBP pushed badge */}
                        {isApplied && (
                          gbpPushedThisOne ? (
                            <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Pushed to Google Business Profile
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              Saved — action needed in GBP
                            </p>
                          )
                        )}
                        {isFailed && (
                          <p className="text-xs text-red-500 mt-0.5">{deployment.error_message}</p>
                        )}

                        {/* Note (e.g. "Set manually in GBP") */}
                        {hasNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{deployment.gbp_note}</p>
                        )}

                        {/* Applied timestamp */}
                        {deployment.applied_at && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {new Date(deployment.applied_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status badge */}
                      {isApplied && gbpPushedThisOne && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs border">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Live
                        </Badge>
                      )}
                      {isApplied && !gbpPushedThisOne && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs border">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Manual
                        </Badge>
                      )}
                      {isFailed && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs border">
                          <XCircle className="w-3 h-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      {deployment.status === 'in_progress' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs border">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Deploying
                        </Badge>
                      )}

                      {/* Rollback button (only for GBP-pushed items) */}
                      {isApplied && gbpPushedThisOne && (
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
            </motion.div>
          );
        })}
      </div>

      {/* Info note about manual items */}
      {deployments.some(d => d.status === 'applied' && !d.gbp_applied) && (
        <motion.div variants={itemVariants}>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200/60">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Manual action required:</span> Some changes (categories, attributes, products) need to be set directly in your Google Business Profile because they require official Google category/attribute IDs. The suggestions are saved here for reference.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default DeploymentTimeline;
