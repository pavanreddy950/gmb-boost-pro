import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp,
  FileText, Tags, Settings2, Wrench, ShoppingBag, Image,
  Clock, Link2, MessageSquare, Camera, Sparkles, Edit3,
  Shield, AlertTriangle, Eye, Loader2, SlidersHorizontal
} from 'lucide-react';

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

interface Props {
  suggestions: Suggestion[];
  onApprove: (id: string, editedContent?: string) => void;
  onReject: (id: string) => void;
  onRegenerate: (id: string, feedback?: string) => void;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; gradient: string }> = {
  // Backend types (from aiSuggestionService generators)
  description: { icon: FileText, label: 'Business Description', color: 'blue', gradient: 'from-blue-500 to-cyan-500' },
  categories: { icon: Tags, label: 'Secondary Categories', color: 'purple', gradient: 'from-purple-500 to-violet-500' },
  services: { icon: Wrench, label: 'Services', color: 'emerald', gradient: 'from-emerald-500 to-green-500' },
  products: { icon: ShoppingBag, label: 'Products', color: 'amber', gradient: 'from-amber-500 to-orange-500' },
  attributes: { icon: Settings2, label: 'Business Attributes', color: 'indigo', gradient: 'from-indigo-500 to-blue-500' },
  replyTemplates: { icon: MessageSquare, label: 'Review Reply Templates', color: 'green', gradient: 'from-green-500 to-emerald-500' },
  photoGuide: { icon: Camera, label: 'Photo Guide', color: 'pink', gradient: 'from-pink-500 to-rose-500' },
  // Legacy/alternate keys
  secondary_categories: { icon: Tags, label: 'Secondary Categories', color: 'purple', gradient: 'from-purple-500 to-violet-500' },
  attribute: { icon: Settings2, label: 'Business Attributes', color: 'indigo', gradient: 'from-indigo-500 to-blue-500' },
  service_description: { icon: Wrench, label: 'Services', color: 'emerald', gradient: 'from-emerald-500 to-green-500' },
  product: { icon: ShoppingBag, label: 'Products', color: 'amber', gradient: 'from-amber-500 to-orange-500' },
  photo_guide: { icon: Camera, label: 'Photo Guide', color: 'pink', gradient: 'from-pink-500 to-rose-500' },
  reply_template: { icon: MessageSquare, label: 'Review Reply Templates', color: 'green', gradient: 'from-green-500 to-emerald-500' },
  hours: { icon: Clock, label: 'Hours Optimization', color: 'sky', gradient: 'from-sky-500 to-blue-500' },
  social_links: { icon: Link2, label: 'Social Media Links', color: 'teal', gradient: 'from-teal-500 to-cyan-500' },
  booking_link: { icon: Link2, label: 'Booking Link', color: 'violet', gradient: 'from-violet-500 to-purple-500' },
};

// Which preference fields to show per suggestion type
const TYPE_PREFS: Record<string, string[]> = {
  description: ['tone', 'specialInstructions'],
  categories: ['targetAudience', 'specialInstructions'],
  services: ['tone', 'specialInstructions'],
  products: ['currency', 'priceRange', 'specialInstructions'],
  replyTemplates: ['tone', 'specialInstructions'],
  attributes: ['targetAudience', 'specialInstructions'],
  photoGuide: ['specialInstructions'],
};

const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
  { value: 'AED', label: 'د.إ AED' },
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'authoritative', label: 'Authoritative' },
];

const AUDIENCE_OPTIONS = [
  { value: 'local_residents', label: 'Local Residents' },
  { value: 'tourists', label: 'Tourists' },
  { value: 'businesses', label: 'Businesses (B2B)' },
  { value: 'families', label: 'Families' },
  { value: 'young_professionals', label: 'Young Professionals' },
  { value: 'everyone', label: 'Everyone' },
];

const PRICE_RANGE_OPTIONS = [
  { value: 'budget', label: 'Budget' },
  { value: 'mid_range', label: 'Mid-Range' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'varies', label: 'Varies' },
];

interface SuggestionPrefs {
  currency: string;
  tone: string;
  targetAudience: string;
  priceRange: string;
  specialInstructions: string;
}

