import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, XCircle, ChevronDown,
  FileText, Tags, Settings2, Wrench, ShoppingBag,
  Clock, Link2, Sparkles, Edit3,
  Shield, Loader2, MessageSquare, Camera,
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
  social_links: { icon: Link2, label: 'Social & Website Links', color: 'teal', gradient: 'from-teal-500 to-cyan-500' },
  booking_link: { icon: Link2, label: 'Booking Link', color: 'violet', gradient: 'from-violet-500 to-purple-500' },
  posts: { icon: FileText, label: 'Post Suggestions', color: 'orange', gradient: 'from-orange-500 to-amber-500' },
};

// Contextual questions per suggestion type — shown inline when card is expanded
interface Question {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea';
}

const TYPE_QUESTIONS: Record<string, Question[]> = {
  description: [
    { id: 'businessAbout', label: 'What is your business about?', placeholder: 'e.g. We are a family-owned plumbing company serving Mumbai for 10 years, specializing in residential repairs...', type: 'textarea' },
    { id: 'keywords', label: 'What are your top keywords / search terms?', placeholder: 'e.g. plumber Mumbai, emergency plumber, pipe repair, drain cleaning', type: 'text' },
    { id: 'uniqueness', label: 'What makes you different from competitors?', placeholder: 'e.g. 24/7 availability, certified team, 10-year guarantee, same-day service', type: 'text' },
    { id: 'targetCustomers', label: 'Who are your main customers?', placeholder: 'e.g. homeowners, offices, restaurants, residential apartments', type: 'text' },
  ],
  categories: [
    { id: 'mainServices', label: 'What services do you primarily offer?', placeholder: 'e.g. web design, SEO, digital marketing, logo design', type: 'text' },
    { id: 'specialization', label: 'Any niche specializations?', placeholder: 'e.g. e-commerce websites, local SEO, startup branding', type: 'text' },
  ],
  services: [
    { id: 'serviceList', label: 'List all your services (one per line)', placeholder: 'Pipe repair\nDrain cleaning\nWater heater installation\nBathroom renovation', type: 'textarea' },
    { id: 'popularService', label: 'Which is your most popular or important service?', placeholder: 'e.g. Emergency pipe repair', type: 'text' },
    { id: 'serviceHighlight', label: 'Any key details to highlight about your services?', placeholder: 'e.g. all work comes with 1-year guarantee, same-day service available', type: 'text' },
  ],
  products: [
    { id: 'productList', label: 'What products do you sell?', placeholder: 'e.g. handmade leather bags, custom jewelry, organic skincare products', type: 'textarea' },
    { id: 'priceRange', label: 'What is your typical price range?', placeholder: 'e.g. ₹500 – ₹5,000 or $10 – $100', type: 'text' },
    { id: 'productHighlight', label: 'Which product do you want to highlight most?', placeholder: 'e.g. our bestselling tote bag', type: 'text' },
  ],
  attributes: [
    { id: 'amenities', label: 'What amenities or facilities do you offer?', placeholder: 'e.g. free parking, WiFi, wheelchair accessible, outdoor seating, restroom', type: 'text' },
    { id: 'payments', label: 'What payment methods do you accept?', placeholder: 'e.g. cash, credit card, UPI, PayPal, net banking', type: 'text' },
    { id: 'serviceOptions', label: 'How do customers interact with your business?', placeholder: 'e.g. walk-in, online booking, home delivery, curbside pickup', type: 'text' },
  ],
  hours: [
    { id: 'workingDays', label: 'Which days are you open?', placeholder: 'e.g. Monday to Saturday, or 7 days a week', type: 'text' },
    { id: 'workingHours', label: 'What are your opening and closing times?', placeholder: 'e.g. 9 AM to 7 PM on weekdays, 10 AM to 5 PM on Saturday', type: 'text' },
    { id: 'specialClosure', label: 'Any special closures or different hours?', placeholder: 'e.g. closed on public holidays, open till 9 PM on Friday', type: 'text' },
  ],
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
  // Per-suggestion question answers: { [suggestionId]: { [questionId]: answer } }
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<string, string>>>({});

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

  const setAnswer = (suggestionId: string, questionId: string, value: string) => {
    setQuestionAnswers(prev => ({
      ...prev,
      [suggestionId]: { ...(prev[suggestionId] || {}), [questionId]: value },
    }));
  };

  const getAnswers = (suggestionId: string) => questionAnswers[suggestionId] || {};

  const buildFeedbackFromAnswers = (suggestionId: string, suggestionType: string): string => {
    const answers = getAnswers(suggestionId);
    const questions = TYPE_QUESTIONS[suggestionType] || [];
    const parts: string[] = [];
    for (const q of questions) {
      const ans = (answers[q.id] || '').trim();
      if (ans) parts.push(`${q.label}: ${ans}`);
    }
    return parts.join('\n');
  };

  const handleRegenerate = async (id: string, suggestionType: string) => {
    setRegeneratingId(id);
    const feedback = buildFeedbackFromAnswers(id, suggestionType);
    await onRegenerate(id, feedback || undefined);
    setRegeneratingId(null);
  };

  const parseContent = (raw: string) => {
    try { return JSON.parse(raw); } catch { return raw; }
  };

  // Renders suggestion content as clean JSX — no JSON, no code, plain English only
  const renderSuggestedContent = (raw: string, type: string): React.ReactNode => {
    const content = parseContent(raw);

    try {
      // ── Description ──────────────────────────────────────────────
      if (type === 'description') {
        const text: string = typeof content === 'string'
          ? content
          : (content?.description || '');
        if (!text) return <span className="text-muted-foreground italic">No description generated yet.</span>;
        return (
          <div className="space-y-2">
            <p className="text-sm text-foreground leading-relaxed">{text}</p>
            <p className="text-xs text-muted-foreground">{text.length} characters</p>
          </div>
        );
      }

      // ── Categories ───────────────────────────────────────────────
      if (type === 'categories') {
        const cats: any[] = content?.categories || [];
        if (!cats.length) return <span className="text-muted-foreground italic">No categories suggested.</span>;
        return (
          <div className="space-y-2">
            {cats.map((c: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-white border border-border/40">
                <p className="text-sm font-medium text-foreground">{c.name || c}</p>
                {c.reasoning && <p className="text-xs text-muted-foreground mt-0.5">{c.reasoning}</p>}
                {c.searchImpact && (
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.searchImpact === 'high' ? 'bg-green-100 text-green-700' :
                    c.searchImpact === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {c.searchImpact === 'high' ? 'High impact' : c.searchImpact === 'medium' ? 'Medium impact' : 'Low impact'}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      }

      // ── Services ─────────────────────────────────────────────────
      if (type === 'services') {
        const services: any[] = content?.services || [];
        if (!services.length) return <span className="text-muted-foreground italic">No services suggested.</span>;
        return (
          <div className="space-y-2">
            {services.map((s: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-white border border-border/40">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  {s.isNew && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">New</span>}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        );
      }

      // ── Products ─────────────────────────────────────────────────
      if (type === 'products') {
        const products: any[] = content?.products || [];
        if (!products.length) return <span className="text-muted-foreground italic">No products suggested.</span>;
        return (
          <div className="space-y-2">
            {products.map((p: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-white border border-border/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  </div>
                  {p.suggestedPriceRange && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">{p.suggestedPriceRange}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        );
      }

      // ── Attributes ───────────────────────────────────────────────
      if (type === 'attributes') {
        const attrs: any[] = content?.attributes || [];
        if (!attrs.length) return <span className="text-muted-foreground italic">No attributes suggested.</span>;
        // Group by category
        const groups: Record<string, any[]> = {};
        attrs.forEach((a: any) => {
          const g = a.group ? a.group.replace(/_/g, ' ') : 'General';
          if (!groups[g]) groups[g] = [];
          groups[g].push(a);
        });
        return (
          <div className="space-y-3">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 capitalize">{group}</p>
                <div className="space-y-1">
                  {(items as any[]).map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-border/40">
                      <span className={`mt-0.5 text-sm ${a.recommended ? 'text-green-600' : 'text-slate-400'}`}>
                        {a.recommended ? '✓' : '○'}
                      </span>
                      <div>
                        <p className="text-sm text-foreground">{a.name}</p>
                        {a.reasoning && <p className="text-xs text-muted-foreground">{a.reasoning}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }

      // ── Hours ────────────────────────────────────────────────────
      if (type === 'hours') {
        const periods: any[] = content?.periods || [];
        if (!periods.length) return <span className="text-muted-foreground italic">No hours suggested.</span>;
        const dayLabel: Record<string, string> = {
          MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
          THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday'
        };
        const fmt = (h: number, m: number) => {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hr = h % 12 || 12;
          return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        return (
          <div className="space-y-1">
            {periods.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white border border-border/40">
                <span className="text-sm font-medium text-foreground w-28">{dayLabel[p.openDay] || p.openDay}</span>
                <span className="text-sm text-muted-foreground">
                  {p.isClosed ? 'Closed' : `${fmt(p.openTime?.hours || 0, p.openTime?.minutes || 0)} – ${fmt(p.closeTime?.hours || 0, p.closeTime?.minutes || 0)}`}
                </span>
              </div>
            ))}
            {content?.reasoning && (
              <p className="text-xs text-muted-foreground pt-2 italic">{content.reasoning}</p>
            )}
          </div>
        );
      }

      // ── Fallback for plain string ────────────────────────────────
      if (typeof content === 'string') {
        return <p className="text-sm text-foreground leading-relaxed">{content}</p>;
      }

      // ── Ultimate fallback — extract any text we can find ─────────
      const text = content?.description || content?.text || content?.content || content?.value || '';
      if (text) return <p className="text-sm text-foreground leading-relaxed">{text}</p>;
      return <span className="text-muted-foreground italic">No suggestion generated yet.</span>;

    } catch {
      return <span className="text-muted-foreground italic">Could not display suggestion. Please try regenerating.</span>;
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

                      {/* ── Inline questions (shown at top when card is expanded) ── */}
                      {(() => {
                        const questions = TYPE_QUESTIONS[suggestion.suggestion_type] || [];
                        if (questions.length === 0) return null;
                        const answers = getAnswers(suggestion.id);
                        const hasAnyAnswer = questions.some(q => (answers[q.id] || '').trim());
                        return (
                          <div className="rounded-xl border-2 border-blue-200/60 bg-blue-50/40 p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-800">
                                Tell us about your business — we'll improve this suggestion
                              </span>
                            </div>
                            <div className="space-y-3">
                              {questions.map(q => (
                                <div key={q.id}>
                                  <Label className="text-xs font-medium text-blue-700 mb-1 block">{q.label}</Label>
                                  {q.type === 'textarea' ? (
                                    <Textarea
                                      value={answers[q.id] || ''}
                                      onChange={e => setAnswer(suggestion.id, q.id, e.target.value)}
                                      placeholder={q.placeholder}
                                      className="text-sm resize-none bg-white border-blue-200 focus:border-blue-400"
                                      rows={3}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={answers[q.id] || ''}
                                      onChange={e => setAnswer(suggestion.id, q.id, e.target.value)}
                                      placeholder={q.placeholder}
                                      className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                            {hasAnyAnswer && (
                              <Button
                                size="sm"
                                disabled={isRegenerating}
                                onClick={() => handleRegenerate(suggestion.id, suggestion.suggestion_type)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-1"
                              >
                                {isRegenerating ? (
                                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Regenerating…</>
                                ) : (
                                  <><Sparkles className="w-3.5 h-3.5 mr-2" />Generate Better Suggestion</>
                                )}
                              </Button>
                            )}
                          </div>
                        );
                      })()}

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
                            <div className="text-sm">
                              {renderSuggestedContent(suggestion.suggested_content, suggestion.suggestion_type)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      {suggestion.ai_reasoning && (
                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">AI Reasoning</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{suggestion.ai_reasoning}</p>
                        </div>
                      )}

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
