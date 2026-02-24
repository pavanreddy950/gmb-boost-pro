import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History, RotateCcw, ChevronLeft, ChevronRight,
  CheckCircle2, ArrowRight, Clock, Loader2
} from 'lucide-react';

interface ChangeRecord {
  id: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  applied_by: string;
  rolled_back: boolean;
  rolled_back_at: string | null;
  created_at: string;
}

interface Props {
  locationId: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const ChangeHistory: React.FC<Props> = ({ locationId }) => {
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 15;

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

  useEffect(() => {
    if (locationId) {
      fetchHistory();
    }
  }, [locationId, offset]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/profile-optimizer/history/${locationId}?limit=${limit}&offset=${offset}`
      );
      const data = await res.json();
      setChanges(data.changes || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatChangeType = (type: string) => {
    return type
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const truncate = (text: string | null, maxLen: number = 80) => {
    if (!text) return 'Empty';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  if (loading && changes.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
          <span className="text-muted-foreground">Loading change history...</span>
        </CardContent>
      </Card>
    );
  }

  if (changes.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No Change History</h3>
          <p className="text-sm text-muted-foreground/80 max-w-md mt-1">
            Changes will appear here once optimization deployments start applying to your profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
      {/* Changes Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-border/30">
                <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Change</th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Old Value</th>
                <th className="text-center py-3 px-2 font-semibold text-xs text-muted-foreground"></th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">New Value</th>
                <th className="text-center py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {changes.map((change, i) => (
                <motion.tr
                  key={change.id}
                  variants={itemVariants}
                  className="hover:bg-primary/3 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {new Date(change.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(change.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs font-medium">
                      {formatChangeType(change.change_type)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <p className="text-xs text-muted-foreground truncate" title={change.old_value || ''}>
                      {truncate(change.old_value)}
                    </p>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 mx-auto" />
                  </td>
                  <td className="py-3 px-4 max-w-[200px]">
                    <p className="text-xs text-foreground truncate font-medium" title={change.new_value || ''}>
                      {truncate(change.new_value)}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {change.rolled_back ? (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reverted
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Applied
                      </Badge>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between py-3 px-4 border-t border-border/30 bg-slate-50/50">
            <span className="text-xs text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="h-7 w-7 p-0 rounded-lg"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="h-7 w-7 p-0 rounded-lg"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default ChangeHistory;
