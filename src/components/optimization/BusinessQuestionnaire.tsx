import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Plus } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuestionnaireAnswers {
  // Step 1 — Identity
  standoutFactors: string[];
  targetAudience: string;
  priceRange: string;
  tone: string;
  // Step 2 — Services & Products
  topServices: string;
  certifications: string;
  // Step 3 — Operations & Goals
  amenities: string[];
  promotions: string;
  mainGoal: string;
  currency: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (answers: QuestionnaireAnswers) => void;
}

// ─── Question definitions ─────────────────────────────────────────────────────

const STEPS = [
  {
    title: 'About Your Business',
    subtitle: 'Help us understand what makes you unique',
    color: 'from-violet-500 to-purple-600',
  },
  {
    title: 'Your Services & Products',
    subtitle: 'Tell us what you offer so we can write better descriptions',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    title: 'Operations & Goals',
    subtitle: 'Last step — what you offer and what you want to achieve',
    color: 'from-emerald-500 to-teal-600',
  },
];

const STANDOUT_OPTIONS = [
  'Quality products/services',
  'Experienced team',
  'Affordable pricing',
  'Fast turnaround',
  'Personalized service',
  'Deep specialization',
  'Award-winning',
  'Locally trusted',
];

const AUDIENCE_OPTIONS = [
  { value: 'local_residents', label: 'Local Residents' },
  { value: 'businesses', label: 'Corporate / B2B' },
  { value: 'tourists', label: 'Tourists & Visitors' },
  { value: 'families', label: 'Families' },
  { value: 'young_professionals', label: 'Young Professionals' },
  { value: 'everyone', label: 'Everyone' },
];

const PRICE_OPTIONS = [
  { value: 'budget', label: 'Budget-friendly' },
  { value: 'mid_range', label: 'Mid-range' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'varies', label: 'Varies by service' },
];

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly & Approachable' },
  { value: 'casual', label: 'Casual' },
  { value: 'authoritative', label: 'Expert / Authoritative' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ INR — India' },
  { value: 'USD', label: '$ USD — US' },
  { value: 'EUR', label: '€ EUR — Europe' },
  { value: 'GBP', label: '£ GBP — UK' },
  { value: 'AED', label: 'د.إ AED — UAE' },
];

const AMENITY_OPTIONS = [
  'Free parking',
  'WiFi available',
  'Online booking',
  'Home delivery',
  'Walk-in welcome',
  'Weekend availability',
  'Wheelchair accessible',
  '24/7 support',
  'Online store',
  'Multiple locations',
  'Cash & card accepted',
  'WhatsApp orders',
];

const GOAL_OPTIONS = [
  { value: 'more_reviews', label: 'Get more reviews' },
  { value: 'rank_higher', label: 'Rank higher locally' },
  { value: 'foot_traffic', label: 'Increase foot traffic' },
  { value: 'promote_service', label: 'Promote a specific service' },
  { value: 'brand_awareness', label: 'Build brand awareness' },
  { value: 'more_calls', label: 'Get more phone calls' },
];

