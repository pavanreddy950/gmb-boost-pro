import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileText, Tags, Settings2, Wrench, ShoppingBag, Image, Clock,
  Link2, Star, MessageSquare, Search, BarChart3, Send, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';

interface AuditModule {
  name: string;
  score: number;
  weight: number;
  maxPoints: number;
  points: number;
  recommendations: string[];
  details: Record<string, any>;
}

interface KeywordGap {
  keyword: string;
  inDescription: boolean;
  inServices: boolean;
  inCategories: boolean;
  inProducts: boolean;
}

interface Props {
  auditResults: {
    overallScore: number;
    scoreLabel?: string;
    modules: AuditModule[];
  };
  keywords: {
    extracted: string[];
    gaps: KeywordGap[];
  };
}

const MODULE_ICONS: Record<string, any> = {
  'Profile Completeness': FileText,
  'Category Optimization': Tags,
  'Attribute Coverage': Settings2,
  'Service Optimization': Wrench,
  'Product Listing': ShoppingBag,
  'Photo Coverage': Image,
  'Hours Completeness': Clock,
  'Links & Social': Link2,
  'Review Volume': Star,
  'Review Response Rate': MessageSquare,
  'Description Quality': Search,
  'Keyword Coverage': BarChart3,
  'Posting Activity': Send,
};

const MODULE_COLORS: Record<string, string> = {
  'Profile Completeness': 'from-blue-500 to-cyan-500',
  'Category Optimization': 'from-purple-500 to-violet-500',
  'Attribute Coverage': 'from-indigo-500 to-blue-500',
  'Service Optimization': 'from-emerald-500 to-green-500',
  'Product Listing': 'from-amber-500 to-orange-500',
  'Photo Coverage': 'from-pink-500 to-rose-500',
  'Hours Completeness': 'from-sky-500 to-blue-500',
  'Links & Social': 'from-teal-500 to-cyan-500',
  'Review Volume': 'from-yellow-500 to-amber-500',
  'Review Response Rate': 'from-green-500 to-emerald-500',
  'Description Quality': 'from-violet-500 to-purple-500',
  'Keyword Coverage': 'from-rose-500 to-pink-500',
  'Posting Activity': 'from-orange-500 to-red-500',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const OptimizationDashboard: React.FC<Props> = ({ auditResults, keywords }) => {
  const [expandedModule, setExpandedModule] = React.useState<string | null>(null);

  // Group modules by category
  const gbpModules = auditResults.modules?.filter(m =>
    ['Profile Completeness', 'Category Optimization', 'Attribute Coverage', 'Service Optimization',
     'Product Listing', 'Photo Coverage', 'Hours Completeness', 'Links & Social'].includes(m.name)
  ) || [];

  const reviewModules = auditResults.modules?.filter(m =>
    ['Review Volume', 'Review Response Rate'].includes(m.name)
  ) || [];

  const contentModules = auditResults.modules?.filter(m =>
    ['Description Quality', 'Keyword Coverage', 'Posting Activity'].includes(m.name)
  ) || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const renderModuleRow = (module: AuditModule) => {
    const Icon = MODULE_ICONS[module.name] || BarChart3;
    const gradient = MODULE_COLORS[module.name] || 'from-gray-500 to-gray-600';
    const isExpanded = expandedModule === module.name;

    return (
      <motion.div
        key={module.name}
        variants={itemVariants}
        layout
        className="group"
      >
        <div
          className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-primary/3 cursor-pointer transition-all duration-200"
          onClick={() => setExpandedModule(isExpanded ? null : module.name)}
        >
          {/* Icon */}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>

          {/* Name + Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground truncate">{module.name}</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${getScoreColor(module.score)}`}>{module.score}%</span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground font-normal">
                  {Math.round(module.weight * 100)}%
                </Badge>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getProgressColor(module.score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${module.score}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </div>

          {/* Expand arrow */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>

        {/* Expanded Details */}
        {isExpanded && module.recommendations && module.recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-13 px-4 pb-3"
          >
            <div className="pl-13 border-l-2 border-primary/10 ml-4 space-y-1.5 py-2">
              {module.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      {/* GBP Signals Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-blue-50/80 to-cyan-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">GBP Signals</CardTitle>
                  <p className="text-xs text-muted-foreground">32% of Google ranking weight</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {gbpModules.length} modules
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-3 divide-y divide-border/30">
            {gbpModules.map(renderModuleRow)}
          </CardContent>
        </Card>
      </motion.div>

      {/* Review Signals Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-green-50/80 to-emerald-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Review Signals</CardTitle>
                  <p className="text-xs text-muted-foreground">20% of Google ranking weight</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-3 divide-y divide-border/30">
            {reviewModules.map(renderModuleRow)}
          </CardContent>
        </Card>
      </motion.div>

      {/* Content & Keywords Section */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-purple-50/80 to-violet-50/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                  <Search className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Content & Keywords</CardTitle>
                  <p className="text-xs text-muted-foreground">Keyword coverage analysis</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-3 divide-y divide-border/30">
            {contentModules.map(renderModuleRow)}
          </CardContent>
        </Card>
      </motion.div>

      {/* Keyword Gap Table */}
      {keywords?.gaps && keywords.gaps.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Keyword Gap Analysis</CardTitle>
                  <p className="text-xs text-muted-foreground">Keywords from reviews missing in your profile</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Keyword</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Description</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Services</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Categories</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Products</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {keywords.gaps.slice(0, 15).map((gap, i) => (
                      <motion.tr
                        key={gap.keyword}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-primary/3 transition-colors"
                      >
                        <td className="py-2 px-4">
                          <span className="font-medium text-foreground">{gap.keyword}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {gap.inDescription ?
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> :
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          }
                        </td>
                        <td className="py-2 px-3 text-center">
                          {gap.inServices ?
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> :
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          }
                        </td>
                        <td className="py-2 px-3 text-center">
                          {gap.inCategories ?
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> :
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          }
                        </td>
                        <td className="py-2 px-3 text-center">
                          {gap.inProducts ?
                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> :
                            <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                          }
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Extracted Keywords */}
              {keywords.extracted && keywords.extracted.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Review Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.extracted.slice(0, 20).map((kw, i) => (
                      <motion.span
                        key={kw}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-xs font-medium border border-primary/10 hover:bg-primary/10 transition-colors cursor-default"
                      >
                        {kw}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default OptimizationDashboard;
