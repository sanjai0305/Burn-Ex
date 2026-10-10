/**
 * src/components/CompleteProfile.jsx
 * Burn-Ex — Premium Light-Mode Profile Onboarding Page
 * 
 * Accurately reproduces the reference design:
 *   - Clean Light Mode (white background, soft lavender/blue gradients)
 *   - Left Section: Step badge, "Let's Build Your Profile" heading, 4-step vertical progress tracker, 3D fitness illustration
 *   - Right Section: Rounded white profile form card, progress bar (25% to 100%), circular avatar upload,
 *     Full Name, Date of Birth, 3 Gender selectable cards, Continue button.
 *   - Seamless multi-step navigation (Steps 1 to 4) with validation, body metrics, phone OTP, and profile completion.
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  User, 
  Calendar, 
  Camera, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Smartphone, 
  ShieldCheck, 
  Sparkles, 
  Ruler, 
  Weight, 
  Target, 
  Flame, 
  Activity,
  AlertCircle,
  Loader2,
  Phone,
  Lock,
  RefreshCw
} from 'lucide-react';
import { authenticatedFetch } from '../auth/AuthService';
import IndianPhoneInput, { extractLocal10Digit, validateIndianMobile } from './IndianPhoneInput';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const GOAL_OPTIONS = [
  {
    value: 'Fat-loss',
    label: 'Fat Loss',
    description: 'Burn calories & reduce body fat percentage',
    emoji: '🔥',
    color: 'from-orange-500 to-red-500',
    border: 'border-orange-200',
    bg: 'bg-orange-50/50',
    activeBg: 'bg-orange-500 text-white',
  },
  {
    value: 'Muscle-gain',
    label: 'Muscle Gain',
    description: 'Build lean muscle mass & increase strength',
    emoji: '💪',
    color: 'from-blue-500 to-indigo-500',
    border: 'border-blue-200',
    bg: 'bg-blue-50/50',
    activeBg: 'bg-blue-500 text-white',
  },
  {
    value: 'Endurance',
    label: 'Endurance',
    description: 'Improve stamina & cardiovascular capacity',
    emoji: '⚡',
    color: 'from-amber-500 to-yellow-500',
    border: 'border-amber-200',
    bg: 'bg-amber-50/50',
    activeBg: 'bg-amber-500 text-white',
  },
  {
    value: 'Hypertrophy',
    label: 'Hypertrophy',
    description: 'Maximize muscle size with progressive overload',
    emoji: '🏋️',
    color: 'from-purple-500 to-violet-500',
    border: 'border-purple-200',
    bg: 'bg-purple-50/50',
    activeBg: 'bg-purple-500 text-white',
  },
  {
    value: 'Weight-maintenance',
    label: 'Maintenance',
    description: 'Maintain current body weight & stay fit',
    emoji: '⚖️',
    color: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/50',
    activeBg: 'bg-emerald-500 text-white',
  },
];

const STEPS = [
  {
    title: 'Personal Information',
    subtitle: 'Basic details about you',
    cardTitle: 'Personal Information',
    cardSubtitle: 'Tell us a bit about yourself',
    progress: 25,
    icon: User,
  },
  {
    title: 'Body Metrics',
    subtitle: 'Height, weight and fitness info',
    cardTitle: 'Body Metrics & Goals',
    cardSubtitle: 'Set your physical baseline',
    progress: 50,
    icon: Ruler,
  },
  {
    title: 'Contact & OTP',
    subtitle: 'Verify your mobile number',
    cardTitle: 'Mobile Verification',
    cardSubtitle: 'Secure your athlete account',
    progress: 75,
    icon: Smartphone,
  },
  {
    title: 'Complete Profile',
    subtitle: "You're all set!",
    cardTitle: 'Review & Complete',
    cardSubtitle: 'Confirm your profile details',
    progress: 100,
    icon: ShieldCheck,
  },
];

// ── Utility: Safe API Error Parser ─────────────────────────────────────────────
function parseApiError(detail, fallback = 'An unexpected error occurred.') {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((d) => {
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object') {
        const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg || 'Invalid value'}` : (d.msg || d.message || JSON.stringify(d));
      }
      return String(d);
    }).filter(Boolean);
    return messages.length > 0 ? messages.join(', ') : fallback;
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
}

// ── Utility: Age Calculation ──────────────────────────────────────────────────
function calculateAge(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

// ── Left Column 3D Fitness SVG Illustration ────────────────────────────────────
function FitnessIllustration() {
  return (
    <div className="relative w-full max-w-[280px] sm:max-w-[320px] h-48 sm:h-56 mx-auto mt-6 flex items-center justify-center">
      {/* Soft Cloud / Leaf Backdrop */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 220" fill="none">
        {/* Soft Background Clouds / Leaves */}
        <path d="M40 180 C20 140, 50 90, 90 120 C110 80, 160 80, 180 120 C220 90, 260 110, 270 160 C290 170, 290 200, 260 210 L50 210 C30 210, 25 195, 40 180 Z" fill="#E9EEFE" opacity="0.8" />
        <path d="M15 170 C5 145, 20 120, 50 140 C60 115, 95 120, 105 145 C125 130, 150 145, 145 180 L25 180 C10 180, 5 175, 15 170 Z" fill="#DDE4FC" opacity="0.6" />
        <path d="M220 170 C240 130, 290 140, 305 175 C315 190, 305 210, 280 210 L210 210 C195 210, 205 185, 220 170 Z" fill="#DCE5FE" opacity="0.7" />
        
        {/* Decorative Floating Leaves */}
        <path d="M260 80 C280 65, 300 80, 290 100 C270 105, 255 95, 260 80 Z" fill="#C7D7FE" opacity="0.7" />
        <path d="M275 110 C295 100, 310 115, 305 130 C290 135, 275 125, 275 110 Z" fill="#DDE6FE" opacity="0.8" />
        <path d="M35 95 C20 85, 15 105, 30 115 C45 115, 50 100, 35 95 Z" fill="#C7D7FE" opacity="0.6" />
      </svg>

      {/* 3D Graphic Composition */}
      <div className="relative z-10 w-full h-full flex items-end justify-between px-2 pb-2">
        {/* 1. Water Bottle / Shaker & Dumbbell on Left */}
        <div className="flex flex-col items-center relative -bottom-1">
          {/* Shaker Bottle */}
          <div className="w-12 sm:w-14 h-24 sm:h-28 bg-gradient-to-tr from-[#3B4B94] via-[#5C6EC4] to-[#8FA2F4] rounded-2xl shadow-xl shadow-indigo-900/20 flex flex-col items-center justify-between p-1.5 border border-indigo-200/40 transform -rotate-12">
            {/* Bottle Cap */}
            <div className="w-8 h-4 bg-slate-900 rounded-lg -mt-3 shadow-md flex items-center justify-center">
              <div className="w-3 h-1.5 bg-indigo-400 rounded-full" />
            </div>
            {/* Bottle Body Highlight */}
            <div className="w-full flex-1 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <div className="w-1.5 h-10 bg-white/40 rounded-full mr-auto ml-1" />
            </div>
            <div className="w-8 h-1.5 bg-indigo-950/40 rounded-full mb-1" />
          </div>

          {/* Dumbbell Base */}
          <div className="flex items-center -mt-4 relative z-20">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-md border border-slate-600 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            </div>
            <div className="w-8 h-2.5 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-600 rounded-full shadow-inner" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 shadow-md border border-slate-600 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            </div>
          </div>
        </div>

        {/* 2. Center Tablet / Screen with Flame & Metrics */}
        <div className="w-28 sm:w-32 h-36 sm:h-40 bg-white rounded-2xl shadow-2xl shadow-indigo-500/15 border border-indigo-100 p-2.5 flex flex-col justify-between transform -translate-y-1">
          {/* Header Flame */}
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md shadow-orange-500/30">
              <Flame className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="w-10 h-2 bg-indigo-50 rounded-full" />
          </div>

          {/* Activity Lines */}
          <div className="space-y-1.5 my-1">
            <div className="w-full h-1.5 bg-indigo-50 rounded-full" />
            <div className="w-3/4 h-1.5 bg-indigo-50 rounded-full" />
          </div>

          {/* Mini Bar Chart */}
          <div className="flex items-end justify-between gap-1 h-12 bg-slate-50/80 rounded-xl p-1.5 border border-slate-100">
            <div className="w-2.5 h-4 bg-indigo-200 rounded-sm" />
            <div className="w-2.5 h-7 bg-indigo-300 rounded-sm" />
            <div className="w-2.5 h-10 bg-indigo-600 rounded-sm shadow-sm" />
            <div className="w-2.5 h-6 bg-indigo-400 rounded-sm" />
            <div className="w-2.5 h-8 bg-purple-500 rounded-sm" />
          </div>
        </div>

        {/* 3. Athletic Running Shoe on Right */}
        <div className="w-24 sm:w-28 h-16 sm:h-20 relative transform translate-y-1">
          {/* Shoe Body */}
          <div className="w-full h-full bg-gradient-to-r from-[#7C8CF4] via-[#94A3F8] to-[#B4C0FE] rounded-2xl shadow-xl shadow-indigo-500/20 border border-white/60 p-1 flex flex-col justify-between">
            {/* Laces */}
            <div className="flex justify-center gap-1 mt-1">
              <div className="w-3 h-1 bg-white rounded-full shadow-xs transform rotate-12" />
              <div className="w-3 h-1 bg-white rounded-full shadow-xs transform -rotate-12" />
            </div>
            {/* Shoe Sole */}
            <div className="w-full h-4 bg-white rounded-xl shadow-md flex items-center justify-around px-1">
              <div className="w-2 h-1 bg-slate-200 rounded-full" />
              <div className="w-2 h-1 bg-slate-200 rounded-full" />
              <div className="w-2 h-1 bg-slate-200 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CompleteProfile({ authUser, onComplete }) {
  const [step, setStep] = useState(0); // 0: Personal Info, 1: Body Metrics, 2: Contact/OTP, 3: Complete
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Personal Info
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(authUser?.photoURL || '');
  const [name, setName] = useState(authUser?.name || '');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male'); // Default to Male as in reference
  const avatarInputRef = useRef(null);

  // Step 2 — Body Metrics
  const [heightCm, setHeightCm] = useState('175');
  const [weightKg, setWeightKg] = useState('70');
  const [fitnessGoal, setFitnessGoal] = useState('Fat-loss');

  // Step 3 — Contact OTP
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [primaryOtpSent, setPrimaryOtpSent] = useState(false);
  const [primaryOtpCode, setPrimaryOtpCode] = useState('');
  const [primaryVerified, setPrimaryVerified] = useState(false);
  const [primaryDevOtp, setPrimaryDevOtp] = useState('');
  const [primaryOtpLoading, setPrimaryOtpLoading] = useState(false);

  const [altPhone, setAltPhone] = useState('');
  const [altOtpSent, setAltOtpSent] = useState(false);
  const [altOtpCode, setAltOtpCode] = useState('');
  const [altVerified, setAltVerified] = useState(false);
  const [altDevOtp, setAltDevOtp] = useState('');
  const [altOtpLoading, setAltOtpLoading] = useState(false);

  const [contactError, setContactError] = useState('');

  // ── Avatar Upload Handler ────────────────────────────────────────────────────
  const handleAvatarChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const uploadAvatar = useCallback(async () => {
    if (!avatarFile) return null;
    const form = new FormData();
    form.append('file', avatarFile);
    const res = await authenticatedFetch(`${API_BASE}/api/upload/avatar`, {
      method: 'POST',
      body: form,
      headers: {},
    });
    if (!res.ok) throw new Error('Avatar upload failed');
    const data = await res.json();
    return data.url;
  }, [avatarFile]);

  // ── OTP Helpers ──────────────────────────────────────────────────────────────
  const sendOtp = useCallback(async (phone, field, setDevOtp, setSent, setLoading) => {
    setGlobalError('');
    setContactError('');
    const val = validateIndianMobile(phone, field === 'mobile');
    if (!val.valid) {
      setContactError(val.error);
      return;
    }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/profile/send-otp`, {
        method: 'POST',
        body: JSON.stringify({ phone: val.normalized, field }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactError(parseApiError(data.detail, 'Failed to send OTP.'));
        return;
      }
      setSent(true);
      if (data.dev_otp) setDevOtp(data.dev_otp);
    } catch (e) {
      setContactError('Network error while dispatching OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (phone, code, field, setVerified, setLoading) => {
    setContactError('');
    const val = validateIndianMobile(phone, field === 'mobile');
    if (!val.valid) {
      setContactError(val.error);
      return;
    }
    if (!code.trim()) {
      setContactError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/profile/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ phone: val.normalized, code: code.trim(), field }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactError(parseApiError(data.detail, 'Invalid verification code.'));
        return;
      }
      setVerified(true);
    } catch (e) {
      setContactError('Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Step Validation ──────────────────────────────────────────────────────────
  const validateStep0 = () => {
    if (!name.trim()) {
      setGlobalError('Full name is required.');
      return false;
    }
    if (!dob) {
      setGlobalError('Date of birth is required.');
      return false;
    }
    const calculatedAge = calculateAge(dob);
    if (calculatedAge === null || calculatedAge < 10 || calculatedAge > 100) {
      setGlobalError('Please enter a valid date of birth (age between 10 and 100).');
      return false;
    }
    if (!gender) {
      setGlobalError('Please select your gender.');
      return false;
    }
    setGlobalError('');
    return true;
  };

  const validateStep1 = () => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    if (!heightCm || isNaN(h) || h < 100 || h > 250) {
      setGlobalError('Height must be between 100 and 250 cm.');
      return false;
    }
    if (!weightKg || isNaN(w) || w < 20 || w > 300) {
      setGlobalError('Weight must be between 20 and 300 kg.');
      return false;
    }
    if (!fitnessGoal) {
      setGlobalError('Please select your primary fitness goal.');
      return false;
    }
    setGlobalError('');
    return true;
  };

  const validateStep2 = () => {
    const pVal = validateIndianMobile(primaryPhone, true);
    if (!pVal.valid) {
      setGlobalError(pVal.error);
      return false;
    }
    if (!primaryVerified) {
      setGlobalError('Please verify your primary mobile number via OTP first.');
      return false;
    }
    if (extractLocal10Digit(altPhone)) {
      const aVal = validateIndianMobile(altPhone, false);
      if (!aVal.valid) {
        setGlobalError(aVal.error);
        return false;
      }
      if (!altVerified) {
        setGlobalError('Please verify your alternate mobile number via OTP or clear the field.');
        return false;
      }
    }
    setGlobalError('');
    return true;
  };

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleNext = () => {
    setGlobalError('');
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setGlobalError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  // ── Final Profile Submission ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setGlobalError('');
    try {
      // 1. Upload avatar if selected
      let uploadedAvatarUrl = null;
      if (avatarFile) {
        try {
          uploadedAvatarUrl = await uploadAvatar();
        } catch (e) {
          console.warn('[BX] Avatar upload skipped:', e);
        }
      }

      const pVal = validateIndianMobile(primaryPhone, true);
      const aVal = validateIndianMobile(altPhone, false);

      // 2. Submit Complete Profile to backend
      const payload = {
        name: name.trim(),
        date_of_birth: dob,
        gender: gender.toLowerCase(),
        height_cm: parseFloat(heightCm),
        weight_kg: parseFloat(weightKg),
        mobile_number: pVal.normalized,
        alternate_mobile_number: aVal.normalized || '',
        fitness_goal: fitnessGoal,
        avatar_url: uploadedAvatarUrl || authUser?.photoURL || null,
      };

      const res = await authenticatedFetch(`${API_BASE}/api/profile/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setGlobalError(parseApiError(data.detail, 'Profile completion failed. Please try again.'));
        return;
      }

      if (onComplete) {
        onComplete(data.profile);
      }
    } catch (e) {
      setGlobalError('Network error while saving profile. Please verify your connection.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, name, dob, gender, heightCm, weightKg, primaryPhone, altPhone, fitnessGoal, avatarFile, authUser, onComplete, uploadAvatar]);

  const currentStepMeta = STEPS[step];
  const age = dob ? calculateAge(dob) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FE] via-[#EEF0FD] to-[#E9EDFD] flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden font-sans">
      {/* Background Ambient Blur Orbs */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-indigo-200/35 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-purple-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Grid Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ─── LEFT COLUMN: Brand, Title, 4-Step Tracker & 3D Illustration (Span 5) ─── */}
        <div className="lg:col-span-5 flex flex-col justify-between py-2">
          <div>
            {/* Step Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white bg-indigo-600 shadow-sm shadow-indigo-600/20 mb-4">
              <Sparkles className="w-3 h-3 text-indigo-200" />
              <span>Step {step + 1} of 4</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-[1.15]">
              Let's Build <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600">
                Your Profile
              </span>
            </h1>

            {/* Supporting Text */}
            <p className="text-sm text-slate-500 mt-3 font-medium leading-relaxed max-w-sm">
              Help us get to know you better so we can create a personalized fitness experience.
            </p>

            {/* 4-Step Vertical Progress Tracker */}
            <div className="mt-8 space-y-6">
              {STEPS.map((s, i) => {
                const isCompleted = i < step;
                const isCurrent = i === step;
                const isUpcoming = i > step;

                return (
                  <div key={i} className="relative flex items-start gap-4 group">
                    {/* Vertical Connector Line */}
                    {i < STEPS.length - 1 && (
                      <div 
                        className={`absolute left-4 top-8 w-0.5 h-10 -ml-[1px] transition-all duration-300 ${
                          isCompleted ? 'bg-indigo-600' : 'bg-slate-200 border-l border-dashed border-slate-300'
                        }`} 
                      />
                    )}

                    {/* Step Number Circle */}
                    <div 
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 flex-shrink-0 ${
                        isCompleted
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-white'
                          : isCurrent
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-4 ring-indigo-100 ring-offset-1'
                          : 'bg-indigo-50/80 border border-indigo-200 text-slate-400 font-bold'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                    </div>

                    {/* Step Labels */}
                    <div className="pt-0.5">
                      <h4 
                        className={`text-sm font-bold tracking-tight transition-colors ${
                          isCurrent 
                            ? 'text-indigo-600 font-extrabold' 
                            : isCompleted 
                            ? 'text-slate-900' 
                            : 'text-slate-400'
                        }`}
                      >
                        {s.title}
                      </h4>
                      <p className={`text-xs mt-0.5 font-medium ${isCurrent ? 'text-slate-600' : 'text-slate-400'}`}>
                        {s.subtitle}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3D-Styled Fitness Graphic Illustration */}
          <FitnessIllustration />
        </div>

        {/* ─── RIGHT COLUMN: Rounded White Profile Form Card (Span 7) ─── */}
        <div className="lg:col-span-7">
          <div className="bg-white/95 backdrop-blur-md border border-indigo-50/80 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl shadow-indigo-100/80 relative transition-all">
            
            {/* Card Header: Icon + Title/Subtitle + Progress % */}
            <div className="flex items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
                  <currentStepMeta.icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {currentStepMeta.cardTitle}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {currentStepMeta.cardSubtitle}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="text-right flex-shrink-0">
                <span className="text-xs font-bold text-slate-500">
                  {currentStepMeta.progress}% Completed
                </span>
                <div className="w-28 sm:w-32 h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5 shadow-inner">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 transition-all duration-500 shadow-sm"
                    style={{ width: `${currentStepMeta.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Error Banner Alert */}
            {globalError && (
              <div className="mb-5 px-4 py-3 bg-red-50/90 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold flex items-start gap-2.5 shadow-xs animate-shake">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="leading-tight">{globalError}</span>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* STEP 1: Personal Information (Matches Reference Image) */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {step === 0 && (
              <div className="space-y-6">
                
                {/* 1. Profile Photo Upload */}
                <div className="flex flex-col items-center justify-center">
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-28 h-28 rounded-full border-2 border-dashed border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/80 transition-all cursor-pointer flex flex-col items-center justify-center group shadow-xs overflow-hidden"
                  >
                    {avatarPreview ? (
                      <>
                        <img 
                          src={avatarPreview} 
                          alt="Avatar Preview" 
                          className="w-full h-full object-cover rounded-full" 
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold">
                          <Camera className="w-5 h-5 mb-0.5" />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs mb-1 group-hover:scale-105 transition-transform">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-indigo-900">Upload Photo</span>
                        <span className="text-[10px] text-slate-500 text-center px-2 leading-tight">
                          Click to upload profile picture
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                {/* 2. Full Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Full Name <span className="text-red-500">*</span></span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. SANJAI R"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all hover:bg-white"
                    />
                  </div>
                </div>

                {/* 3. Date of Birth Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Date of Birth <span className="text-red-500">*</span></span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <input
                      type="date"
                      value={dob}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all hover:bg-white"
                    />
                  </div>
                  {age !== null && age >= 10 && age <= 100 && (
                    <p className="text-[11px] text-indigo-600 font-semibold mt-1.5 pl-1 flex items-center gap-1">
                      <Check className="w-3 h-3 text-indigo-600" />
                      <span>Calibrated Age: <strong>{age} years old</strong></span>
                    </p>
                  )}
                </div>

                {/* 4. Gender Selection (3 Cards: Male, Female, Other) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Gender <span className="text-red-500">*</span></span>
                  </label>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {[
                      { id: 'Male', label: 'Male', symbol: '♂' },
                      { id: 'Female', label: 'Female', symbol: '♀' },
                      { id: 'Other', label: 'Other', symbol: '⚧' },
                    ].map((g) => {
                      const isSelected = gender.toLowerCase() === g.id.toLowerCase();
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGender(g.id)}
                          className={`relative py-3.5 px-3 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 ${
                            isSelected
                              ? 'border-2 border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm ring-2 ring-indigo-200/50'
                              : 'border border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                          <span className={`text-xl font-bold mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>
                            {g.symbol}
                          </span>
                          <span className="text-xs font-bold">{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit / Continue Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 text-base cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* STEP 2: Body Metrics & Fitness Goals (50% Completed) */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Height & Weight Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Height */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Height (cm) <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="100"
                        max="250"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        placeholder="175"
                        className="w-full px-4 py-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all hover:bg-white"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">CM</span>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Weight className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Weight (kg) <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="20"
                        max="300"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        placeholder="70"
                        className="w-full px-4 py-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 font-bold text-base focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all hover:bg-white"
                      />
                      <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">KG</span>
                    </div>
                  </div>
                </div>

                {/* Fitness Goals */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Primary Fitness Goal <span className="text-red-500">*</span></span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {GOAL_OPTIONS.map((g) => {
                      const isSelected = fitnessGoal === g.value;
                      return (
                        <div
                          key={g.value}
                          onClick={() => setFitnessGoal(g.value)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative ${
                            isSelected
                              ? 'border-2 border-indigo-600 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-200/50'
                              : 'border-slate-200 bg-slate-50/40 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-2xl flex-shrink-0">{g.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-slate-900">{g.label}</h4>
                            <p className="text-[11px] text-slate-500 truncate">{g.description}</p>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="py-4 px-6 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* STEP 3: Contact & OTP Verification (75% Completed) */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <div className="space-y-6">
                {contactError && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{contactError}</span>
                  </div>
                )}

                {primaryDevOtp && (
                  <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
                    <span>🧪 Local Test Mode OTP: <strong className="text-amber-950 tracking-widest text-sm">{primaryDevOtp}</strong></span>
                  </div>
                )}

                {/* Primary Mobile Verification */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Primary Mobile Number <span className="text-red-500">*</span></span>
                    </span>
                    {primaryVerified && (
                      <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </label>

                  <div className="flex gap-2 items-center">
                    <IndianPhoneInput
                      value={primaryPhone}
                      disabled={primaryVerified}
                      onChange={(val) => {
                        setPrimaryPhone(val);
                        if (primaryVerified) setPrimaryVerified(false);
                      }}
                      placeholder="9876543210"
                      className="flex-1"
                    />
                    {!primaryVerified && (
                      <button
                        type="button"
                        disabled={primaryOtpLoading || extractLocal10Digit(primaryPhone).length < 10}
                        onClick={() => sendOtp(primaryPhone, 'mobile', setPrimaryDevOtp, setPrimaryOtpSent, setPrimaryOtpLoading)}
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      >
                        {primaryOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{primaryOtpSent ? 'Resend' : 'Send OTP'}</span>
                      </button>
                    )}
                  </div>

                  {/* OTP Input Section */}
                  {primaryOtpSent && !primaryVerified && (
                    <div className="pt-2 flex gap-2">
                      <input
                        type="text"
                        maxLength="6"
                        value={primaryOtpCode}
                        onChange={(e) => setPrimaryOtpCode(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        className="flex-1 px-4 py-2.5 bg-white border border-indigo-300 rounded-xl text-slate-900 font-bold tracking-widest text-center focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        type="button"
                        disabled={primaryOtpLoading || primaryOtpCode.length < 6}
                        onClick={() => verifyOtp(primaryPhone, primaryOtpCode, 'mobile', setPrimaryVerified, setPrimaryOtpLoading)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1"
                      >
                        {primaryOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Verify</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Alternate Phone */}
                <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Alternate Mobile (Optional)</span>
                    </span>
                    {altVerified && (
                      <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </label>

                  <div className="flex gap-2 items-center">
                    <IndianPhoneInput
                      value={altPhone}
                      disabled={altVerified}
                      onChange={(val) => {
                        setAltPhone(val);
                        if (altVerified) setAltVerified(false);
                      }}
                      placeholder="9876543210"
                      className="flex-1"
                    />
                    {extractLocal10Digit(altPhone).length === 10 && !altVerified && (
                      <button
                        type="button"
                        disabled={altOtpLoading}
                        onClick={() => sendOtp(altPhone, 'alternate_mobile', setAltDevOtp, setAltOtpSent, setAltOtpLoading)}
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      >
                        {altOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>{altOtpSent ? 'Resend' : 'Send OTP'}</span>
                      </button>
                    )}
                  </div>

                  {altDevOtp && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
                      <span>🧪 Alternate OTP: <strong className="text-amber-950 tracking-widest text-sm">{altDevOtp}</strong></span>
                    </div>
                  )}

                  {altOtpSent && !altVerified && (
                    <div className="pt-2 flex gap-2">
                      <input
                        type="text"
                        maxLength="6"
                        value={altOtpCode}
                        onChange={(e) => setAltOtpCode(e.target.value)}
                        placeholder="Enter 6-digit OTP"
                        className="flex-1 px-4 py-2.5 bg-white border border-indigo-300 rounded-xl text-slate-900 font-bold tracking-widest text-center focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        type="button"
                        disabled={altOtpLoading || altOtpCode.length < 6}
                        onClick={() => verifyOtp(altPhone, altOtpCode, 'alternate_mobile', setAltVerified, setAltOtpLoading)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-1"
                      >
                        {altOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Verify</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="py-4 px-6 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {/* STEP 4: Review & Finalize (100% Completed) */}
            {/* ══════════════════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <div className="space-y-6">
                
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/50 to-blue-50/70 border border-indigo-100 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-4 pb-3 border-b border-indigo-100/80">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase() || 'A'
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{name}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {gender} • {age ? `${age} yrs` : 'Calibrated'} • {heightCm}cm • {weightKg}kg
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-slate-400 block font-semibold">Primary Goal</span>
                      <span className="text-slate-900 font-bold mt-0.5 block">{fitnessGoal}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-50">
                      <span className="text-slate-400 block font-semibold">Verified Phone</span>
                      <span className="text-slate-900 font-bold mt-0.5 block">{primaryPhone || 'Verified'}</span>
                    </div>
                  </div>
                </div>

                {/* Final Launch Button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="py-4 px-6 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Calibrating Profile...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Profile & Enter Studio</span>
                        <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