const DEFAULT_PREFS: SuggestionPrefs = {
  currency: 'INR',
  tone: 'professional',
  targetAudience: 'local_residents',
  priceRange: 'mid_range',
  specialInstructions: '',
};

const getRiskBadge = (score: number) => {
  if (score <= 30) return { label: 'Low Risk', variant: 'default' as const, className: 'bg-green-100 text-green-700 border-green-200' };
  if (score <= 60) return { label: 'Medium Risk', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'High Risk', variant: 'destructive' as const, className: 'bg-red-100 text-red-700 border-red-200' };
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

const SuggestionPreview: React.FC<Props> = ({ suggestions, onApprove, onReject, onRegenerate }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [showPrefsId, setShowPrefsId] = useState<string | null>(null);
  const [suggestionPrefs, setSuggestionPrefs] = useState<Record<string, SuggestionPrefs>>({});

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card className="border-2 border-dashed border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">No Suggestions Yet</h3>
          <p className="text-sm text-muted-foreground/80 max-w-md mt-1">
            Run the optimizer to generate AI-powered suggestions for your profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleStartEdit = (suggestion: Suggestion) => {
    setEditingId(suggestion.id);
    setEditContent(suggestion.user_edited_content || suggestion.suggested_content);
  };

  const handleSaveEdit = (id: string) => {
    onApprove(id, editContent);
    setEditingId(null);
  };

  const getPrefs = (id: string): SuggestionPrefs => suggestionPrefs[id] || { ...DEFAULT_PREFS };

  const updatePref = (id: string, key: keyof SuggestionPrefs, value: string) => {
    setSuggestionPrefs(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { ...DEFAULT_PREFS }), [key]: value }
    }));
  };

  const buildPrefsFeedback = (id: string, suggestionType: string): string => {
    const prefs = getPrefs(id);
    const fields = TYPE_PREFS[suggestionType] || ['specialInstructions'];
    const parts: string[] = [];

    if (fields.includes('currency')) parts.push(`Use ${prefs.currency} currency only`);
    if (fields.includes('tone')) parts.push(`Tone: ${prefs.tone}`);
    if (fields.includes('targetAudience')) parts.push(`Target audience: ${prefs.targetAudience.replace('_', ' ')}`);
    if (fields.includes('priceRange')) parts.push(`Price range: ${prefs.priceRange.replace('_', ' ')}`);
    if (prefs.specialInstructions.trim()) parts.push(prefs.specialInstructions.trim());
    if (feedbackText.trim()) parts.push(feedbackText.trim());

    return parts.join('. ');
  };

  const handleRegenerate = async (id: string, suggestionType: string) => {
    setRegeneratingId(id);
    const combinedFeedback = buildPrefsFeedback(id, suggestionType);
    await onRegenerate(id, combinedFeedback || undefined);
    setRegeneratingId(null);
    setFeedbackText('');
    setShowPrefsId(null);
  };

  const parseContent = (content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  };

  // Format JSON suggestion content into human-readable text
  const formatContent = (content: any, type: string): string => {
    if (typeof content === 'string') return content;
    if (!content || typeof content !== 'object') return String(content || '');

    try {
      switch (type) {
        case 'description':
          return content.description || JSON.stringify(content, null, 2);

        case 'categories':
          if (content.categories && Array.isArray(content.categories)) {
            return content.categories.map((c: any, i: number) =>
              `${i + 1}. ${c.name || c.categoryId || c}${c.reasoning ? `\n   → ${c.reasoning}` : ''}`
            ).join('\n\n');
          }
          return JSON.stringify(content, null, 2);

        case 'services':
          if (content.services && Array.isArray(content.services)) {
            return content.services.map((s: any, i: number) =>
              `${i + 1}. ${s.name}${s.isNew ? ' (NEW)' : ''}\n   ${s.description}${s.keywords?.length ? `\n   Keywords: ${s.keywords.join(', ')}` : ''}`
            ).join('\n\n');
          }
          return JSON.stringify(content, null, 2);

        case 'products':
          if (content.products && Array.isArray(content.products)) {
            return content.products.map((p: any, i: number) =>
              `${i + 1}. ${p.name}${p.category ? ` [${p.category}]` : ''}\n   ${p.description}${p.suggestedPriceRange ? `\n   Price: ${p.suggestedPriceRange}` : ''}`
            ).join('\n\n');
          }
          return JSON.stringify(content, null, 2);

        case 'attributes':
          if (content.attributes && Array.isArray(content.attributes)) {
            const groups: Record<string, any[]> = {};
            content.attributes.forEach((a: any) => {
              const group = a.group || 'Other';
              if (!groups[group]) groups[group] = [];
              groups[group].push(a);
            });
            return Object.entries(groups).map(([group, attrs]) =>
              `${group.toUpperCase()}\n${(attrs as any[]).map((a: any) => `  ${a.recommended ? '✓' : '○'} ${a.name}${a.reasoning ? ` — ${a.reasoning}` : ''}`).join('\n')}`
            ).join('\n\n');
          }
          return JSON.stringify(content, null, 2);

        case 'replyTemplates':
          if (content.templates) {
            const parts = [];
            if (content.templates.positive) parts.push(`POSITIVE (5-star) REPLY:\n${content.templates.positive}`);
            if (content.templates.neutral) parts.push(`NEUTRAL (3-star) REPLY:\n${content.templates.neutral}`);
            if (content.templates.negative) parts.push(`NEGATIVE (1-2 star) REPLY:\n${content.templates.negative}`);
            return parts.join('\n\n---\n\n');
          }
          return JSON.stringify(content, null, 2);

        case 'photoGuide':
          if (content.photoGuide && Array.isArray(content.photoGuide)) {
            return content.photoGuide.map((p: any, i: number) =>
              `${i + 1}. ${p.type?.toUpperCase() || 'PHOTO'}\n   ${p.description}${p.tips ? `\n   Tip: ${p.tips}` : ''}`
            ).join('\n\n');
          }
          return JSON.stringify(content, null, 2);

        default:
          return JSON.stringify(content, null, 2);
      }
    } catch {
      return JSON.stringify(content, null, 2);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
      {/* Summary Bar */}
      <motion.div variants={cardVariants} className="flex items-center justify-between p-3 rounded-xl bg-white/80 border border-border/30 shadow-sm">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{suggestions.length} suggestions</span>
          <div className="h-4 w-px bg-border" />
          <span className="text-green-600 font-medium">{suggestions.filter(s => s.user_approved === true).length} approved</span>
          <span className="text-amber-600 font-medium">{suggestions.filter(s => s.user_approved === null).length} pending</span>
          <span className="text-red-500 font-medium">{suggestions.filter(s => s.user_approved === false).length} rejected</span>
        </div>
      </motion.div>

      {/* Suggestion Cards */}
      {suggestions.map((suggestion) => {
        const config = TYPE_CONFIG[suggestion.suggestion_type] || TYPE_CONFIG.description;
        const Icon = config.icon;
        const risk = getRiskBadge(suggestion.risk_score);
        const isExpanded = expandedId === suggestion.id;
        const isEditing = editingId === suggestion.id;
        const isRegenerating = regeneratingId === suggestion.id;
        const content = parseContent(suggestion.suggested_content);

        return (
          <motion.div key={suggestion.id} variants={cardVariants} layout>
            <Card className={`border-0 shadow-md overflow-hidden transition-all duration-300 ${
              suggestion.user_approved === true ? 'ring-2 ring-green-200 bg-green-50/30' :
              suggestion.user_approved === false ? 'opacity-60 bg-red-50/10' :
              'hover:shadow-lg'
            }`}>
              {/* Header */}
              <div
                className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{config.label}</h4>
                    {suggestion.ai_reasoning && (
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{suggestion.ai_reasoning}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Badge */}
                  {suggestion.user_approved === true && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Approved</Badge>
                  )}
                  {suggestion.user_approved === false && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Rejected</Badge>
                  )}

                  {/* Risk Badge */}
                  <Badge variant="outline" className={`text-xs ${risk.className}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {risk.label}
                  </Badge>

                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CardContent className="pt-0 pb-4 px-4 space-y-4">
                      {/* Current vs Suggested */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Current */}
                        <div className="rounded-xl border border-border/50 p-3 bg-red-50/20">
                          <p className="text-xs font-semibold text-red-600/80 uppercase tracking-wider mb-2">Current</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {suggestion.original_content || 'Not set / Empty'}
                          </p>
                        </div>

                        {/* Suggested */}
                        <div className="rounded-xl border border-border/50 p-3 bg-green-50/20">
                          <p className="text-xs font-semibold text-green-600/80 uppercase tracking-wider mb-2">Suggested</p>
                          {isEditing ? (
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[120px] text-sm resize-y"
                              placeholder="Edit the suggestion..."
                            />
                          ) : (
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {formatContent(content, suggestion.suggestion_type)}
                            </p>
                          )}
                          {suggestion.suggestion_type === 'description' && typeof content === 'object' && content?.description && (
                            <p className="text-xs text-muted-foreground mt-2">{content.description.length} characters</p>
                          )}
                          {typeof content === 'string' && (
                            <p className="text-xs text-muted-foreground mt-2">{content.length} characters</p>
                          )}
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      {suggestion.ai_reasoning && (
                        <div className="rounded-xl border border-primary/10 bg-primary/3 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">AI Reasoning</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{suggestion.ai_reasoning}</p>
                        </div>
                      )}

                      {/* Customize & Regenerate Panel */}
                      {showPrefsId === suggestion.id && (() => {
                        const prefs = getPrefs(suggestion.id);
                        const fields = TYPE_PREFS[suggestion.suggestion_type] || ['specialInstructions'];
                        return (
                          <div className="rounded-xl border-2 border-primary/20 bg-primary/3 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold text-primary">Customize This Suggestion</span>
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => setShowPrefsId(null)} className="h-7 px-2 text-xs">
                                Close
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {fields.includes('currency') && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground">Currency</Label>
                                  <Select value={prefs.currency} onValueChange={(v) => updatePref(suggestion.id, 'currency', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {CURRENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {fields.includes('tone') && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground">Tone</Label>
                                  <Select value={prefs.tone} onValueChange={(v) => updatePref(suggestion.id, 'tone', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {fields.includes('targetAudience') && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground">Target Audience</Label>
                                  <Select value={prefs.targetAudience} onValueChange={(v) => updatePref(suggestion.id, 'targetAudience', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {AUDIENCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {fields.includes('priceRange') && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium text-muted-foreground">Price Range</Label>
                                  <Select value={prefs.priceRange} onValueChange={(v) => updatePref(suggestion.id, 'priceRange', v)}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {PRICE_RANGE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-muted-foreground">Special Instructions</Label>
                              <Textarea
                                value={prefs.specialInstructions}
                                onChange={(e) => updatePref(suggestion.id, 'specialInstructions', e.target.value)}
                                placeholder="e.g., Use prices in ₹, emphasize home delivery, don't mention competitor names..."
                                className="min-h-[50px] text-xs resize-none"
                              />
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleRegenerate(suggestion.id, suggestion.suggestion_type)}
                              disabled={regeneratingId === suggestion.id}
                              className="w-full rounded-lg bg-gradient-to-r from-primary to-cyan-500 text-white"
                            >
                              {regeneratingId === suggestion.id ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerating...</>
                              ) : (
                                <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate with Preferences</>
                              )}
                            </Button>
                          </div>
                        );
                      })()}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {suggestion.user_approved === null && (
                          <>
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(suggestion.id)}
                                  className="rounded-lg bg-green-500 hover:bg-green-600 text-white"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                  Save & Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingId(null)}
                                  className="rounded-lg"
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                  <Button
                                    size="sm"
                                    onClick={() => onApprove(suggestion.id)}
                                    className="rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-sm shadow-green-500/20"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                    Approve
                                  </Button>
                                </motion.div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartEdit(suggestion)}
                                  className="rounded-lg"
                                >
                                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => showPrefsId === suggestion.id ? setShowPrefsId(null) : setShowPrefsId(suggestion.id)}
                                  className="rounded-lg"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                                  Customize & Regenerate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onReject(suggestion.id)}
                                  className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default SuggestionPreview;