// ─── Chip component ───────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
      border transition-all duration-150 cursor-pointer select-none
      ${selected
        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
      }
    `}
  >
    {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
    {label}
  </button>
);

// ─── Custom answer input ──────────────────────────────────────────────────────

interface CustomInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onAdd?: (v: string) => void; // if provided, works as "add chip" mode
}

const CustomInput: React.FC<CustomInputProps> = ({ value, onChange, placeholder, onAdd }) => {
  if (onAdd) {
    return (
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault();
              onAdd(value.trim());
              onChange('');
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (value.trim()) { onAdd(value.trim()); onChange(''); }
          }}
          className="shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
    );
  }

  return (
    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-2 text-sm resize-none"
      rows={2}
    />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_ANSWERS: QuestionnaireAnswers = {
  standoutFactors: [],
  targetAudience: '',
  priceRange: '',
  tone: 'professional',
  topServices: '',
  certifications: '',
  amenities: [],
  promotions: '',
  mainGoal: '',
  currency: 'INR',
};

const BusinessQuestionnaire: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({ ...DEFAULT_ANSWERS });
  const [customStandout, setCustomStandout] = useState('');
  const [customAmenity, setCustomAmenity] = useState('');

  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const toggleMulti = (field: 'standoutFactors' | 'amenities', value: string) => {
    setAnswers(prev => {
      const list = prev[field] as string[];
      return {
        ...prev,
        [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      };
    });
  };

  const setSingle = (field: keyof QuestionnaireAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const addCustom = (field: 'standoutFactors' | 'amenities', value: string) => {
    setAnswers(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value],
    }));
  };

  // ─── Validation per step ─────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 0) return answers.targetAudience && answers.priceRange;
    if (step === 1) return answers.topServices.trim().length > 0;
    return true; // step 2 is optional
  };

  const handleNext = () => {
    if (step < totalSteps - 1) setStep(s => s + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    onSubmit(answers);
    // Reset for next use
    setStep(0);
    setAnswers({ ...DEFAULT_ANSWERS });
  };

  // ─── Step renders ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-6">
      {/* What makes you stand out */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          What makes your business stand out?
          <span className="text-muted-foreground font-normal ml-1">(pick all that apply)</span>
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {STANDOUT_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              selected={answers.standoutFactors.includes(opt)}
              onClick={() => toggleMulti('standoutFactors', opt)}
            />
          ))}
        </div>
        <CustomInput
          value={customStandout}
          onChange={setCustomStandout}
          placeholder="Type something custom and press Enter or Add…"
          onAdd={v => { addCustom('standoutFactors', v); setCustomStandout(''); }}
        />
        {answers.standoutFactors.filter(f => !STANDOUT_OPTIONS.includes(f)).map(custom => (
          <Badge key={custom} variant="secondary" className="mt-1 mr-1 cursor-pointer" onClick={() => toggleMulti('standoutFactors', custom)}>
            {custom} ✕
          </Badge>
        ))}
      </div>

      {/* Target audience */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Who are your main customers?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {AUDIENCE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={answers.targetAudience === opt.value}
              onClick={() => setSingle('targetAudience', opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">How would you describe your pricing?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRICE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={answers.priceRange === opt.value}
              onClick={() => setSingle('priceRange', opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">What tone suits your brand?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {TONE_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={answers.tone === opt.value}
              onClick={() => setSingle('tone', opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Currency */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">What currency do you use?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {CURRENCY_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={answers.currency === opt.value}
              onClick={() => setSingle('currency', opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Top services */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          What are your top services or products? <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          List them separated by commas — the AI will use these for every suggestion.
        </p>
        <Textarea
          value={answers.topServices}
          onChange={e => setSingle('topServices', e.target.value)}
          placeholder="e.g. Website design, SEO, Google Ads, Social media management"
          className="text-sm resize-none"
          rows={3}
        />
      </div>

      {/* Certifications / awards */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          Any specializations, certifications, or awards? <span className="text-muted-foreground font-normal">(optional)</span>
        </p>
        <Textarea
          value={answers.certifications}
          onChange={e => setSingle('certifications', e.target.value)}
          placeholder="e.g. Google Partner, ISO certified, 10+ years experience, Award-winning design"
          className="text-sm resize-none"
          rows={2}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Amenities / features */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          What features or amenities do you offer?
          <span className="text-muted-foreground font-normal ml-1">(pick all that apply)</span>
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {AMENITY_OPTIONS.map(opt => (
            <Chip
              key={opt}
              label={opt}
              selected={answers.amenities.includes(opt)}
              onClick={() => toggleMulti('amenities', opt)}
            />
          ))}
        </div>
        <CustomInput
          value={customAmenity}
          onChange={setCustomAmenity}
          placeholder="Type a custom feature and press Enter or Add…"
          onAdd={v => { addCustom('amenities', v); setCustomAmenity(''); }}
        />
        {answers.amenities.filter(a => !AMENITY_OPTIONS.includes(a)).map(custom => (
          <Badge key={custom} variant="secondary" className="mt-1 mr-1 cursor-pointer" onClick={() => toggleMulti('amenities', custom)}>
            {custom} ✕
          </Badge>
        ))}
      </div>

      {/* Promotions */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          Any current promotions or upcoming events? <span className="text-muted-foreground font-normal">(optional)</span>
        </p>
        <Textarea
          value={answers.promotions}
          onChange={e => setSingle('promotions', e.target.value)}
          placeholder="e.g. Summer sale 20% off, Free consultation this month, Workshop on Oct 15"
          className="text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Main goal */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">What's your main goal for this optimization?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {GOAL_OPTIONS.map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              selected={answers.mainGoal === opt.value}
              onClick={() => setSingle('mainGoal', opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className={`bg-gradient-to-r ${STEPS[step].color} p-6 text-white shrink-0`}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Step {step + 1} of {totalSteps}</span>
          </div>
          <DialogTitle className="text-xl font-bold text-white mb-1">
            {STEPS[step].title}
          </DialogTitle>
          <p className="text-sm opacity-80">{STEPS[step].subtitle}</p>
          <Progress value={progress} className="mt-4 h-1.5 bg-white/30 [&>div]:bg-white" />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {stepContent[step]()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between shrink-0 bg-background">
          <Button
            variant="ghost"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="gap-2"
          >
            {step === totalSteps - 1 ? (
              <>
                <Sparkles className="w-4 h-4" />
                Start AI Optimization
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BusinessQuestionnaire;
