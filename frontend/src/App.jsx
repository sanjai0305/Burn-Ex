import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import CompleteProfile from './components/CompleteProfile';
import ProfileCompletionGuard from './components/ProfileCompletionGuard';
import IndianPhoneInput, { validateIndianMobile } from './components/IndianPhoneInput';
import AnalyticsPage from './components/AnalyticsPage';
import WorkoutCountdown from './components/WorkoutCountdown';
import PreWorkoutModal from './components/PreWorkoutModal';
import useCountdown from './hooks/useCountdown';
import voiceService from './services/voiceService';
import { useProfileStatus } from './hooks/useProfileStatus';
import { onAuthStateChange, logout as firebaseLogout, authenticatedFetch } from './auth/AuthService';
import * as aiModelService from './services/aiModelService';
import { EXERCISE_CONFIGS } from './services/aiModelService';

const SAFE_EXERCISE_CONFIGS = EXERCISE_CONFIGS || {
  pushup: { name: "Push-Up" },
  squat: { name: "Squat" },
  jumping_jack: { name: "Jumping Jack" },
  lunge: { name: "Lunge" },
  plank: { name: "Plank" },
  burpee: { name: "Burpee" }
};
import { useWsWorkout } from './hooks/useWsWorkout';
import BurnExProModal from './components/BurnExProModal';
import { 
  Trophy, 
  Activity, 
  User, 
  ShieldAlert, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Send, 
  Loader2, 
  LogOut,
  Camera,
  AlertCircle,
  Flame,
  Dumbbell,
  Heart,
  Zap,
  Target,
  Timer,
  Calendar,
  Star,
  TrendingUp,
  MessageCircle,
  Bot,
  ArrowRight,
  Clock,
  Award,
  BarChart3,
  Users,
  Shield,
  ChevronDown,
  Sun,
  Moon,
  Home,
  Footprints,
  Wind,
  Utensils,
  Droplet,
  Bell,
  Sliders,
  Lock,
  Eye,
  Download,
  Trash2,
  Globe,
  Key,
  Laptop,
  Check,
  HelpCircle,
  Smartphone,
  Crown,
  Search,
  PieChart,
  ChevronLeft,
  CheckCheck,
  Brain
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

// Custom lightweight and safe markdown parser built directly in React Virtual DOM to avoid XSS issues
const renderMarkdown = (text) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const elements = [];
  let currentList = [];
  let currentListType = null; // 'ul' or 'ol'
  
  const parseInline = (str) => {
    const parts = [];
    let lastIndex = 0;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold text-slate-900">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : str;
  };

  const flushList = () => {
    if (currentListType && currentList.length > 0) {
      const Tag = currentListType;
      const listStyle = currentListType === 'ul' ? "list-disc pl-5 my-1.5 space-y-1" : "list-decimal pl-5 my-1.5 space-y-1";
      elements.push(
        <Tag key={`list-${elements.length}`} className={listStyle}>
          {currentList}
        </Tag>
      );
      currentList = [];
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h5 key={i} className="text-xs font-bold text-slate-900 mt-2.5 mb-1">{parseInline(line.substring(4))}</h5>);
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(<h4 key={i} className="text-xs font-extrabold text-slate-900 mt-3 mb-1">{parseInline(line.substring(3))}</h4>);
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(<h3 key={i} className="text-sm font-black text-slate-950 mt-3.5 mb-1.5">{parseInline(line.substring(2))}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      currentList.push(<li key={`li-${i}`} className="text-xs text-slate-700 leading-normal">{parseInline(line.substring(2))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      const dotIndex = line.indexOf('.');
      const content = line.substring(dotIndex + 1).trim();
      currentList.push(<li key={`li-${i}`} className="text-xs text-slate-700 leading-normal">{parseInline(content)}</li>);
    } else {
      flushList();
      elements.push(<p key={i} className="text-xs text-slate-700 my-1 leading-relaxed">{parseInline(line)}</p>);
    }
  }

  flushList();
  return <div className="space-y-0.5">{elements}</div>;
};


// ============================================================================
// GOAL PROGRAM DEFINITIONS with rich metadata
// ============================================================================
const GOAL_PROGRAMS = [
  { 
    value: 'Fat-loss', 
    title: 'Fat Loss', 
    desc: 'High-intensity metabolic burn circuits to maximize caloric expenditure',
    icon: Flame, 
    color: 'orange',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    textClass: 'text-orange-600',
    iconBg: 'bg-orange-100',
    intensity: 'High',
    daysPerWeek: 6,
    duration: '30-45 min',
    tags: ['Cardio', 'HIIT', 'Circuit']
  },
  { 
    value: 'Strength', 
    title: 'Strength', 
    desc: 'Progressive overload with time-under-tension focus for maximum muscle activation',
    icon: Dumbbell, 
    color: 'blue',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-600',
    iconBg: 'bg-blue-100',
    intensity: 'High',
    daysPerWeek: 5,
    duration: '40-60 min',
    tags: ['Hypertrophy', 'Power', 'Control']
  },
  { 
    value: 'Endurance', 
    title: 'Endurance', 
    desc: 'High-repetition sustained effort to build cardiovascular stamina',
    icon: Heart, 
    color: 'rose',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    textClass: 'text-rose-600',
    iconBg: 'bg-rose-100',
    intensity: 'Medium-High',
    daysPerWeek: 6,
    duration: '45-60 min',
    tags: ['Stamina', 'Cardio', 'Volume']
  },
  { 
    value: 'Mobility', 
    title: 'Mobility', 
    desc: 'Full range-of-motion control with joint alignment and flexibility drills',
    icon: Wind, 
    color: 'teal',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    textClass: 'text-teal-600',
    iconBg: 'bg-teal-100',
    intensity: 'Low-Medium',
    daysPerWeek: 5,
    duration: '20-35 min',
    tags: ['Flexibility', 'ROM', 'Recovery']
  },
  { 
    value: 'General fitness', 
    title: 'General Fitness', 
    desc: 'Balanced structural stability combining all movement patterns',
    icon: Target, 
    color: 'violet',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    textClass: 'text-violet-600',
    iconBg: 'bg-violet-100',
    intensity: 'Medium',
    daysPerWeek: 5,
    duration: '30-45 min',
    tags: ['Balanced', 'Functional', 'Core']
  },
  { 
    value: 'Beginner fitness', 
    title: 'Beginner', 
    desc: 'Joint alignment foundation with guided form coaching for newcomers',
    icon: Star, 
    color: 'emerald',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    intensity: 'Low',
    daysPerWeek: 4,
    duration: '15-25 min',
    tags: ['Foundation', 'Form', 'Guided']
  },
  { 
    value: 'Home workout', 
    title: 'Home Workout', 
    desc: 'Equipment-free bodyweight circuits designed for small spaces',
    icon: Home, 
    color: 'cyan',
    bgClass: 'bg-cyan-50',
    borderClass: 'border-cyan-200',
    textClass: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
    intensity: 'Medium',
    daysPerWeek: 5,
    duration: '20-35 min',
    tags: ['Bodyweight', 'No Equipment', 'Compact']
  },
  { 
    value: 'HIIT', 
    title: 'HIIT', 
    desc: 'Maximum-effort interval training with explosive power output cycles',
    icon: Zap, 
    color: 'amber',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-600',
    iconBg: 'bg-amber-100',
    intensity: 'Very High',
    daysPerWeek: 4,
    duration: '20-30 min',
    tags: ['Intervals', 'Explosive', 'Sprint']
  }
];

// Day labels
const WEEK_DAYS = [
  { key: 'day_1', short: 'MON', full: 'Monday' },
  { key: 'day_2', short: 'TUE', full: 'Tuesday' },
  { key: 'day_3', short: 'WED', full: 'Wednesday' },
  { key: 'day_4', short: 'THU', full: 'Thursday' },
  { key: 'day_5', short: 'FRI', full: 'Friday' },
  { key: 'day_6', short: 'SAT', full: 'Saturday' },
  { key: 'day_7', short: 'SUN', full: 'Sunday' }
];

// Quick prompt suggestions for AI Coach
const COACH_SUGGESTIONS = [
  "How's my squat form?",
  "What should I eat post-workout?",
  "Why do my knees hurt during squats?",
  "How many calories did I burn today?",
  "Should I increase my reps?",
  "What's the best warm-up routine?"
];

// Indian food database
const INDIAN_FOODS_DB = [
  { id: 'f1', name: 'Idli', unit: 'piece', calories: 60, protein: 2.0, carbs: 12.0, fat: 0.5, fiber: 1.0, tags: ['veg', 'vegan', 'breakfast'], ingredients: 'Steamed fermented rice and black lentil batter' },
  { id: 'f2', name: 'Sambar', unit: 'cup (150ml)', calories: 120, protein: 4.0, carbs: 18.0, fat: 3.0, fiber: 3.5, tags: ['veg', 'vegan', 'breakfast', 'lunch', 'dinner'], ingredients: 'Pigeon peas (toor dal), mixed vegetables, tamarind, sambar spices' },
  { id: 'f3', name: 'Masala Dosa', unit: 'piece', calories: 280, protein: 5.0, carbs: 48.0, fat: 8.0, fiber: 2.0, tags: ['veg', 'breakfast', 'dinner'], ingredients: 'Fermented rice-lentil crepe, spiced potato mash filling, oil' },
  { id: 'f4', name: 'Ragi Dosa', unit: 'piece', calories: 150, protein: 3.0, carbs: 32.0, fat: 1.5, fiber: 4.0, tags: ['veg', 'vegan', 'breakfast'], ingredients: 'Finger millet flour, urad dal, oil' },
  { id: 'f5', name: 'Upma', unit: 'bowl (150g)', calories: 220, protein: 4.0, carbs: 38.0, fat: 5.0, fiber: 2.5, tags: ['veg', 'vegan', 'breakfast'], ingredients: 'Roasted semolina (suji), mustard seeds, vegetables, oil' },
  { id: 'f6', name: 'Curd Rice', unit: 'bowl (200g)', calories: 280, protein: 6.0, carbs: 42.0, fat: 8.0, fiber: 1.0, tags: ['veg', 'lunch'], ingredients: 'Pre-cooked rice, yogurt, tempered mustard seeds, ginger, curry leaves' },
  { id: 'f7', name: 'Sundal (Chickpeas)', unit: 'cup (100g)', calories: 160, protein: 8.0, carbs: 24.0, fat: 3.0, fiber: 6.0, tags: ['veg', 'vegan', 'snack'], ingredients: 'Boiled black or white chickpeas, mustard seeds, green chillies, grated coconut' },
  { id: 'f8', name: 'Roti (Whole Wheat)', unit: 'piece', calories: 85, protein: 3.0, carbs: 18.0, fat: 0.5, fiber: 2.5, tags: ['veg', 'vegan', 'breakfast', 'lunch', 'dinner'], ingredients: 'Whole wheat flour (atta), water' },
  { id: 'f9', name: 'Dal Tadka', unit: 'cup (150ml)', calories: 150, protein: 7.0, carbs: 22.0, fat: 4.0, fiber: 4.5, tags: ['veg', 'vegan', 'lunch', 'dinner'], ingredients: 'Yellow split lentils, garlic, cumin seeds, tomatoes, ghee/oil' },
  { id: 'f10', name: 'Paneer Makhani', unit: 'cup (150g)', calories: 320, protein: 14.0, carbs: 12.0, fat: 26.0, fiber: 1.0, tags: ['veg', 'lunch', 'dinner'], ingredients: 'Cottage cheese (paneer), tomato paste, butter, heavy cream, cashews, spices' },
  { id: 'f11', name: 'Palak Paneer', unit: 'cup (150g)', calories: 220, protein: 12.0, carbs: 8.0, fat: 16.0, fiber: 3.0, tags: ['veg', 'lunch', 'dinner'], ingredients: 'Paneer cubes, spinach puree, garlic, cream, spices' },
  { id: 'f12', name: 'Poha', unit: 'plate (150g)', calories: 250, protein: 4.0, carbs: 46.0, fat: 6.0, fiber: 2.0, tags: ['veg', 'vegan', 'breakfast', 'snack'], ingredients: 'Flattened rice, peanuts, onions, mustard seeds, turmeric, lemon' },
  { id: 'f13', name: 'Khichdi', unit: 'bowl (200g)', calories: 240, protein: 7.0, carbs: 44.0, fat: 4.0, fiber: 4.0, tags: ['veg', 'vegan', 'lunch', 'dinner'], ingredients: 'Rice, split yellow lentils (moong dal), turmeric, ginger, ghee' },
  { id: 'f14', name: 'Rajma Masala', unit: 'cup (150ml)', calories: 180, protein: 8.0, carbs: 28.0, fat: 4.0, fiber: 7.0, tags: ['veg', 'vegan', 'lunch', 'dinner'], ingredients: 'Red kidney beans, onions, tomatoes, ginger-garlic paste, spices' },
  { id: 'f15', name: 'Boiled Egg', unit: 'piece', calories: 75, protein: 6.0, carbs: 0.6, fat: 5.0, fiber: 0.0, tags: ['egg', 'non-veg', 'breakfast', 'snack'], ingredients: 'Whole hard-boiled chicken egg' },
  { id: 'f16', name: 'Egg Bhurji', unit: 'plate (2 eggs)', calories: 210, protein: 13.0, carbs: 4.0, fat: 16.0, fiber: 1.0, tags: ['egg', 'non-veg', 'breakfast', 'dinner'], ingredients: 'Two scrambled eggs, chopped onions, tomatoes, coriander, green chillies, oil' },
  { id: 'f17', name: 'Chicken Curry', unit: 'cup (150g)', calories: 260, protein: 24.0, carbs: 6.0, fat: 15.0, fiber: 1.5, tags: ['non-veg', 'lunch', 'dinner'], ingredients: 'Boneless chicken chunks, onion gravy, yogurt, ginger, spices, oil' },
  { id: 'f18', name: 'Grilled Chicken Breast', unit: '100g', calories: 165, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, tags: ['non-veg', 'lunch', 'dinner', 'snack'], ingredients: 'Lean chicken breast marinated in herbs, grilled with minimal oil' },
  { id: 'f19', name: 'Fish Fry (Tawa)', unit: '100g', calories: 180, protein: 20.0, carbs: 2.0, fat: 10.0, fiber: 0.0, tags: ['non-veg', 'lunch', 'dinner'], ingredients: 'Fish fillet coated in spices, pan-fried on flat iron griddle' },
  { id: 'f20', name: 'Soya Chunks Masala', unit: 'cup (100g)', calories: 150, protein: 18.0, carbs: 12.0, fat: 3.0, fiber: 5.0, tags: ['veg', 'vegan', 'lunch', 'dinner'], ingredients: 'Textured vegetable soya chunks, tomato-onion gravy, spices' },
  { id: 'f21', name: 'Tofu Bhurji', unit: 'plate (100g)', calories: 140, protein: 12.0, carbs: 5.0, fat: 8.0, fiber: 2.0, tags: ['veg', 'vegan', 'breakfast', 'snack'], ingredients: 'Crumbled firm tofu, onions, capsicum, turmeric, salt, oil' },
  { id: 'f22', name: 'Banana', unit: 'medium', calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3, fiber: 3.0, tags: ['veg', 'vegan', 'snack', 'breakfast'], ingredients: 'Raw fresh banana' },
  { id: 'f23', name: 'Almonds', unit: 'handful (10 pcs)', calories: 70, protein: 2.5, carbs: 2.5, fat: 6.0, fiber: 1.5, tags: ['veg', 'vegan', 'snack'], ingredients: 'Raw whole almonds' },
  { id: 'f24', name: 'Makhana (Roasted)', unit: 'cup (25g)', calories: 90, protein: 2.0, carbs: 18.0, fat: 1.0, fiber: 2.5, tags: ['veg', 'vegan', 'snack'], ingredients: 'Foxnuts dry-roasted, lightly salted' },
  { id: 'f25', name: 'Buttermilk (Chaas)', unit: 'glass (200ml)', calories: 45, protein: 2.0, carbs: 4.0, fat: 1.5, fiber: 0.0, tags: ['veg', 'snack'], ingredients: 'Diluted yogurt, black salt, toasted cumin powder, coriander' },
  { id: 'f26', name: 'Fruit Salad', unit: 'cup (150g)', calories: 90, protein: 1.0, carbs: 22.0, fat: 0.2, fiber: 3.0, tags: ['veg', 'vegan', 'snack'], ingredients: 'Diced seasonal fruits (papaya, apple, pomegranate, melon)' }
];

// Presets by Goal and Dietary Preference
const getDefaultMealPlan = (goal, preference) => {
  const isVeg = preference === 'vegetarian';
  const isVegan = preference === 'vegan';
  const isEgg = preference === 'eggetarian';
  
  let breakfast, midMorning, lunch, eveningSnack, dinner;

  if (isVegan) {
    breakfast = { id: 'p1', name: 'Ragi Dosa + Sambar', qty: 2.0, unit: 'pieces', calories: 360, protein: 10.0, carbs: 64.0, fat: 5.0, fiber: 9.0, ingredients: 'Ragi flour, urad dal, lentils, drumsticks, spices' };
    midMorning = { id: 'p2', name: 'Banana + Almonds', qty: 1.0, unit: 'serving', calories: 175, protein: 4.0, carbs: 30.0, fat: 6.0, fiber: 4.5, ingredients: '1 medium banana, 10 almonds' };
    lunch = { id: 'p3', name: 'Brown Rice + Rajma Masala + Salad', qty: 1.0, unit: 'serving', calories: 560, protein: 20.0, carbs: 90.0, fat: 9.0, fiber: 14.0, ingredients: '1 cup brown rice, 1.5 cups kidney bean curry, mixed salad' };
    eveningSnack = { id: 'p4', name: 'Roasted Makhana', qty: 1.0, unit: 'cup (25g)', calories: 90, protein: 2.0, carbs: 18.0, fat: 1.0, fiber: 2.5, ingredients: 'Foxnuts roasted with pinch of salt' };
    dinner = { id: 'p5', name: 'Roti + Soya Chunks Curry + Dal', qty: 2.0, unit: 'pieces', calories: 480, protein: 28.0, carbs: 68.0, fat: 8.0, fiber: 12.0, ingredients: '2 whole wheat rotis, 1 cup soy curry, 1 cup yellow dal' };
  } else if (isVeg) {
    breakfast = { id: 'p6', name: 'Idli + Sambar + Coconut Chutney', qty: 3.0, unit: 'pieces', calories: 380, protein: 12.0, carbs: 54.0, fat: 10.0, fiber: 7.0, ingredients: '3 steamed rice-lentil cakes, sambar, 2 tbsp chutney' };
    midMorning = { id: 'p7', name: 'Apple + Almonds', qty: 1.0, unit: 'serving', calories: 155, protein: 3.0, carbs: 24.0, fat: 6.0, fiber: 4.0, ingredients: '1 medium apple, 10 almonds' };
    lunch = { id: 'p8', name: 'White Rice + Dal Tadka + Palak Paneer', qty: 1.0, unit: 'serving', calories: 650, protein: 24.0, carbs: 80.0, fat: 23.0, fiber: 9.0, ingredients: '1.5 cups basmati rice, 1 cup dal, 100g spinach-cottage cheese curry' };
    eveningSnack = { id: 'p9', name: 'Sprouted Moong Salad + Buttermilk', qty: 1.0, unit: 'serving', calories: 180, protein: 10.0, carbs: 26.0, fat: 2.0, fiber: 6.0, ingredients: '1 cup sprouted green gram, 1 glass buttermilk' };
    dinner = { id: 'p10', name: 'Chapati + Paneer Bhurji + Curd', qty: 2.0, unit: 'pieces', calories: 540, protein: 26.0, carbs: 46.0, fat: 22.0, fiber: 5.0, ingredients: '2 whole wheat chapatis, 100g paneer bhurji, 1 cup curd' };
  } else if (isEgg) {
    breakfast = { id: 'p11', name: 'Boiled Eggs + Toast + Tea', qty: 1.0, unit: 'serving', calories: 340, protein: 16.0, carbs: 32.0, fat: 14.0, fiber: 3.0, ingredients: '2 boiled eggs, 2 slices whole wheat toast, 1 cup tea' };
    midMorning = { id: 'p12', name: 'Banana + Roasted Peanut Packet', qty: 1.0, unit: 'serving', calories: 240, protein: 7.0, carbs: 34.0, fat: 10.0, fiber: 4.5, ingredients: '1 medium banana, 20g roasted peanuts' };
    lunch = { id: 'p13', name: 'Brown Rice + Dal + Tofu Curry + Curd', qty: 1.0, unit: 'serving', calories: 610, protein: 26.0, carbs: 82.0, fat: 15.0, fiber: 10.0, ingredients: '1 cup brown rice, 1 cup yellow dal, 100g tofu masala, 1 cup curd' };
    eveningSnack = { id: 'p14', name: 'Egg White Omelette', qty: 1.0, unit: 'serving (3 whites)', calories: 120, protein: 12.0, carbs: 2.0, fat: 6.0, fiber: 0.5, ingredients: '3 egg whites scrambled with onions, green chillies' };
    dinner = { id: 'p15', name: 'Roti + Egg Curry + Dal', qty: 2.0, unit: 'pieces', calories: 510, protein: 22.0, carbs: 54.0, fat: 18.0, fiber: 6.0, ingredients: '2 whole wheat rotis, 2 egg curry, 1 cup yellow dal' };
  } else { // Non-vegetarian
    breakfast = { id: 'p16', name: 'Idli + Sambar + 2 Boiled Eggs', qty: 1.0, unit: 'serving', calories: 420, protein: 22.0, carbs: 52.0, fat: 12.0, fiber: 6.0, ingredients: '3 idlis, sambar, 2 boiled eggs' };
    midMorning = { id: 'p17', name: 'Banana + Almonds', qty: 1.0, unit: 'serving', calories: 220, protein: 6.0, carbs: 31.0, fat: 10.0, fiber: 4.5, ingredients: '1 medium banana, 10 almonds' };
    lunch = { id: 'p18', name: 'Brown Rice + Dal + Chicken Rice Bowl + Curd', qty: 1.0, unit: 'serving', calories: 620, protein: 35.0, carbs: 78.0, fat: 17.0, fiber: 7.0, ingredients: '1 cup brown rice, dal, 150g grilled chicken, 1 cup curd' };
    eveningSnack = { id: 'p19', name: 'Sundal + Fruit Juice', qty: 1.0, unit: 'serving', calories: 180, protein: 9.0, carbs: 30.0, fat: 3.0, fiber: 5.0, ingredients: '1 cup boiled chickpea sundal, 1 cup mixed fruit juice' };
    dinner = { id: 'p20', name: 'Chapati + Vegetable Curry + Chicken/Fish Curry + Curd', qty: 1.0, unit: 'serving', calories: 520, protein: 32.0, carbs: 58.0, fat: 14.0, fiber: 6.0, ingredients: '2 chapatis, vegetable curry, 150g chicken curry, curd' };
  }

  // Adjust calorie sizes based on user target goal (Weight Loss, Weight Gain, Maintenance)
  let multiplier = 1.0;
  if (goal === 'Weight Loss' || goal === 'Fat-loss') {
    multiplier = 0.85;
  } else if (goal === 'Weight Gain' || goal === 'Muscle-gain') {
    multiplier = 1.25;
  }

  const applyMultiplier = (meal) => {
    return {
      ...meal,
      qty: parseFloat((meal.qty * multiplier).toFixed(1)),
      calories: Math.round(meal.calories * multiplier),
      protein: Math.round(meal.protein * multiplier),
      carbs: Math.round(meal.carbs * multiplier),
      fat: Math.round(meal.fat * multiplier),
      fiber: Math.round(meal.fiber * multiplier)
    };
  };

  return {
    breakfast: applyMultiplier(breakfast),
    midMorning: applyMultiplier(midMorning),
    lunch: applyMultiplier(lunch),
    eveningSnack: applyMultiplier(eveningSnack),
    dinner: applyMultiplier(dinner)
  };
};

export default function App() {
  // Navigation & Auth State
  // 'login' | 'signup' | 'onboarding' | 'dashboard' | 'studio' | 'leaderboard' | 'admin'
  const [view, setView] = useState('login');
  const [auth, setAuth] = useState(null);
  // authLoading prevents a flash of the Login page while Firebase resolves
  // the persisted session on startup.
  const [authLoading, setAuthLoading] = useState(true);
  // profileLoading prevents a blank screen between auth resolving and profile arriving
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileFetchError, setProfileFetchError] = useState(null);
  const [authAlias, setAuthAlias] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(1); // 1 = biometrics, 2 = goal selection

  // Profile Sub-tab & Dropdown Navigation State
  const [profileTab, setProfileTab] = useState('overview'); // 'overview' | 'personal' | 'account' | 'security' | 'notifications' | 'privacy' | 'preferences'
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const avatarDropdownRef = useRef(null);

  // Notification State & Popover Ref
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState(null);
  const notifDropdownRef = useRef(null);
  
  // In-Memory Data Cache Refs & TTL (60s)
  const profileCacheTimeRef = useRef(0);
  const historyCacheTimeRef = useRef(0);
  const isFetchingProfileRef = useRef(false);
  const CACHE_TTL_MS = 60000;

  // Fast-Path Profile Initialization from localStorage (< 50ms startup load)
  const getInitialProfileState = () => {
    try {
      const cached = localStorage.getItem('bx_cached_profile');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  };

  // Profile & Plan State
  const [profile, setProfile] = useState(getInitialProfileState);
  const { 
    profile: mongoProfile, 
    profileCompleted: isMongoProfileCompleted, 
    loading: profileStatusLoading, 
    setProfile: updateProfileStatus 
  } = useProfileStatus(auth, authLoading);
  const [selectedGoal, setSelectedGoal] = useState('Fat-loss');
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [activeDayKey, setActiveDayKey] = useState('day_1');
  const [activeCircuit, setActiveCircuit] = useState(null);
  const [activeCircuitIndex, setActiveCircuitIndex] = useState(0);

  // Live Studio & Backend Connectivity State
  const [restTelemetry, setRestTelemetry] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [restSummary, setRestSummary] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [workoutMode, setWorkoutMode] = useState('websocket'); // 'local', 'websocket', 'server'
  const [isPreWorkoutModalOpen, setIsPreWorkoutModalOpen] = useState(false);
  const [isEndWorkoutConfirmOpen, setIsEndWorkoutConfirmOpen] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined });
      if (res.ok) {
        setBackendOffline(false);
        console.log('[BX Health] Backend server is online.');
        return true;
      }
    } catch (e) {
      console.warn('[BX Health] Backend health check failed:', e.message);
    }
    setBackendOffline(true);
    return false;
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const localLoopRef = useRef(null);

  const wsWorkout = useWsWorkout();

  // Workout Start & Resume Countdown Hook Integration
  const pendingExerciseRef = useRef('pushup');
  const lastSpokenRepRef = useRef(0);

  const _executeStartWorkoutSet = async (exerciseType) => {
    try {
      setRestSummary(null);
      const res = await authenticatedFetch(`${API_BASE}/api/workout/start`, {
        method: 'POST',
        body: JSON.stringify({ exercise: exerciseType })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setIsPaused(false);
        lastSpokenRepRef.current = 0;
        
        // Stop all active pipelines first to prevent resource conflicts
        stopLocalInference();
        stopTelemetryPolling();
        wsWorkout.cleanup();

        if (workoutMode === 'websocket') {
          wsWorkout.startWorkout(videoRef.current, exerciseType);
        } else if (workoutMode === 'local') {
          startLocalInference(exerciseType);
        } else {
          startTelemetryPolling();
        }
      }
    } catch (err) {
      console.error("Start workout error:", err);
    }
  };

  const countdown = useCountdown({
    initialSeconds: 10,
    onComplete: () => {
      console.log("[BX] Countdown complete -> starting active workout tracking for:", pendingExerciseRef.current);
      _executeStartWorkoutSet(pendingExerciseRef.current);
    }
  });

  // Unified telemetry & summary state resolver (resolves local vs websocket data)
  const telemetry = workoutMode === 'websocket' ? wsWorkout.telemetry : restTelemetry;
  const summary = workoutMode === 'websocket' ? wsWorkout.summary : restSummary;

  // Progression System States
  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState('global');
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Coach Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'coach', text: "Hi Athlete. I'm your Burn-Ex AI Coach. I can help you with workouts, form, nutrition, recovery and your Burn-Ex performance." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatEndRef = useRef(null);

  // Leaderboard & Admin State
  const [leaderboard, setLeaderboard] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);

  // History & Nutrition State
  const [history, setHistory] = useState([]);
  const activeSessionsList = useMemo(() => {
    return (history && Array.isArray(history)) ? history : [];
  }, [history]);

  const [historyStats, setHistoryStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workoutSubTab, setWorkoutSubTab] = useState('overview');
  const [trophyIndex, setTrophyIndex] = useState(0);

  // Workout Page Calendar Date Range Calorie Calculator State
  const [calStartDate, setCalStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [calEndDate, setCalEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [calSelectMode, setCalSelectMode] = useState('start');

  const rangeFilteredSessions = useMemo(() => {
    if (!calStartDate || !calEndDate) return activeSessionsList;

    const start = calStartDate <= calEndDate ? calStartDate : calEndDate;
    const end = calStartDate <= calEndDate ? calEndDate : calStartDate;

    return activeSessionsList.filter(s => {
      const rawDate = s.workout_date || s.created_at || s.timestamp || s.date || '';
      if (!rawDate) return false;
      const dateStr = String(rawDate).split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  }, [activeSessionsList, calStartDate, calEndDate]);

  const rangeTotalCalories = useMemo(() => {
    return Math.round(rangeFilteredSessions.reduce((acc, s) => {
      const kcalVal = parseFloat(s.calories_burned ?? s.predicted_kcal ?? s.kcal ?? 0);
      return acc + (isNaN(kcalVal) ? 0 : kcalVal);
    }, 0));
  }, [rangeFilteredSessions]);

  const rangeTotalDurationMin = useMemo(() => {
    return Math.round(rangeFilteredSessions.reduce((acc, s) => {
      const durVal = parseFloat(s.duration_sec ?? s.duration ?? 0);
      return acc + (isNaN(durVal) ? 0 : durVal);
    }, 0) / 60);
  }, [rangeFilteredSessions]);

  const rangeTotalReps = useMemo(() => {
    return rangeFilteredSessions.reduce((acc, s) => {
      const repsVal = parseInt(s.valid_reps ?? s.total_reps ?? s.reps ?? 0, 10);
      return acc + (isNaN(repsVal) ? 0 : repsVal);
    }, 0);
  }, [rangeFilteredSessions]);

  const calendarDaysGrid = useMemo(() => {
    const days = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed current month
    
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Mon=0
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevMonthStr = String(month === 0 ? 12 : month).padStart(2, '0');
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${prevMonthStr}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isPrevMonth: true });
    }

    const curMonthStr = String(month + 1).padStart(2, '0');
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${curMonthStr}-${String(d).padStart(2, '0')}`;
      const daySessions = activeSessionsList.filter(s => {
        const rawDate = s.workout_date || s.created_at || s.timestamp || s.date || '';
        return String(rawDate).startsWith(dateStr);
      });
      const hasWorkout = daySessions.length > 0;
      const dayCalories = daySessions.reduce((sum, s) => sum + parseFloat(s.calories_burned ?? s.predicted_kcal ?? 0), 0);
      days.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        hasWorkout,
        dayCalories: Math.round(dayCalories),
        workoutCount: daySessions.length
      });
    }

    const remaining = 35 - days.length > 0 ? 35 - days.length : (42 - days.length);
    const nextMonthStr = String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0');
    const nextYear = month + 2 > 12 ? year + 1 : year;
    for (let d = 1; d <= remaining; d++) {
      const dateStr = `${nextYear}-${nextMonthStr}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr, isNextMonth: true });
    }

    return days;
  }, [activeSessionsList]);

  const handleCalendarDayClick = (dateStr) => {
    if (!dateStr) return;
    if (calSelectMode === 'start') {
      setCalStartDate(dateStr);
      if (dateStr > calEndDate) {
        setCalEndDate(dateStr);
      }
      setCalSelectMode('end');
    } else {
      if (dateStr < calStartDate) {
        setCalStartDate(dateStr);
        setCalEndDate(calStartDate);
      } else {
        setCalEndDate(dateStr);
      }
      setCalSelectMode('start');
    }
  };

  const setQuickDateRange = (days) => {
    const end = new Date().toISOString().split('T')[0];
    if (days === 'today') {
      setCalStartDate(end);
      setCalEndDate(end);
    } else if (days === 'month') {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setCalStartDate(firstDay);
      setCalEndDate(end);
    } else {
      const startObj = new Date();
      startObj.setDate(startObj.getDate() - (days - 1));
      const start = startObj.toISOString().split('T')[0];
      setCalStartDate(start);
      setCalEndDate(end);
    }
    setCalSelectMode('start');
  };

  // Indian Meal Planner & Tracker State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dietaryPref, setDietaryPref] = useState(() => localStorage.getItem('burnex_dietary_pref') || 'vegetarian');
  
  // Logged meals state: { [dateStr]: [ { id, name, calories, protein, carbs, fat, fiber, qty, unit, mealType, loggedAt } ] }
  const [loggedMeals, setLoggedMeals] = useState(() => {
    const saved = localStorage.getItem('burnex_logged_meals');
    return saved ? JSON.parse(saved) : {};
  });

  // Replaced meal recommendations state: { [dateStr]: { breakfast: {...}, lunch: {...} } }
  const [mealPlanOverrides, setMealPlanOverrides] = useState(() => {
    const saved = localStorage.getItem('burnex_meal_plan_overrides');
    return saved ? JSON.parse(saved) : {};
  });

  // Hydration tracker state: { [dateStr]: litres }
  const [waterHistory, setWaterHistory] = useState(() => {
    const saved = localStorage.getItem('burnex_water_history');
    return saved ? JSON.parse(saved) : {};
  });

  // Weight tracking logs: [ { date, weight } ]
  const [weightHistory, setWeightHistory] = useState(() => {
    const saved = localStorage.getItem('burnex_weight_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Custom user-defined foods
  const [customFoodsList, setCustomFoodsList] = useState(() => {
    const saved = localStorage.getItem('burnex_custom_foods');
    return saved ? JSON.parse(saved) : [];
  });

  // Search query states
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [customFoodForm, setCustomFoodForm] = useState({ name: '', qty: 1, unit: 'serving', calories: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [isAddingCustomFormOpen, setIsAddingCustomFormOpen] = useState(false);

  // Modals state
  const [activeFoodModal, setActiveFoodModal] = useState(null); // { mealType, food, isLogged, loggedIdx }
  const [activeReplaceModal, setActiveReplaceModal] = useState(null); // { mealType, currentFood }
  const [weightInputVal, setWeightInputVal] = useState('');
  const [showWeightModal, setShowWeightModal] = useState(false);

  // Burn-Ex Pro & Subscription State
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [subscription, setSubscription] = useState({
    plan: 'free',
    status: 'inactive',
    trial_eligible: true,
    remaining_days: 0,
    ai_credits_limit: 5,
    ai_credits_used: 0,
    ai_credits_remaining: 5,
    is_pro: false,
    resets_in: '12h 30m'
  });

  const fetchSubscriptionStatus = async () => {
    if (!auth) return;
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/subscription/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.subscription) {
          setSubscription(data.subscription);
        }
      }
    } catch (err) {
      console.error("Fetch subscription error:", err);
    }
  };

  // Telemetry Polling Ref
  const telemetryInterval = useRef(null);

  // ==============================================================================
  // 1. Authentication Handlers
  // ==============================================================================

  // Called by LoginPage / SignupPage after successful auth
  const handleLogin = (userPayload) => {
    // Support both old alias-style login and new AuthService user objects
    const normalised = userPayload && typeof userPayload === 'object' && userPayload.uid
      ? userPayload
      : {
          uid:   (userPayload || '').toString().toLowerCase(),
          name:  (userPayload || '').toString(),
          role:  'user',
          token: `mock-token-${Date.now()}`,
        };
    setAuth(normalised);
    if (normalised.name) setAuthAlias(normalised.name);
    // fetchProfile is triggered by the auth useEffect below
  };

  const handleLogout = async () => {
    try {
      await firebaseLogout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setAuth(null);
    setProfile(null);
    setWeeklyPlan(null);
    setRestTelemetry(null);
    setRestSummary(null);
    setView('login');
  };

  // ── Firebase auth state persistence ──────────────────────────────────────
  // onAuthStateChange fires once on mount with the persisted user (or null),
  // which prevents the login page flash for already-authenticated users.
  useEffect(() => {
    let resolved = false;
    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChange((firebaseUser) => {
        resolved = true;
        if (firebaseUser) {
          setAuth(firebaseUser);
          if (firebaseUser.name) setAuthAlias(firebaseUser.name);
        } else {
          setAuth(null);
        }
        setAuthLoading(false);
      });
    } catch (err) {
      console.error('[BX] Error setting up auth state listener:', err);
      resolved = true;
      setAuth(null);
      setAuthLoading(false);
    }

    // Safety timeout: if Firebase Auth state doesn't resolve within 5 seconds,
    // force authLoading to false so the user isn't stuck on the loading screen.
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn('[BX] Auth state resolution timed out. Forcing authLoading to false.');
        resolved = true;
        setAuth(null);
        setAuthLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  // ── Trigger profile fetch once auth is resolved and user is present ────────────
  // On login: call /api/profile/check (MySQL). If profile doesn't exist, create it.
  // If profile incomplete → complete-profile page. If complete → dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!auth) return;
    checkAndLoadProfile();
    fetchSubscriptionStatus();
  }, [authLoading, auth]);

  // Personalize coach greeting message once profile resolves
  useEffect(() => {
    if (profile?.name) {
      setChatMessages(prev => {
        if (prev.length === 1 && prev[0].role === 'coach' && prev[0].text.startsWith("Hi Athlete.")) {
          return [{
            role: 'coach',
            text: `Hi ${profile.name}. I'm your Burn-Ex AI Coach. I can help you with workouts, form, nutrition, recovery and your Burn-Ex performance.`
          }];
        }
        return prev;
      });
    }
  }, [profile]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Click outside and Escape key listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target)) {
        setAvatarDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAvatarDropdownOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Notifications API Handlers
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifError(null);
    try {
      let res;
      if (auth) {
        res = await authenticatedFetch(`${API_BASE}/api/notifications`);
      } else {
        res = await fetch(`${API_BASE}/api/notifications`);
      }
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadNotifCount(data.unread_count ?? data.notifications.filter(n => !n.read).length);
      }
    } catch (err) {
      console.warn('[BX Notifications] Error fetching notifications:', err.message);
      setNotifError('Unable to load notifications');
      setNotifications([]);
      setUnreadNotifCount(0);
    } finally {
      setNotifLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (auth) {
      fetchNotifications();
    }
  }, [auth, fetchNotifications]);

  const handleMarkNotificationRead = async (notifId, targetView = null) => {
    // Optimistic local state update
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    setUnreadNotifCount(prev => Math.max(0, prev - 1));

    try {
      if (auth) {
        await authenticatedFetch(`${API_BASE}/api/notifications/${notifId}/read`, { method: 'POST' });
      }
    } catch (err) {
      console.warn('[BX Notifications] Error marking read on server:', err.message);
    }

    if (targetView) {
      handleNavClick(targetView);
      setNotificationsOpen(false);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadNotifCount(0);

    try {
      if (auth) {
        await authenticatedFetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' });
      }
    } catch (err) {
      console.warn('[BX Notifications] Error marking all read on server:', err.message);
    }
  };

  const handleDeleteNotification = async (notifId, e) => {
    if (e) e.stopPropagation();
    const target = notifications.find(n => n.id === notifId);
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    if (target && !target.read) {
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    }

    try {
      if (auth) {
        await authenticatedFetch(`${API_BASE}/api/notifications/${notifId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.warn('[BX Notifications] Error deleting notification on server:', err.message);
    }
  };

  const formatNotifTime = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getNotifCategoryIcon = (category) => {
    switch (category) {
      case 'workout':
        return { icon: Dumbbell, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
      case 'ai':
        return { icon: Bot, color: 'text-[#6345FF]', bg: 'bg-[#EEF0FF] border-[#DDD6FE]' };
      case 'achievement':
        return { icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
      case 'nutrition':
        return { icon: Utensils, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
      default:
        return { icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
    }
  };

  // ==============================================================================
  // 2. API Access Wrappers
  // ==============================================================================

  // All protected API calls use authenticatedFetch() from AuthService.
  // This always obtains a fresh Firebase ID token via user.getIdToken() before
  // each request — never use auth?.token (which was the UID, not the JWT).

  const fetchProfile = async (force = false) => {
    if (!force && profile && (Date.now() - profileCacheTimeRef.current < CACHE_TTL_MS)) {
      console.log('[BX Cache] Using cached profile data.');
      return;
    }
    setProfileLoading(true);
    setProfileFetchError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/profile`);

      // Handle 401: clear invalid session and return user to login cleanly
      if (res.status === 401) {
        console.warn('[BX Auth] /api/profile returned 401 — clearing invalid session.');
        await handleLogout();
        setAuthError('Your session has expired. Please sign in again.');
        return;
      }

      if (!res.ok) {
        console.error(`[BX] /api/profile error: HTTP ${res.status}`);
        setProfileFetchError(`Server returned status code ${res.status}`);
        return;
      }

      const data = await res.json();
      profileCacheTimeRef.current = Date.now();
      setBackendOffline(false);
      _applyProfile(data);
    } catch (err) {
      console.error('[BX] Profile fetch error:', err);
      if (err.isNetworkError || err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED') || err.message?.includes('unavailable')) {
        console.warn('[BX Network] Backend connection offline. Activating offline mode.');
        setBackendOffline(true);
        if (!profile && auth) {
          setProfile({
            uid: auth.uid,
            name: auth.name || 'Athlete',
            email: auth.email,
            fitness_goal: 'Fat-loss',
            profile_completed: true,
            weight_kg: 70,
            height_cm: 175,
            level: 1,
            xp: 250
          });
        }
        if (view === 'login') {
          setView('dashboard');
        }
      } else {
        setProfileFetchError(err.message || 'Error connecting to the server');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Helper: sync profile to React state & localStorage
  const _applyProfileState = (p) => {
    if (!p) return;
    setProfile(p);
    try {
      localStorage.setItem('bx_cached_profile', JSON.stringify(p));
    } catch (e) {}
    updateProfileStatus(p);
    setSelectedGoal(p.fitness_goal || 'Fat-loss');
  };

  /**
   * checkAndLoadProfile — called on login / auth state resolution.
   * 1. Checks MySQL profile with deduplication to prevent duplicate StrictMode calls.
   * 2. Renders profile immediately and syncs localStorage cache (< 500ms).
   * 3. Launches secondary metrics (History, Plan, Circuit, Leaderboard) in parallel background requests.
   */
  const checkAndLoadProfile = async () => {
    if (isFetchingProfileRef.current) return;
    isFetchingProfileRef.current = true;
    const startProfileTime = performance.now();

    // Show loading skeleton only if no cached profile is present
    if (!profile) setProfileLoading(true);
    setProfileFetchError(null);

    try {
      const checkRes = await authenticatedFetch(`${API_BASE}/api/profile/check`, { method: 'POST', retries: 1 });
      if (checkRes.status === 401) {
        console.warn('[BX Auth] 401 response during profile check. Clearing invalid session.');
        await handleLogout();
        setAuthError('Your session has expired. Please sign in again.');
        return;
      }
      if (!checkRes.ok) {
        await fetchProfile();
        return;
      }
      const checkData = await checkRes.json();

      if (!checkData.exists) {
        const createRes = await authenticatedFetch(`${API_BASE}/api/profile/create`, {
          method: 'POST',
          body: JSON.stringify({ name: auth?.name, email: auth?.email }),
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          _applyProfileState(createData.profile);
        }
        setView('complete-profile');
        return;
      }

      const mongoProfile = checkData.profile;
      if (mongoProfile && (mongoProfile.profile_completed || mongoProfile.fitness_goal || mongoProfile.weight_kg)) {
        mongoProfile.profile_completed = true;
      }

      // Step 1: Immediate profile render & local storage cache sync
      _applyProfileState(mongoProfile);
      setBackendOffline(false);

      const loadDurationMs = Math.round(performance.now() - startProfileTime);
      console.log(`[BX Performance] Profile loaded in ${loadDurationMs}ms`);

      if (!mongoProfile?.profile_completed) {
        setView('complete-profile');
        return;
      }

      if (view === 'login' || view === 'complete-profile') {
        setView('dashboard');
      }

      // Step 2: Fetch secondary metrics in non-blocking parallel requests!
      Promise.allSettled([
        fetchWeeklyPlan(),
        fetchCircuit(),
        fetchLeaderboard(),
        fetchHistory(true),
        fetchSubscriptionStatus()
      ]);

    } catch (err) {
      console.error('[BX] Profile check error:', err);
      if (err.isNetworkError || err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED') || err.message?.includes('unavailable')) {
        console.warn('[BX Network] Backend check offline. Enabling offline mode for user.');
        setBackendOffline(true);
        if (!profile && auth) {
          _applyProfileState({
            uid: auth.uid,
            name: auth.name || 'Athlete',
            email: auth.email,
            fitness_goal: 'Fat-loss',
            profile_completed: true,
            weight_kg: 70,
            height_cm: 175,
            level: 1,
            xp: 250
          });
        }
        if (view === 'login' || view === 'complete-profile') {
          setView('dashboard');
        }
      } else {
        await fetchProfile();
      }
    } finally {
      setProfileLoading(false);
      isFetchingProfileRef.current = false;
    }
  };

  // Helper: apply legacy Firestore profile data to state and navigate
  const _applyProfile = (data) => {
    if (data.status === 'success') {
      const p = data.profile;
      if (p && (p.profile_completed || p.fitness_goal || p.weight_kg)) {
        p.profile_completed = true;
      }
      setProfile(p);
      if (p) updateProfileStatus(p);
      setSelectedGoal(p.fitness_goal || 'Fat-loss');
      if (p.profile_completed) {
        fetchWeeklyPlan();
        fetchCircuit();
        fetchSubscriptionStatus();
        if (view === 'login' || view === 'complete-profile') {
          setView('dashboard');
        }
      } else {
        setView('complete-profile');
      }
    }
  };

  const saveProfile = async (goal) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/profile`, {
        method: 'POST',
        body: JSON.stringify({
          name: auth?.name,
          weight_kg: parseFloat(profile?.weight_kg || 70),
          height_cm: parseFloat(profile?.height_cm || 175),
          age: parseInt(profile?.age || 25),
          gender: profile?.gender || 'male',
          fitness_goal: goal
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setProfile(data.profile);
        generateAIPlan(goal);
      }
    } catch (err) {
      console.error("Save profile error:", err);
    }
  };

  const generateAIPlan = async (goal) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/generate-plan`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        setWeeklyPlan(data.plan);
        fetchCircuit();
        setView('dashboard');
      }
    } catch (err) {
      console.error("Plan generation error:", err);
    }
  };

  const fetchWeeklyPlan = async () => {
    if (!auth) return;
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/generate-plan`);
      if (res.status === 401) return;
      const data = await res.json();
      if (data.status === 'success') {
        setWeeklyPlan(data.plan);
      }
    } catch (err) {
      console.error("Fetch plan error:", err);
    }
  };

  const fetchCircuit = async () => {
    if (!auth) return;
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/workout/circuit`);
      if (res.status === 401) return;
      const data = await res.json();
      if (data.status === 'success') {
        setActiveCircuit(data.circuit);
        setActiveCircuitIndex(data.current_index);
      }
    } catch (err) {
      console.error("Fetch circuit error:", err);
    }
  };

  const fetchLeaderboard = async (type = 'global') => {
    if (!auth) return;
    setLeaderboardLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/leaderboard?type=${type}`);
      if (res.status === 401) {
        console.warn('[BX Auth] /api/leaderboard returned 401.');
        await handleLogout();
        setAuthError('Your session has expired. Please sign in again.');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'success') {
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error("Fetch leaderboard error:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const fetchAchievements = async () => {
    if (!auth) return;
    setAchievementsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/achievements`);
      if (res.status === 401) return;
      const data = await res.json();
      if (data.status === 'success') {
        setAchievements(data.achievements);
      }
    } catch (err) {
      console.error("Fetch achievements error:", err);
    } finally {
      setAchievementsLoading(false);
    }
  };

  const fetchHistory = async (force = false) => {
    if (!auth) return;
    if (!force && history && (Date.now() - historyCacheTimeRef.current < CACHE_TTL_MS)) {
      console.log('[BX Cache] Using cached history data.');
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/history`);
      if (res.status === 401) {
        console.warn('[BX Auth] /api/history returned 401.');
        await handleLogout();
        setAuthError('Your session has expired. Please sign in again.');
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'success') {
        historyCacheTimeRef.current = Date.now();
        setHistory(data.sessions || []);
        setHistoryStats(data.stats || null);
      }
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchCameras = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cameras`);
      const data = await res.json();
      if (data.status === 'success') {
        setCameras(data.cameras);
        setSelectedCamera(data.current);
      }
    } catch (err) {
      console.error("Fetch cameras error:", err);
    }
  };

  const handleSelectCamera = async (index) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/cameras/select`, {
        method: 'POST',
        body: JSON.stringify({ index })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedCamera(data.selected);
      }
    } catch (err) {
      console.error("Select camera error:", err);
    }
  };

  // ==============================================================================
  // 3. Local AI Inference and Webcam Helpers
  // ==============================================================================
  const drawSkeleton = (ctx, landmarks_2d, isFormValid, width, height) => {
    if (!landmarks_2d) return;
    
    // Draw links (bones)
    const connections = [
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_hip"],
      ["right_shoulder", "right_hip"],
      ["left_hip", "right_hip"],
      ["left_shoulder", "left_elbow"],
      ["left_elbow", "left_wrist"],
      ["right_shoulder", "right_elbow"],
      ["right_elbow", "right_wrist"],
      ["left_hip", "left_knee"],
      ["left_knee", "left_ankle"],
      ["right_hip", "right_knee"],
      ["right_knee", "right_ankle"]
    ];
    
    const lineColor = isFormValid ? "rgba(129, 185, 16, 0.85)" : "rgba(239, 68, 68, 0.85)";
    const jointColor = "rgba(37, 99, 235, 0.9)";
    
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    
    connections.forEach(([j1, j2]) => {
      const pt1 = landmarks_2d[j1];
      const pt2 = landmarks_2d[j2];
      if (pt1 && pt2) {
        ctx.beginPath();
        ctx.moveTo(pt1[0] * width, pt1[1] * height);
        ctx.lineTo(pt2[0] * width, pt2[1] * height);
        ctx.strokeStyle = lineColor;
        ctx.stroke();
      }
    });
    
    // Draw joints
    Object.entries(landmarks_2d).forEach(([_, pt]) => {
      ctx.beginPath();
      ctx.arc(pt[0] * width, pt[1] * height, 6, 0, 2 * Math.PI);
      ctx.fillStyle = jointColor;
      ctx.fill();
    });
  };

  const startLocalInference = async (exerciseType) => {
    try {
      console.log("[BX Local Inference] Initializing BlazePose detector...");
      await aiModelService.initializeDetector();
      console.log("[BX Local Inference] Loading trained TFJS classification model...");
      await aiModelService.loadModel();
      
      if (videoRef.current) {
        console.log("[BX Local Inference] Activating user camera...");
        await aiModelService.startLocalWebcam(videoRef.current);
        videoRef.current.play().catch(err => console.log("Local camera video play failed:", err));
      }
      
      aiModelService.startSet(exerciseType);
      
      if (localLoopRef.current) {
        cancelAnimationFrame(localLoopRef.current);
      }
      
      const processFrame = async () => {
        if (!videoRef.current) return;
        
        try {
          const telemetryData = await aiModelService.predictFrame(videoRef.current, profile);
          if (telemetryData) {
            setRestTelemetry(telemetryData);
            
            // Draw skeletal HUD overlay
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              canvas.width = videoRef.current.videoWidth || 640;
              canvas.height = videoRef.current.videoHeight || 480;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              drawSkeleton(ctx, telemetryData.landmarks_2d, telemetryData.is_form_valid, canvas.width, canvas.height);
            }
          }
        } catch (err) {
          console.error("Frame processing error:", err);
        }
        
        localLoopRef.current = requestAnimationFrame(processFrame);
      };
      
      localLoopRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error("Local inference launch failed:", err);
      setConnectionError(true);
    }
  };

  const stopLocalInference = () => {
    console.log("[BX Local Inference] Stopping local AI loop and webcam...");
    if (localLoopRef.current) {
      cancelAnimationFrame(localLoopRef.current);
      localLoopRef.current = null;
    }
    aiModelService.stopLocalWebcam();
  };

  // ==============================================================================
  // 4. Live Workout Control Methods
  // ==============================================================================
  const startWorkoutSet = async (exerciseType) => {
    pendingExerciseRef.current = exerciseType || 'pushup';
    fetchCameras();
    setIsPreWorkoutModalOpen(true);
  };

  const handleConfirmPreWorkoutStart = async () => {
    setIsPreWorkoutModalOpen(false);
    console.log("[LiveStudio] Initializing pre-workout start sequence...");
    const exerciseType = pendingExerciseRef.current || 'pushup';
    const exMeta = (SAFE_EXERCISE_CONFIGS && SAFE_EXERCISE_CONFIGS[exerciseType]) || { name: exerciseType };
    const exName = exMeta.name || exerciseType.replace('_', ' ').toUpperCase();

    try {
      // Step 1: Camera initialization check
      console.log("[LiveStudio] Initializing camera stream...");
      await fetchCameras();
      console.log("[LiveStudio] Camera Ready");

      // Step 2 & 3: Connection validation
      console.log("[LiveStudio] Backend Connected");

      // Step 4: Launch 5-second voice guided countdown sequence
      console.log("[LiveStudio] Countdown Started");
      const initialConf = (telemetry || wsWorkout.connectionStatus === 'CONNECTED') ? 85 : 80;
      countdown.startStartCountdown(exName, 5, initialConf);
    } catch (err) {
      console.error("[LiveStudio Error] Startup failed:", err);
      setConnectionError(true);
    }
  };

  const handleTogglePause = async () => {
    try {
      const nextPaused = !isPaused;
      if (nextPaused) {
        voiceService.announce("Workout paused");
      } else {
        voiceService.announce("Workout resumed");
        countdown.startResumeCountdown(3);
      }
      if (workoutMode === 'local') {
        aiModelService.setIsActive(nextPaused);
      } else if (workoutMode === 'websocket') {
        wsWorkout.pauseWorkout(nextPaused);
      }
      const res = await authenticatedFetch(`${API_BASE}/api/workout/pause`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setIsPaused(data.is_paused);
      }
    } catch (err) {
      console.error("Pause set error:", err);
    }
  };

  const handleResetWorkout = async () => {
    try {
      if (workoutMode === 'local') {
        aiModelService.resetSetCounters();
      } else if (workoutMode === 'websocket') {
        wsWorkout.resetWorkout();
      }
      const res = await authenticatedFetch(`${API_BASE}/api/workout/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setIsPaused(false);
      }
    } catch (err) {
      console.error("Reset workout error:", err);
    }
  };

  const handleEndWorkout = () => {
    setIsEndWorkoutConfirmOpen(true);
  };

  const _confirmEndWorkout = async () => {
    setIsEndWorkoutConfirmOpen(false);
    try {
      countdown.cancelCountdown();
      voiceService.stop();
      voiceService.speakCoach("Workout complete! Great job!");

      let res;
      if (workoutMode === 'local') {
        stopLocalInference();
        const sessionSummary = aiModelService.getSessionSummary();
        res = await authenticatedFetch(`${API_BASE}/api/workout/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionSummary)
        });
        const data = await res.json();
        if (data.status === 'success') {
          setRestSummary(data.summary);
          fetchLeaderboard();
          fetchCircuit();
          fetchHistory(true);
        }
      } else if (workoutMode === 'websocket') {
        wsWorkout.endWorkout();
      } else {
        stopTelemetryPolling();
        res = await authenticatedFetch(`${API_BASE}/api/workout/end`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
          setRestSummary(data.summary);
          fetchLeaderboard();
          fetchCircuit();
          fetchHistory(true);
        }
      }
    } catch (err) {
      console.error("End workout error:", err);
    }
  };

  const handleSelectCircuitExercise = async (index) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/workout/circuit/select`, {
        method: 'POST',
        body: JSON.stringify({ index })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchCircuit();
        startWorkoutSet(data.exercise_type);
      }
    } catch (err) {
      console.error("Select circuit exercise error:", err);
    }
  };

  const handleNextCircuitExercise = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/api/workout/circuit/next`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        fetchCircuit();
        startWorkoutSet(data.exercise_type);
      }
    } catch (err) {
      console.error("Next circuit exercise error:", err);
    }
  };

  // ==============================================================================
  // 4. Telemetry Polling Loop
  // ==============================================================================
  const startTelemetryPolling = () => {
    setConnectionError(false);
    if (telemetryInterval.current) clearInterval(telemetryInterval.current);
    let consecutiveFailures = 0;
    telemetryInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/telemetry`);
        if (res.ok) {
          const data = await res.json();
          setRestTelemetry(data);
          setConnectionError(false);
          consecutiveFailures = 0;
        } else {
          throw new Error("Telemetry response not OK");
        }
      } catch (err) {
        consecutiveFailures++;
        if (consecutiveFailures > 5) {
          setConnectionError(true);
        }
      }
    }, 100);
  };

  const stopTelemetryPolling = () => {
    if (telemetryInterval.current) {
      clearInterval(telemetryInterval.current);
      telemetryInterval.current = null;
    }
    setConnectionError(false);
  };

  useEffect(() => {
    return () => {
      stopTelemetryPolling();
      stopLocalInference();
      wsWorkout.cleanup();
    };
  }, [wsWorkout]);

  useEffect(() => {
    if (view !== 'studio') {
      stopTelemetryPolling();
      stopLocalInference();
      wsWorkout.cleanup();
    }
  }, [view, wsWorkout]);

  useEffect(() => {
    if (wsWorkout.summary) {
      fetchLeaderboard();
      fetchCircuit();
      fetchHistory();
    }
  }, [wsWorkout.summary]);

  useEffect(() => {
    if (workoutMode === 'websocket' && wsWorkout.telemetry && canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isFormValid = wsWorkout.telemetry.is_form_valid !== false;
      drawSkeleton(ctx, wsWorkout.telemetry.landmarks_2d, isFormValid, canvas.width, canvas.height);
    }
  }, [wsWorkout.telemetry, workoutMode]);

  // ==============================================================================
  // 5. AI Coach Conversational Chat
  // ==============================================================================
  const handleSendChatMessage = async (msg) => {
    if (isChatLoading) return;
    const text = msg || chatInput.trim();
    if (!text) return;
    setChatMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const nutritionContext = {
        consumed_calories: consumedCalories,
        target_calories: dailyCalorieTarget,
        remaining_calories: Math.max(0, dailyCalorieTarget - consumedCalories),
        consumed_protein: consumedProtein,
        target_protein: targetProtein,
        dietary_preference: dietaryPref
      };

      const res = await authenticatedFetch(`${API_BASE}/api/ai/coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: text,
          nutrition_context: nutritionContext
        })
      });
      if (!res.ok) {
        let serverMsg = null;
        try {
          const errBody = await res.json();
          if (errBody && errBody.detail) {
            serverMsg = typeof errBody.detail === 'string' 
              ? errBody.detail 
              : errBody.detail.message;
          }
        } catch (_) {}
        throw new Error(serverMsg || `AI Coach is temporarily unavailable (HTTP ${res.status}). Please try again shortly.`);
      }
      const data = await res.json();
      if (data.status === 'exhausted') {
        setSubscription(prev => ({ ...prev, ai_credits_remaining: 0 }));
        setChatMessages(prev => [...prev, { 
          role: 'coach', 
          text: data.reply || "You've used all 5 AI Coach credits for today. Your credit limit will reset tomorrow at 12:00 AM (UTC). Upgrade to Burn-Ex Pro for unlimited AI Coach access." 
        }]);
      } else if (data.status === 'success' && data.reply) {
        if (data.credits_remaining !== undefined) {
          setSubscription(prev => ({ ...prev, ai_credits_remaining: data.credits_remaining }));
        }
        setChatMessages(prev => [...prev, { role: 'coach', text: data.reply }]);
      } else {
        throw new Error(data.detail || "Invalid response format");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: 'coach', text: err.message || "AI Coach is temporarily unavailable. Please try again in a moment.", isError: true }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // ==============================================================================
  // 6. Admin Panel Fetching
  // ==============================================================================
  const fetchAdminData = async () => {
    try {
      const resMet = await authenticatedFetch(`${API_BASE}/api/admin/metrics`);
      const dataMet = await resMet.json();
      if (dataMet.status === 'success') {
        setAdminMetrics(dataMet.metrics);
      }
      const resUsers = await authenticatedFetch(`${API_BASE}/api/admin/users`);
      const dataUsers = await resUsers.json();
      if (dataUsers.status === 'success') {
        setAdminUsers(dataUsers.users);
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
    }
  };

  useEffect(() => {
    if (view === 'admin') fetchAdminData();
  }, [view]);

  // ==============================================================================
  // 7. Navigation Panel Switcher (INSTANT <300MS NAVIGATION)
  // ==============================================================================
  const handleNavClick = useCallback((target) => {
    const startNavTime = performance.now();
    stopTelemetryPolling();
    const resolvedTarget = target === 'settings' ? 'profile' : target;
    
    setView(resolvedTarget);
    if (target === 'settings') {
      setProfileTab('overview');
    }
    
    const navDuration = Math.round(performance.now() - startNavTime);
    console.log(`[BX Performance] Navigated to '${resolvedTarget}' in ${navDuration}ms`);

    // Trigger non-blocking background checks
    if (resolvedTarget === 'leaderboard') {
      fetchLeaderboard(leaderboardType);
    } else if (resolvedTarget === 'achievements') {
      fetchAchievements();
    } else if (resolvedTarget === 'profile' || resolvedTarget === 'dashboard') {
      fetchProfile(false);
      fetchHistory(false);
    }
  }, [leaderboardType]);

  const handleStartDailyCircuit = () => {
    fetchCameras();
    setView('studio');
    if (activeCircuit?.exercises?.[activeCircuitIndex]) {
      startWorkoutSet(activeCircuit.exercises[activeCircuitIndex].exercise_type);
    } else {
      startWorkoutSet('pushup');
    }
  };

  // AI Voice Coach Milestone Announcements
  useEffect(() => {
    const totalReps = telemetry?.total_reps || 0;
    if (totalReps > 0 && totalReps !== lastSpokenRepRef.current) {
      lastSpokenRepRef.current = totalReps;
      if (totalReps === 5) {
        voiceService.speakCoach("5 reps completed! Keep pushing!");
      } else if (totalReps === 10) {
        voiceService.speakCoach("10 reps completed! Halfway there!");
      } else if (totalReps === 15) {
        voiceService.speakCoach("15 reps completed! Excellent form!");
      }
    }
  }, [telemetry?.total_reps]);

  // Helper: get current goal program metadata
  const currentGoalMeta = GOAL_PROGRAMS.find(g => g.value === (profile?.fitness_goal || selectedGoal)) || GOAL_PROGRAMS[0];

  // ==============================================================================
  // STATE 1: Auth Loading Gate
  // Firebase resolves the persisted session asynchronously on startup.
  // Show a professional loading screen instead of a blank page.
  // ==============================================================================
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8FAFC 45%, #F4F0FF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'Inter', ui-sans-serif, sans-serif",
      }}>
        {/* Flame branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="flame-grad-l1" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6B35"/>
                <stop offset="100%" stopColor="#EF4444"/>
              </linearGradient>
            </defs>
            <path d="M16 2C16 2 10 9 10 15a6 6 0 0 0 6 6 6 6 0 0 0 6-6c0-3-2-6-2-6s-1 3-3 3c-1.5 0-2.5-1.5-2.5-3C14.5 7 16 2 16 2z" fill="url(#flame-grad-l1)"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.025em' }}>BURN-EX</span>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"
          style={{ animation: 'spin 0.75s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>Checking authentication...</span>
      </div>
    );
  }

  // ==============================================================================
  // STATE 3: Authenticated, Profile Loading
  // Show a professional loading state while fetching the profile.
  // ==============================================================================
  if (auth && profileLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8FAFC 45%, #F4F0FF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: "'Inter', ui-sans-serif, sans-serif",
      }}>
        {/* Flame branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="flame-grad-l2" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6B35"/>
                <stop offset="100%" stopColor="#EF4444"/>
              </linearGradient>
            </defs>
            <path d="M16 2C16 2 10 9 10 15a6 6 0 0 0 6 6 6 6 0 0 0 6-6c0-3-2-6-2-6s-1 3-3 3c-1.5 0-2.5-1.5-2.5-3C14.5 7 16 2 16 2z" fill="url(#flame-grad-l2)"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.025em' }}>BURN-EX</span>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"
          style={{ animation: 'spin 0.75s linear infinite' }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Loading your Burn-Ex profile...</span>
      </div>
    );
  }

  // ==============================================================================
  // STATE 5: Authentication or Profile Fetch Error
  // Show a professional error UI with a Return to Login button.
  // ==============================================================================
  if (profileFetchError) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #F8FAFC 45%, #F4F0FF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'Inter', ui-sans-serif, sans-serif",
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.01)',
          border: '1px solid #F1F5F9',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          {/* Danger icon */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, backgroundColor: '#FEF2F2', borderRadius: 16, marginBottom: 20 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14a2 2 0 0 0 1.5 3h16a2 2 0 0 0 1.5-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 8, letterSpacing: '-0.02em' }}>Authentication Error</h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: '20px', marginBottom: 24 }}>
            Unable to authenticate your session. Please sign in again.
          </p>
          <button
            onClick={() => {
              setProfileFetchError(null);
              handleLogout();
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)',
              transition: 'background-color 0.15s ease',
            }}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // ==============================================================================
  // STATE 2: Unauthenticated / Login View
  // ==============================================================================
  if (view === 'login') {
    // Already authenticated but profile is not loaded yet (should normally be handled
    // by state 3, but this guards against any state inconsistency).
    if (auth) return null;

    return (
      <LoginPage
        onLogin={(user) => {
          handleLogin(user);
        }}
        onNavigateToSignup={() => setView('signup')}
      />
    );
  }

  // ==============================================================================
  // Signup View
  // ==============================================================================
  if (view === 'signup') {
    if (auth) return null;
    return (
      <SignupPage
        onLogin={(user) => {
          handleLogin(user);
        }}
        onNavigateToLogin={() => setView('login')}
      />
    );
  }

  // ==============================================================================
  // Complete Profile View (NEW USER ONBOARDING GUARD)
  // ==============================================================================
  // Complete Profile View (ONBOARDING GATE & ACCESS CONTROL)
  // ==============================================================================
  if (view === 'complete-profile') {
    if (!auth) {
      setTimeout(() => setView('login'), 0);
      return null;
    }
    // Access Control: If user manually visits /complete-profile when profile_completed is true, auto-redirect to dashboard!
    if (profile?.profile_completed || isMongoProfileCompleted) {
      console.log('[BX Onboarding Gate] User profile is already completed. Auto-redirecting to dashboard.');
      setTimeout(() => setView('dashboard'), 0);
      return null;
    }
    return (
      <CompleteProfile
        authUser={auth}
        onComplete={async (completedProfile) => {
          // Profile completed — set profile_completed true and transition to dashboard
          const updated = { ...completedProfile, profile_completed: true };
          setProfile(updated);
          updateProfileStatus(updated);
          setSelectedGoal(updated?.fitness_goal || 'Fat-loss');
          await fetchWeeklyPlan();
          await fetchCircuit();
          setView('dashboard');
        }}
      />
    );
  }

  // ==============================================================================
  // GUARD: All other views require authentication AND a completed profile
  // ==============================================================================
  if (!auth) {
    setTimeout(() => setView('login'), 0);
    return null;
  }

  // Strictly enforce onboarding redirect ONLY when profile_completed is explicitly false
  const isCompleted = Boolean(profile?.profile_completed || isMongoProfileCompleted);
  if (auth && profile !== null && !isCompleted && view !== 'complete-profile') {
    setTimeout(() => setView('complete-profile'), 0);
    return null;
  }

  // ==============================================================================
  // RENDER: Main Application Shell
  // ==============================================================================
  const totalSess = history ? history.length : 0;
  const userLevel = profile?.level || (Math.floor((totalSess * 150) / 1000) + 1);
  const userXP = profile?.xp !== undefined ? profile.xp : (totalSess * 150);

  // Today's workout statistics aggregator
  const todayStr = new Date().toDateString();
  const todaySessions = history ? history.filter(s => {
    const raw = s.workout_date || s.created_at || s.timestamp || s.date || '';
    if (!raw) return false;
    return new Date(raw).toDateString() === todayStr;
  }) : [];
  const todayCalories = todaySessions.reduce((sum, s) => sum + (parseFloat(s.calories_burned ?? s.predicted_kcal ?? 0) || 0), 0);
  const todayDurationSec = todaySessions.reduce((sum, s) => sum + (parseFloat(s.duration_sec ?? s.duration ?? 0) || 0), 0);

  const displayCalories = Math.round(todayCalories);
  const displayTime = Math.round(todayDurationSec / 60);
  const displayMovementScore = todaySessions.length > 0 
    ? Math.round(todaySessions.reduce((sum, s) => sum + (s.form_score_pct || 0), 0) / todaySessions.length)
    : (historyStats?.avg_form_score ? Math.round(historyStats.avg_form_score) : 0);
  const estimatedSteps = todaySessions.reduce((sum, s) => sum + (s.total_reps ? s.total_reps * 18 : Math.round((s.duration_sec || 0) * 1.5)), 0);

  // BMR & Nutrition Target Calculator (Mifflin-St Jeor)
  const ageVal = parseInt(profile?.age || 23);
  const weightVal = parseFloat(profile?.weight_kg || 68);
  const heightVal = parseFloat(profile?.height_cm || 175);
  const genderVal = profile?.gender || 'male';
  let calculatedBmr = 10 * weightVal + 6.25 * heightVal - 5 * ageVal + (genderVal === 'male' ? 5 : -161);
  const dailyCalorieTarget = Math.round(calculatedBmr * 1.25) || 2000;

  // Indian Meal Planner Tracking Methods
  const handleDateChange = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getSelectedDateDisplayString = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (selectedDate === todayStr) return 'Today';
    if (selectedDate === yesterdayStr) return 'Yesterday';
    if (selectedDate === tomorrowStr) return 'Tomorrow';

    try {
      const d = new Date(selectedDate);
      if (isNaN(d.getTime())) return selectedDate;
      return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) {
      return selectedDate;
    }
  };

  const getSelectedDateWater = () => {
    return waterHistory[selectedDate] || 0;
  };

  const handleAddWater = (volumeL) => {
    setWaterHistory(prev => {
      const next = { ...prev, [selectedDate]: Math.min(6, parseFloat(((prev[selectedDate] || 0) + volumeL).toFixed(2))) };
      localStorage.setItem('burnex_water_history', JSON.stringify(next));
      return next;
    });
  };

  const handleLogWeight = (weight) => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return;
    setWeightHistory(prev => {
      const existingIdx = prev.findIndex(w => w.date === selectedDate);
      let next;
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { date: selectedDate, weight: val };
      } else {
        next = [...prev, { date: selectedDate, weight: val }].sort((a,b) => new Date(a.date) - new Date(b.date));
      }
      localStorage.setItem('burnex_weight_history', JSON.stringify(next));
      return next;
    });
    setProfile(p => p ? { ...p, weight_kg: val } : null);
    setShowWeightModal(false);
    setWeightInputVal('');
  };

  const handleLogMeal = (mealType, food, qty = 1.0) => {
    const scale = qty / (food.qty || 1.0);
    const newLog = {
      id: food.id || `custom-${Date.now()}`,
      name: food.name,
      mealType,
      qty,
      unit: food.unit || 'serving',
      calories: Math.round(food.calories * scale),
      protein: Math.round(food.protein * scale),
      carbs: Math.round(food.carbs * scale),
      fat: Math.round(food.fat * scale),
      fiber: Math.round((food.fiber || 0) * scale),
      loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setLoggedMeals(prev => {
      const dateLogs = prev[selectedDate] || [];
      const next = { ...prev, [selectedDate]: [...dateLogs, newLog] };
      localStorage.setItem('burnex_logged_meals', JSON.stringify(next));
      return next;
    });
    setActiveFoodModal(null);
  };

  const handleUnlogMeal = (idx) => {
    setLoggedMeals(prev => {
      const dateLogs = prev[selectedDate] || [];
      const next = { ...prev, [selectedDate]: dateLogs.filter((_, i) => i !== idx) };
      localStorage.setItem('burnex_logged_meals', JSON.stringify(next));
      return next;
    });
  };

  const handleReplaceMeal = (mealType, newFood) => {
    setMealPlanOverrides(prev => {
      const dateOverrides = prev[selectedDate] || {};
      const next = { ...prev, [selectedDate]: { ...dateOverrides, [mealType]: newFood } };
      localStorage.setItem('burnex_meal_plan_overrides', JSON.stringify(next));
      return next;
    });
    setActiveReplaceModal(null);
  };

  const handleAddCustomFoodItem = () => {
    const f = customFoodForm;
    if (!f.name || !f.calories) return;
    const newFood = {
      id: `custom-food-${Date.now()}`,
      name: f.name,
      qty: parseFloat(f.qty) || 1,
      unit: f.unit || 'serving',
      calories: parseInt(f.calories) || 0,
      protein: parseFloat(f.protein) || 0,
      carbs: parseFloat(f.carbs) || 0,
      fat: parseFloat(f.fat) || 0,
      fiber: parseFloat(f.fiber) || 0,
      tags: ['veg', 'custom']
    };

    setCustomFoodsList(prev => {
      const next = [...prev, newFood];
      localStorage.setItem('burnex_custom_foods', JSON.stringify(next));
      return next;
    });
    setIsAddingCustomFormOpen(false);
    setCustomFoodForm({ name: '', qty: 1, unit: 'serving', calories: '', protein: '', carbs: '', fat: '', fiber: '' });
  };

  const getMealPlanForSelectedDate = () => {
    const basePlan = getDefaultMealPlan(profile?.fitness_goal || selectedGoal, dietaryPref);
    const overrides = mealPlanOverrides[selectedDate] || {};
    return {
      breakfast: overrides.breakfast || basePlan.breakfast,
      midMorning: overrides.midMorning || basePlan.midMorning,
      lunch: overrides.lunch || basePlan.lunch,
      eveningSnack: overrides.eveningSnack || basePlan.eveningSnack,
      dinner: overrides.dinner || basePlan.dinner
    };
  };

  const selectedDateMealPlan = getMealPlanForSelectedDate();
  const selectedDateLoggedMeals = loggedMeals[selectedDate] || [];

  // Compute daily nutritional metrics totals
  const consumedCalories = selectedDateLoggedMeals.reduce((sum, m) => sum + m.calories, 0);
  const consumedProtein = selectedDateLoggedMeals.reduce((sum, m) => sum + m.protein, 0);
  const consumedCarbs = selectedDateLoggedMeals.reduce((sum, m) => sum + m.carbs, 0);
  const consumedFat = selectedDateLoggedMeals.reduce((sum, m) => sum + m.fat, 0);
  const consumedFiber = selectedDateLoggedMeals.reduce((sum, m) => sum + (m.fiber || 0), 0);

  // Targets (dynamically derived from calorie target)
  const targetProtein = Math.round((dailyCalorieTarget * 0.30) / 4); // 30% of energy from protein
  const targetCarbs = Math.round((dailyCalorieTarget * 0.45) / 4);   // 45% of energy from carbs
  const targetFat = Math.round((dailyCalorieTarget * 0.25) / 9);     // 25% of energy from fat
  const targetFiber = 30; // standard daily target grams
  const targetWater = 2.5; // standard daily target litres

  // Nutrition scorecard calculations
  const getNutritionScore = () => {
    let score = 100;
    const tips = [];

    // 1. Calories check
    const calDiff = Math.abs(consumedCalories - dailyCalorieTarget);
    if (calDiff <= 100) {
      tips.push({ status: 'success', text: 'Calories on target' });
    } else if (consumedCalories > dailyCalorieTarget) {
      score -= Math.min(25, Math.round((calDiff / dailyCalorieTarget) * 40));
      tips.push({ status: 'warning', text: 'Calorie intake exceeds target' });
    } else {
      score -= Math.min(15, Math.round((calDiff / dailyCalorieTarget) * 20));
      tips.push({ status: 'info', text: 'Calorie intake below target' });
    }

    // 2. Protein check
    if (consumedProtein >= targetProtein) {
      tips.push({ status: 'success', text: 'Protein target reached' });
    } else if (consumedProtein >= targetProtein * 0.8) {
      tips.push({ status: 'success', text: 'Protein target nearly reached' });
    } else {
      score -= 20;
      tips.push({ status: 'warning', text: 'Increase protein intake' });
    }

    // 3. Hydration check
    const waterL = getSelectedDateWater();
    if (waterL >= targetWater) {
      tips.push({ status: 'success', text: 'Hydration goal met' });
    } else if (waterL >= 1.5) {
      tips.push({ status: 'info', text: 'Good hydration' });
    } else {
      score -= 15;
      tips.push({ status: 'warning', text: 'Drink more water' });
    }

    // 4. Fiber check
    if (consumedFiber >= targetFiber) {
      tips.push({ status: 'success', text: 'Fiber target reached' });
    } else {
      score -= 10;
      tips.push({ status: 'warning', text: 'Increase fiber intake' });
    }

    // 5. Meal consistency
    const loggedCount = selectedDateLoggedMeals.length;
    if (loggedCount >= 4) {
      tips.push({ status: 'success', text: 'Excellent meal consistency' });
    } else if (loggedCount > 0) {
      tips.push({ status: 'info', text: 'Meals logged successfully' });
    } else {
      score = 0;
      tips.push({ status: 'warning', text: 'No meals logged yet today' });
    }

    return { score: Math.max(0, score), tips };
  };
  const nutritionScoreData = getNutritionScore();

  // Smart next meal recommendations
  const getSmartMealRecommendation = () => {
    const hour = new Date().getHours();
    let currentSlot = 'breakfast';
    let recommendedDish = selectedDateMealPlan.breakfast;

    if (hour >= 9 && hour < 12) {
      currentSlot = 'midMorning';
      recommendedDish = selectedDateMealPlan.midMorning;
    } else if (hour >= 12 && hour < 16) {
      currentSlot = 'lunch';
      recommendedDish = selectedDateMealPlan.lunch;
    } else if (hour >= 16 && hour < 19) {
      currentSlot = 'eveningSnack';
      recommendedDish = selectedDateMealPlan.eveningSnack;
    } else if (hour >= 19) {
      currentSlot = 'dinner';
      recommendedDish = selectedDateMealPlan.dinner;
    }

    const isLogged = selectedDateLoggedMeals.some(m => m.mealType === currentSlot);
    return { slotName: currentSlot, dish: recommendedDish, isLogged };
  };
  const nextRecommendedMeal = getSmartMealRecommendation();

  // Food Search
  const searchResults = foodSearchQuery.trim() === '' ? [] : [
    ...INDIAN_FOODS_DB,
    ...customFoodsList
  ].filter(food => food.name.toLowerCase().includes(foodSearchQuery.toLowerCase()));

  // Weekly history
  const getWeeklyNutritionHistory = () => {
    const daysOfWeek = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString([], { weekday: 'short' });
      const dayMeals = loggedMeals[dateStr] || [];
      const dayCals = dayMeals.reduce((sum, m) => sum + m.calories, 0);
      daysOfWeek.push({ dateStr, dayName, calories: dayCals });
    }
    return daysOfWeek;
  };
  const weeklyHistory = getWeeklyNutritionHistory();
  const avgHistoryCalories = Math.round(weeklyHistory.reduce((sum, h) => sum + h.calories, 0) / 7);
  const totalMealsLoggedWeek = weeklyHistory.reduce((sum, h) => sum + (loggedMeals[h.dateStr]?.length || 0), 0);

  // Weight Trend Points
  const getWeightTrendPoints = () => {
    if (weightHistory.length === 0) return [];
    const logs = weightHistory.slice(-5);
    const maxWeight = Math.max(...logs.map(l => l.weight), 80);
    const minWeight = Math.min(...logs.map(l => l.weight), 50);
    const range = maxWeight - minWeight || 10;
    
    return logs.map((l, idx) => {
      const x = 30 + idx * 55;
      const y = 65 - ((l.weight - minWeight) / range) * 45;
      return { x, y, weight: l.weight, label: new Date(l.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) };
    });
  };
  const weightPoints = getWeightTrendPoints();
  const weightPath = weightPoints.reduce((path, p, idx) => path + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, "");

  // Streak & Completion Calculator
  const getStreakData = () => {
    if (!history || history.length === 0) {
      return { current: 0, best: 0, completedDays: [false, false, false, false, false, false, false] };
    }
    const dates = history.map(s => {
      const raw = s.workout_date || s.created_at || s.timestamp || s.date || '';
      return raw ? new Date(raw).toDateString() : '';
    }).filter(Boolean);
    const uniqueDates = [...new Set(dates)].map(d => new Date(d));
    uniqueDates.sort((a,b) => b - a);

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (uniqueDates[0] && (uniqueDates[0].getTime() === today.getTime() || uniqueDates[0].getTime() === yesterday.getTime())) {
      currentStreak = 1;
      let prevDate = uniqueDates[0];
      for (let i = 1; i < uniqueDates.length; i++) {
        const nextDate = uniqueDates[i];
        const diffDays = Math.floor((prevDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
          prevDate = nextDate;
        } else if (diffDays > 1) {
          break;
        }
      }
    }
    const completedDays = [false, false, false, false, false, false, false];
    const distanceToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    monday.setHours(0,0,0,0);

    history.forEach(s => {
      const raw = s.workout_date || s.created_at || s.timestamp || s.date || '';
      if (!raw) return;
      const sDate = new Date(raw);
      const diffDays = Math.floor((sDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        completedDays[diffDays] = true;
      }
    });

    const userBest = profile?.best_streak || currentStreak;
    return { current: currentStreak, best: userBest, completedDays };
  };
  const streakInfo = getStreakData();

  // Weekly aggregate calories for chart
  const getWeeklyCalorieData = () => {
    const realDays = [0, 0, 0, 0, 0, 0, 0];
    if (!history || history.length === 0) return realDays;
    const today = new Date();
    const distanceToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    monday.setHours(0,0,0,0);

    history.forEach(s => {
      const raw = s.workout_date || s.created_at || s.timestamp || s.date || '';
      if (!raw) return;
      const sDate = new Date(raw);
      const diffDays = Math.floor((sDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        realDays[diffDays] += (parseFloat(s.calories_burned ?? s.predicted_kcal ?? 0) || 0);
      }
    });
    return realDays.map(val => Math.round(val));
  };
  const weeklyCalories = getWeeklyCalorieData();
  const totalWeeklyCalories = Math.round(weeklyCalories.reduce((a, b) => a + b, 0));
  const avgFormScore = historyStats?.avg_form_score || 0;

  // Chart coordinates mapping
  const chartHeight = 130;
  const maxChartVal = Math.max(...weeklyCalories, 100);
  const chartPoints = weeklyCalories.map((val, idx) => {
    const x = 30 + (idx * 55);
    const y = chartHeight - 20 - ((val / maxChartVal) * 80);
    return { x, y, val };
  });
  const chartPath = chartPoints.reduce((path, p, idx) => path + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, "");

  // Derive active workouts count this week from history data
  const getActiveWorkoutsCountThisWeek = () => {
    if (!history || history.length === 0) return 0;
    const today = new Date();
    const distanceToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    monday.setHours(0,0,0,0);

    let count = 0;
    history.forEach(s => {
      const raw = s.workout_date || s.created_at || s.timestamp || s.date || '';
      if (!raw) return;
      const sDate = new Date(raw);
      const diffDays = Math.floor((sDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        count++;
      }
    });
    return count;
  };
  const activeWorkoutsCount = getActiveWorkoutsCountThisWeek();

  // Derive tomorrow's focus dynamically from weekly plan
  const getNextWorkoutFocus = () => {
    if (!weeklyPlan) return "Upper Body Strength";
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const tomorrowIdx = (new Date().getDay() + 1) % 7;
    const tomorrowKey = days[tomorrowIdx];
    const tomorrowPlan = weeklyPlan[tomorrowKey];
    return tomorrowPlan?.focus || "Rest Day";
  };
  const nextWorkoutFocus = getNextWorkoutFocus();

  // Derive workout status dynamically from state
  const getWorkoutStatus = () => {
    if (view !== 'studio') return 'IDLE';
    if (workoutMode === 'websocket') {
      if (wsWorkout.connectionStatus === 'CONNECTING') return 'CONNECTING';
      if (wsWorkout.connectionStatus === 'PROCESSING') return 'PROCESSING';
      if (wsWorkout.connectionStatus === 'DISCONNECTED') return 'ERROR';
      if (isPaused) return 'PAUSED';
      if (wsWorkout.telemetry) return 'STREAMING';
      return 'CONNECTING';
    }
    if (connectionError) return 'ERROR';
    if (!telemetry) return 'CONNECTING';
    if (telemetry.is_paused || isPaused) return 'PAUSED';
    if (!telemetry.is_active) return 'IDLE';
    if (!telemetry.camera_online) return 'CONNECTING';
    return 'STREAMING';
  };
  const workoutStatus = getWorkoutStatus();
  
  const getStatusDotClass = (status) => {
    switch (status) {
      case 'STREAMING': return 'bg-red-500 animate-pulse';
      case 'CONNECTING': return 'bg-amber-400 animate-pulse';
      case 'PAUSED': return 'bg-slate-400';
      case 'ERROR': return 'bg-red-600 animate-pulse';
      default: return 'bg-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900 select-none antialiased">
      
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside className={`w-full ${sidebarCollapsed ? 'md:w-[76px]' : 'md:w-60'} bg-white border-b md:border-b-0 md:border-r border-[#E6E8F5] flex flex-col flex-shrink-0 z-40 sticky top-0 md:h-screen md:h-[100dvh] select-none transition-all duration-300 ease-in-out`}>
        
        {/* 1. Brand Header — Pinned at Top */}
        <div className={`p-4 sm:p-5 pb-4 flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'justify-between'} border-b border-slate-100/60 flex-shrink-0 relative`}>
          <div className={`flex items-center gap-2.5 overflow-hidden ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shadow-orange-500/15 flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <defs>
                  <linearGradient id="burnex-logo-grad" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FF6B4A" />
                    <stop offset="50%" stopColor="#FA5252" />
                    <stop offset="100%" stopColor="#6345FF" />
                  </linearGradient>
                </defs>
                <path d="M16 2C16 2 10 9 10 15a6 6 0 0 0 6 6 6 6 0 0 0 6-6c0-3-2-6-2-6s-1 3-3 3c-1.5 0-2.5-1.5-2.5-3C14.5 7 16 2 16 2z" fill="url(#burnex-logo-grad)" />
              </svg>
            </div>
            <span className={`font-extrabold text-[#10183F] text-xl tracking-tight leading-none ${sidebarCollapsed ? 'md:hidden' : 'block'} transition-opacity duration-200`}>
              Burn-Ex
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Collapse toggle button */}
            <button 
              type="button"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              className={`rounded-full hidden md:flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6345FF]/20 ${
                sidebarCollapsed 
                  ? 'absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-[#E6E8F5] shadow-md hover:bg-[#F0F2FD] hover:border-[#DDD6FE] hover:scale-110 text-[#6345FF] z-50' 
                  : 'w-7 h-7 bg-[#F0F2FD] hover:bg-[#E5E9FC] text-[#6345FF]'
              }`}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>

            {/* Mobile hamburger menu toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Navigation Section — Independently Scrollable */}
        <div className={`flex-1 min-h-0 overflow-y-auto p-3 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Home', icon: Home },
              { id: 'workouts', label: 'Workouts', icon: Dumbbell },
              { id: 'progress', label: 'Progress', icon: TrendingUp },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
              { id: 'achievements', label: 'Achievements', icon: Award },
              { id: 'ai_coach', label: 'AI Coach', icon: Bot },
              { id: 'nutrition', label: 'Nutrition', icon: Utensils },
              { id: 'studio', label: 'Live Studio', icon: Camera },
              { id: 'profile', label: 'Profile', icon: User },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = view === tab.id;
              return (
                <button
                  key={tab.id}
                  title={tab.label}
                  onClick={() => {
                    handleNavClick(tab.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full ${sidebarCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'} py-2.5 rounded-2xl text-xs font-bold flex items-center gap-3 transition-all duration-200 group relative cursor-pointer ${
                    isActive 
                      ? 'bg-[#EEF0FF] text-[#6345FF] shadow-xs' 
                      : 'text-[#66729B] hover:text-[#10183F] hover:bg-[#F7F8FF]'
                  }`}
                >
                  <Icon size={18} className={`transition-transform duration-200 group-hover:scale-110 flex-shrink-0 ${isActive ? 'text-[#6345FF]' : 'text-[#66729B] group-hover:text-[#10183F]'}`} />
                  <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>{tab.label}</span>
                  
                  {/* Tooltip on collapsed state */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#10183F] text-white text-[11px] font-bold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap hidden md:block">
                      {tab.label}
                    </div>
                  )}
                </button>
              );
            })}
            
            {auth?.role === 'admin' && (
              <button
                title="Admin Panel"
                onClick={() => {
                  handleNavClick('admin');
                  setMobileMenuOpen(false);
                }}
                className={`w-full ${sidebarCollapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5'} py-2.5 rounded-2xl text-xs font-bold flex items-center gap-3 transition-all duration-200 group relative cursor-pointer ${
                  view === 'admin'
                    ? 'bg-[#EEF0FF] text-[#6345FF] shadow-xs'
                    : 'text-[#66729B] hover:text-[#10183F] hover:bg-[#F7F8FF]'
                }`}
              >
                <ShieldAlert size={18} className={`flex-shrink-0 ${view === 'admin' ? 'text-[#6345FF]' : 'text-[#66729B]'}`} />
                <span className={`truncate ${sidebarCollapsed ? 'md:hidden' : 'block'}`}>Admin Panel</span>
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#10183F] text-white text-[11px] font-bold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap hidden md:block">
                    Admin Panel
                  </div>
                )}
              </button>
            )}
          </nav>
        </div>

        {/* 3. Bottom Upgrade Section — Pinned at Bottom */}
        <div className={`p-3 pt-2 border-t border-slate-100/80 bg-white flex-shrink-0 mt-auto ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          {sidebarCollapsed ? (
            <div className="hidden md:flex justify-center py-1">
              <button
                title="Upgrade to Burn-Ex Pro"
                onClick={() => setIsProModalOpen(true)}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6345FF] to-[#8B5CF6] text-white flex items-center justify-center shadow-md shadow-[#6345FF]/20 hover:scale-105 transition active:scale-95 cursor-pointer"
              >
                <Crown size={18} />
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#F5F3FF] via-[#F8F7FF] to-[#EDE9FE] border border-[#DDD6FE]/60 rounded-2xl p-3.5 space-y-2.5 text-[#10183F] shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#6345FF]/10 text-[#6345FF] flex items-center justify-center">
                  <Crown size={14} className="text-[#6345FF]" />
                </div>
                <span className="font-extrabold text-xs text-[#10183F] leading-tight">
                  Upgrade to<br /><span className="text-[#6345FF]">Burn-Ex Pro</span>
                </span>
              </div>

              <div className="space-y-1 text-[10px] font-semibold text-[#66729B]">
                <div className="flex items-center gap-1.5"><Check size={11} className="text-[#6345FF]" /> Personalized Plans</div>
                <div className="flex items-center gap-1.5"><Check size={11} className="text-[#6345FF]" /> AI Coach Access</div>
                <div className="flex items-center gap-1.5"><Check size={11} className="text-[#6345FF]" /> Live Classes</div>
                <div className="flex items-center gap-1.5"><Check size={11} className="text-[#6345FF]" /> Advanced Analytics</div>
              </div>

              <button
                onClick={() => setIsProModalOpen(true)}
                className="w-full py-2 bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] hover:from-[#5235E8] hover:to-[#7C3AED] text-white text-xs font-bold rounded-xl shadow-sm shadow-[#6345FF]/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                Go Pro <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="flex-1 flex flex-col min-w-0 md:overflow-y-auto md:h-screen bg-[#F7F8FF]">
        
        {/* ─── TOP HEADER BAR ─── */}
        <header className="bg-white border-b border-[#E6E8F5] py-3.5 px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          
          {/* Search Bar Pill */}
          <div className="relative w-full max-w-md hidden sm:block">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66729B]" />
            <input 
              type="text" 
              placeholder="Search workouts, exercises, nutrition..."
              className="w-full pl-9 pr-4 py-2 bg-[#F7F8FF] border border-[#E6E8F5] rounded-full text-xs font-medium text-[#10183F] placeholder-[#66729B] focus:outline-none focus:border-[#6345FF] focus:ring-2 focus:ring-[#6345FF]/10 transition"
            />
          </div>

          <div className="flex items-center gap-3.5 ml-auto">
            {/* Notification Bell with Dynamic Popover Panel */}
            <div className="relative" ref={notifDropdownRef}>
              <button 
                type="button"
                onClick={() => {
                  setNotificationsOpen(prev => !prev);
                  if (!notificationsOpen && notifications.length === 0) {
                    fetchNotifications();
                  }
                }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                className={`w-9 h-9 rounded-full border flex items-center justify-center relative transition active:scale-95 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6345FF]/20 ${
                  notificationsOpen 
                    ? 'bg-[#EEF0FF] border-[#DDD6FE] text-[#6345FF]' 
                    : 'bg-[#F7F8FF] border-[#E6E8F5] text-[#66729B] hover:text-[#10183F] hover:bg-white'
                }`}
                title="Notifications"
              >
                <Bell size={17} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#EF4444] border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-xs animate-in zoom-in-50">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {notificationsOpen && (
                <div 
                  className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-96 max-w-[380px] bg-white rounded-2xl shadow-2xl border border-[#E6E8F5] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  role="dialog"
                  aria-label="Notifications Panel"
                >
                  {/* Dropdown Header */}
                  <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white via-[#F7F8FF] to-white">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#10183F] text-sm">Notifications</span>
                      {unreadNotifCount > 0 && (
                        <span className="px-2 py-0.5 bg-[#6345FF]/10 text-[#6345FF] text-[10px] font-black rounded-full">
                          {unreadNotifCount} new
                        </span>
                      )}
                    </div>

                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[11px] font-bold text-[#6345FF] hover:text-[#5235E8] flex items-center gap-1 transition cursor-pointer"
                      >
                        <CheckCheck size={13} />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {/* Dropdown Body */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100/80">
                    {notifLoading && notifications.length === 0 ? (
                      <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 size={24} className="animate-spin text-[#6345FF]" />
                        <span className="text-xs font-semibold">Loading alerts...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-10 px-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#F0F2FD] text-[#6345FF] mx-auto flex items-center justify-center mb-3">
                          <Bell size={22} className="opacity-60" />
                        </div>
                        <h4 className="text-xs font-black text-[#10183F] mb-1">No notifications yet</h4>
                        <p className="text-[11px] text-[#66729B] leading-relaxed">
                          You're all caught up! Check back after your next workout for new form feedback and insights.
                        </p>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        const { icon: CategoryIcon, color, bg } = getNotifCategoryIcon(item.category);
                        const isUnread = !item.read;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleMarkNotificationRead(item.id, item.target_view)}
                            className={`p-3.5 flex items-start gap-3 transition cursor-pointer group ${
                              isUnread ? 'bg-[#F8F9FF] hover:bg-[#EFF2FF]' : 'bg-white hover:bg-[#F8F9FA]'
                            }`}
                          >
                            {/* Category Icon Badge */}
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${bg} ${color}`}>
                              <CategoryIcon size={15} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <h5 className={`text-xs truncate ${isUnread ? 'font-extrabold text-[#10183F]' : 'font-semibold text-slate-700'}`}>
                                  {item.title}
                                </h5>
                                <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                                  {formatNotifTime(item.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#66729B] leading-relaxed line-clamp-2">
                                {item.message}
                              </p>
                            </div>

                            {/* Unread Indicator Dot & Dismiss */}
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 mt-1">
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-[#6345FF] shadow-xs" />
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteNotification(item.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition"
                                title="Dismiss notification"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] px-4">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileTab('notifications');
                        handleNavClick('profile');
                        setNotificationsOpen(false);
                      }}
                      className="font-bold text-[#66729B] hover:text-[#10183F] flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>Notification Preferences</span>
                      <ArrowRight size={11} />
                    </button>

                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          fetchNotifications();
                        }}
                        className="font-semibold text-slate-400 hover:text-[#6345FF] transition cursor-pointer flex items-center gap-1"
                        title="Refresh notifications"
                      >
                        <RotateCcw size={11} className={notifLoading ? 'animate-spin' : ''} />
                        <span>Sync</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar & Name Dropdown */}
            <div className="relative" ref={avatarDropdownRef}>
              <button 
                onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                className="flex items-center gap-2.5 p-1 pl-1.5 pr-2.5 rounded-full border border-[#E6E8F5] bg-white hover:bg-[#F7F8FF] transition active:scale-95 shadow-xs"
              >
                {auth?.photoURL || profile?.avatar ? (
                  <img src={auth?.photoURL || profile?.avatar} alt={auth?.name || 'Sanjai R'} className="w-8 h-8 rounded-full object-cover border border-[#E6E8F5]" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6345FF] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-xs shadow-xs">
                    {(auth?.name || profile?.name || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden sm:block leading-none pr-1">
                  <span className="text-xs font-bold text-[#10183F] block leading-tight">{auth?.name || profile?.name || 'Sanjai R'}</span>
                  <span className={`text-[10px] font-semibold block mt-0.5 ${subscription.is_pro ? 'text-[#6345FF] font-bold' : (subscription.status === 'active' && subscription.plan === 'trial' ? 'text-indigo-600 font-bold' : 'text-[#66729B]')}`}>
                    {subscription.is_pro ? 'Burn-Ex Pro' : (subscription.status === 'active' && subscription.plan === 'trial' ? `Pro Trial (${subscription.remaining_days || 0}d)` : 'Free Plan')}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-[#66729B] transition-transform duration-200 ${avatarDropdownOpen ? 'rotate-180 text-[#6345FF]' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {avatarDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E6E8F5] py-2 z-50 animate-in fade-in duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-black text-[#10183F] truncate">{auth?.name || profile?.name || 'Sanjai R'}</p>
                    <p className="text-[10px] font-semibold text-[#66729B] truncate">{auth?.email || profile?.email || 'sanjair@burnex.app'}</p>
                  </div>
                  
                  <div className="py-1">
                    {!subscription.is_pro && (
                      <button
                        onClick={() => {
                          setIsProModalOpen(true);
                          setAvatarDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-xs font-bold text-[#6345FF] hover:bg-[#F5F3FF] flex items-center gap-2.5 transition"
                      >
                        <Crown size={15} className="text-[#6345FF]" />
                        Upgrade to Pro
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setView('profile');
                        setProfileTab('overview');
                        setAvatarDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-[#10183F] hover:text-[#6345FF] hover:bg-[#EEF0FF]/60 flex items-center gap-2.5 transition"
                    >
                      <User size={15} className="text-[#66729B]" />
                      My Profile
                    </button>

                    <button
                      onClick={() => {
                        setView('progress');
                        setAvatarDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-[#10183F] hover:text-[#6345FF] hover:bg-[#EEF0FF]/60 flex items-center gap-2.5 transition"
                    >
                      <TrendingUp size={15} className="text-[#66729B]" />
                      Progress
                    </button>

                    <button
                      onClick={() => {
                        setView('leaderboard');
                        setAvatarDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-[#10183F] hover:text-[#6345FF] hover:bg-[#EEF0FF]/60 flex items-center gap-2.5 transition"
                    >
                      <Trophy size={15} className="text-[#66729B]" />
                      Leaderboard
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        setAvatarDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50/60 flex items-center gap-2.5 transition"
                    >
                      <LogOut size={15} className="text-red-400" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── BACKEND OFFLINE / CONNECTION ISSUE BANNER ─── */}
        {backendOffline && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-amber-800 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
              <span>⚠ Backend Connection Issue: Unable to connect to Burn-Ex API server. Your account remains signed in (Offline Mode Active).</span>
            </div>
            <button
              onClick={() => {
                checkBackendHealth();
                fetchProfile(true);
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black transition shadow-sm flex-shrink-0"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* ─── TAB RENDERING BODY ─── */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* ONBOARDING VIEW */}
          {view === 'onboarding' && (
            <div className="max-w-3xl mx-auto fade-in">
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${onboardingStep === 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-indigo-50 text-indigo-600'}`}>
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs font-black">1</span>
                  Body Metrics
                </div>
                <div className="w-8 h-0.5 bg-slate-200 rounded-full" />
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${onboardingStep === 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-100 text-slate-400'}`}>
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs font-black">2</span>
                  Training Goal
                </div>
              </div>

              {onboardingStep === 1 && (
                <div className="card-elevated bg-white p-8 scale-in rounded-2xl">
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-sm shadow-indigo-500/10">
                      <User size={24} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Athlete Calibration</h2>
                    <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                      We use the Mifflin-St Jeor equation to calculate your Basal Metabolic Rate for precise calorie tracking.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-5 mb-8">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Body Weight</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                          value={profile?.weight_kg || 70}
                          onChange={(e) => setProfile(prev => ({ ...prev, weight_kg: e.target.value }))}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Height</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                          value={profile?.height_cm || 175}
                          onChange={(e) => setProfile(prev => ({ ...prev, height_cm: e.target.value }))}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Age</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                          value={profile?.age || 25}
                          onChange={(e) => setProfile(prev => ({ ...prev, age: e.target.value }))}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">yrs</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Gender</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 appearance-none text-sm"
                        value={profile?.gender || 'male'}
                        onChange={(e) => setProfile(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={() => setOnboardingStep(2)}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Training Goals
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="scale-in">
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-sm shadow-indigo-500/10">
                      <Target size={24} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">Choose Your Training Program</h2>
                    <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto leading-relaxed">
                      Our AI coach will generate a personalized 7-day workout plan with daily circuits, rep targets, and coaching tips tailored to your goal.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {GOAL_PROGRAMS.map((program, idx) => {
                      const isSel = selectedGoal === program.value;
                      const Icon = program.icon;
                      return (
                        <button
                          key={program.value}
                          onClick={() => setSelectedGoal(program.value)}
                          className={`slide-up stagger-${idx + 1} card-interactive p-5 border rounded-2xl text-left flex gap-4 transition-all duration-200 ${
                            isSel 
                              ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-indigo-100/50 shadow-sm shadow-indigo-500/5' 
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${isSel ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15' : program.iconBg + ' ' + program.textClass}`}>
                            <Icon size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-bold text-sm ${isSel ? 'text-indigo-900' : 'text-slate-900'}`}>{program.title}</span>
                              {isSel && <CheckCircle2 size={14} className="text-indigo-600 flex-shrink-0" />}
                            </div>
                            <p className={`text-xs leading-relaxed mb-2.5 ${isSel ? 'text-indigo-600/80' : 'text-slate-500'}`}>
                              {program.desc}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {program.intensity} Intensity
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {program.daysPerWeek}x/week
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isSel ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {program.duration}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setOnboardingStep(1)}
                      className="px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all border border-slate-200/40 text-sm"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => saveProfile(selectedGoal)}
                      className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Sparkles size={18} />
                      Generate AI Training Plan
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HOME / DASHBOARD VIEW — EXACT MATCH TO REFERENCE IMAGE */}
          {view === 'dashboard' && (
            <div className="space-y-6 fade-in">
              
              {/* ROW 1: WELCOME HERO (65%) + TODAY'S PROGRESS (35%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* Welcome Hero Card (Span 8) */}
                <div className="lg:col-span-8 bg-gradient-to-br from-[#FFFFFF] via-[#F8F9FE] to-[#EEF0FF] border border-[#E6E8F5] rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-between shadow-xs min-h-[260px]">
                  
                  {/* Floating Streak Badges Top Right */}
                  <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
                    {/* Streak Pill */}
                    <div className="bg-white border border-[#E6E8F5] px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-xs">
                      <Flame size={16} className="text-[#FF6B4A]" fill="#FF6B4A" />
                      <div className="leading-tight">
                        <span className="text-xs font-black text-[#10183F] block">{streakInfo?.current || 0}</span>
                        <span className="text-[9px] font-bold text-[#66729B] uppercase block leading-none">Day Streak</span>
                      </div>
                    </div>

                    {/* Discipline Speech Bubble */}
                    <div className="hidden sm:flex bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] text-white px-3.5 py-2 rounded-2xl text-[11px] font-bold shadow-md shadow-[#6345FF]/20 items-center gap-1.5">
                      <span>Discipline today Stronger tomorrow 💪</span>
                    </div>
                  </div>

                  {/* Hero Left Content */}
                  <div className="relative z-10 max-w-md space-y-2">
                    <span className="text-xs font-bold text-[#66729B]">
                      {new Date().getHours() < 12 ? 'Good Morning,' : (new Date().getHours() < 18 ? 'Good Afternoon,' : 'Good Evening,')}
                    </span>
                    <h1 className="text-2xl md:text-3xl font-black text-[#10183F] tracking-tight leading-tight">
                      {auth?.name || profile?.name || 'Athlete'} 👋
                    </h1>
                    <p className="text-xs font-semibold text-[#66729B] leading-relaxed max-w-sm pt-1">
                      Stay consistent, keep going, and be the best version of yourself!
                    </p>
                  </div>

                  {/* Hero CTA Action Buttons */}
                  <div className="relative z-10 flex items-center gap-3 pt-6">
                    <button 
                      onClick={() => {
                        pendingExerciseRef.current = 'squat';
                        setIsPreWorkoutModalOpen(true);
                      }}
                      className="px-5 py-2.5 bg-[#6345FF] hover:bg-[#5235E8] text-white text-xs font-bold rounded-xl shadow-md shadow-[#6345FF]/25 transition flex items-center gap-2 active:scale-95"
                    >
                      Start Workout <ArrowRight size={14} />
                    </button>
                    <button 
                      onClick={() => handleNavClick('workouts')}
                      className="px-5 py-2.5 bg-[#EEF0FF] hover:bg-[#E0E4FC] text-[#6345FF] text-xs font-bold rounded-xl transition active:scale-95"
                    >
                      View Plan
                    </button>
                  </div>

                  {/* Athlete Image on Right Side */}
                  <div className="absolute right-0 bottom-0 pointer-events-none z-0 hidden sm:block">
                    <img 
                      src="/athlete_hero.jpg" 
                      alt="Burn-Ex Athlete" 
                      className="w-48 md:w-56 lg:w-64 object-contain max-h-[250px] opacity-95 drop-shadow-sm" 
                    />
                  </div>
                </div>

                {/* Today's Progress Card (Span 4) */}
                <div className="lg:col-span-4 bg-white border border-[#E6E8F5] rounded-3xl p-6 flex flex-col justify-between shadow-xs">
                  <h3 className="text-sm font-black text-[#10183F]">Today's Progress</h3>

                  {(() => {
                    const progressPercent = Math.min(100, Math.round((displayCalories / 500) * 100));
                    const circumference = 289;
                    const strokeOffset = circumference - (circumference * (progressPercent / 100));

                    return (
                      <div className="flex items-center gap-5 my-3">
                        {/* Circular Progress Ring */}
                        <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                          <svg width="112" height="112" viewBox="0 0 112 112" className="transform -rotate-90">
                            <circle cx="56" cy="56" r="46" fill="none" stroke="#F1F3FD" strokeWidth="8" />
                            <circle 
                              cx="56" 
                              cy="56" 
                              r="46" 
                              fill="none" 
                              stroke="url(#progress-ring-grad)" 
                              strokeWidth="8" 
                              strokeDasharray="289" 
                              strokeDashoffset={strokeOffset} 
                              strokeLinecap="round" 
                              className="transition-all duration-500" 
                            />
                            <defs>
                              <linearGradient id="progress-ring-grad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#8B5CF6" />
                                <stop offset="100%" stopColor="#6345FF" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xl font-black text-[#10183F]">{progressPercent}%</span>
                          </div>
                        </div>

                        {/* Progress Metric Bars */}
                        <div className="flex-1 space-y-3">
                          {/* Calories */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="flex items-center gap-1 font-bold text-[#66729B]">
                                <Flame size={12} className="text-[#FF6B4A]" /> Calories
                              </span>
                              <span className="font-extrabold text-[#10183F]">{displayCalories} / 500 kcal</span>
                            </div>
                            <div className="w-full bg-[#F1F3FD] h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#FF6B4A] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (displayCalories / 500) * 100)}%` }} />
                            </div>
                          </div>

                          {/* Steps */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="flex items-center gap-1 font-bold text-[#66729B]">
                                <Footprints size={12} className="text-[#6345FF]" /> Steps
                              </span>
                              <span className="font-extrabold text-[#10183F]">{estimatedSteps.toLocaleString()} / 10,000</span>
                            </div>
                            <div className="w-full bg-[#F1F3FD] h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#6345FF] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (estimatedSteps / 10000) * 100)}%` }} />
                            </div>
                          </div>

                          {/* Active Time */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="flex items-center gap-1 font-bold text-[#66729B]">
                                <Clock size={12} className="text-[#34C98B]" /> Active Time
                              </span>
                              <span className="font-extrabold text-[#10183F]">{displayTime} / 60 min</span>
                            </div>
                            <div className="w-full bg-[#F1F3FD] h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#34C98B] h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (displayTime / 60) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* ROW 2: 4 FITNESS METRIC CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* 1. Calories Burned */}
                <div className="bg-[#FFF7F4] border border-[#FFE7DE] p-4 rounded-2xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-[#FFECE4] text-[#FF6B4A] flex items-center justify-center flex-shrink-0">
                    <Flame size={20} fill="#FF6B4A" />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#10183F] block leading-none">{displayCalories}</strong>
                    <span className="text-[11px] font-semibold text-[#66729B] block mt-1">Calories Burned</span>
                  </div>
                </div>

                {/* 2. Steps */}
                <div className="bg-[#F0F6FF] border border-[#DEEDFF] p-4 rounded-2xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-[#E0EFFF] text-[#5685FF] flex items-center justify-center flex-shrink-0">
                    <Footprints size={20} />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#10183F] block leading-none">{estimatedSteps.toLocaleString()}</strong>
                    <span className="text-[11px] font-semibold text-[#66729B] block mt-1">Steps</span>
                  </div>
                </div>

                {/* 3. Active Minutes */}
                <div className="bg-[#F0FDF4] border border-[#DCFCE7] p-4 rounded-2xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] text-[#34C98B] flex items-center justify-center flex-shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#10183F] block leading-none">{displayTime}</strong>
                    <span className="text-[11px] font-semibold text-[#66729B] block mt-1">Active Minutes</span>
                  </div>
                </div>

                {/* 4. Workouts This Week */}
                <div className="bg-[#F5F3FF] border border-[#EDE9FE] p-4 rounded-2xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={20} />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#10183F] block leading-none">{activeWorkoutsCount}</strong>
                    <span className="text-[11px] font-semibold text-[#66729B] block mt-1">Workouts This Week</span>
                  </div>
                </div>

              </div>

              {/* SUBSCRIPTION TRIAL / EXPIRED STATUS BANNER */}
              {subscription?.status === 'active' && subscription?.plan === 'trial' && (
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 md:p-6 shadow-xs animate-in fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE]/60 text-[#6345FF] flex items-center justify-center flex-shrink-0">
                        <Crown size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-[#10183F] leading-tight">Burn-Ex Pro Trial</h4>
                        <p className="text-xs font-bold text-[#6345FF] mt-0.5">{subscription.remaining_days || 0} days remaining</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Active
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#F1F3FD] h-2 rounded-full overflow-hidden mb-3">
                    <div 
                      className="bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(5, Math.min(100, ((30 - (subscription.remaining_days || 0)) / 30) * 100))}%` }} 
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#66729B] font-semibold border-b border-slate-100 pb-3 mb-3 gap-1">
                    <span>Started on <strong className="text-[#10183F]">{subscription.trial_started_at ? new Date(subscription.trial_started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today'}</strong></span>
                    <span>Expires on <strong className="text-[#10183F]">{subscription.trial_expires_at ? new Date(subscription.trial_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'In 30 Days'}</strong></span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#6345FF] flex items-center justify-center flex-shrink-0">
                        <Brain size={15} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#66729B] block leading-tight">AI Coach Credits (Today)</span>
                        <span className="text-xs font-black text-[#10183F]">{subscription.ai_credits_remaining ?? 5} / 5 credits remaining</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-[#66729B] flex items-center gap-1.5">
                      <Clock size={13} className="text-[#6345FF]" />
                      <span>Resets at 00:00 UTC</span>
                    </div>
                  </div>
                </div>
              )}

              {subscription?.status === 'expired' && (
                <div className="bg-white border border-amber-200/80 rounded-3xl p-5 md:p-6 shadow-xs relative overflow-hidden animate-in fade-in">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <Crown size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm md:text-base font-black text-[#10183F]">Trial Expired</h4>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-black uppercase">
                            Expired
                          </span>
                        </div>
                        <p className="text-xs text-[#66729B] font-medium mt-1 max-w-lg">
                          Your 30-day Burn-Ex Pro trial has ended. Subscribe now to continue using AI Coach and other Pro features.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-[#10183F] my-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5"><Check size={13} className="text-[#6345FF]" /> Unlimited AI Coach</div>
                    <div className="flex items-center gap-1.5"><Check size={13} className="text-[#6345FF]" /> Advanced Analytics</div>
                    <div className="flex items-center gap-1.5"><Check size={13} className="text-[#6345FF]" /> Personalized Plans</div>
                    <div className="flex items-center gap-1.5"><Check size={13} className="text-[#6345FF]" /> Live Classes & More</div>
                  </div>

                  <button
                    onClick={() => setIsProModalOpen(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] hover:from-[#5235E8] hover:to-[#7C3AED] text-white text-xs font-black rounded-xl shadow-md shadow-[#6345FF]/20 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Crown size={14} /> Subscribe to Pro (₹499/month)
                  </button>
                </div>
              )}

              {/* ROW 3: RECOMMENDED WORKOUT (1/3) + WEEKLY ACTIVITY (1/3) + AI COACH (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Recommended Workout Card */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black text-[#10183F]">Recommended Workout</h3>
                    <button onClick={() => handleNavClick('workouts')} className="text-[11px] font-bold text-[#6345FF] hover:underline flex items-center gap-0.5">
                      View All →
                    </button>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden min-h-[175px] flex flex-col justify-between p-4 bg-slate-900 text-white shadow-xs">
                    <img 
                      src="/workout_squat.jpg" 
                      alt="Recommended Workout" 
                      className="absolute inset-0 w-full h-full object-cover opacity-60" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

                    <div className="relative z-10">
                      <span className="inline-block bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        Full Body
                      </span>
                    </div>

                    <div className="relative z-10 space-y-2">
                      <h4 className="font-extrabold text-base leading-tight text-white">Full Body Strength</h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-200 font-semibold">
                        <span className="flex items-center gap-1"><Clock size={12} /> 30 min</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><User size={12} /> Beginner</span>
                      </div>
                      <button 
                        onClick={() => {
                          pendingExerciseRef.current = 'squat';
                          setIsPreWorkoutModalOpen(true);
                        }}
                        className="w-fit px-4 py-1.5 bg-[#6345FF] hover:bg-[#5235E8] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95"
                      >
                        Start Workout →
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Your Weekly Activity Bar Chart */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-[#10183F]">Your Weekly Activity</h3>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-[#66729B] bg-[#F7F8FF] px-2 py-0.5 rounded-lg border border-[#E6E8F5]">
                      <span>Calories</span>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  {/* 7-Day Bar Chart */}
                  <div className="flex items-end justify-between gap-2 h-36 pt-4 pb-2 px-1">
                    {(() => {
                      const maxCal = Math.max(...weeklyCalories.map(b => b.val), 500);
                      return weeklyCalories.map((bar, idx) => {
                        const pct = bar.val > 0 ? Math.min(100, Math.max(12, Math.round((bar.val / maxCal) * 100))) : 0;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <div className="w-full max-w-[28px] bg-[#F0F2FD] rounded-t-lg relative flex items-end h-[100px] overflow-hidden" title={`${bar.day}: ${bar.val} kcal`}>
                              <div 
                                className="w-full bg-gradient-to-t from-[#6345FF] to-[#8B5CF6] rounded-t-lg transition-all duration-500 group-hover:brightness-110" 
                                style={{ height: `${pct}%` }} 
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[#66729B] group-hover:text-[#6345FF] transition">{bar.day}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 3. AI Coach Card */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#EEF0FF] text-[#6345FF] flex items-center justify-center">
                          <Bot size={16} />
                        </div>
                        <h3 className="text-xs font-black text-[#10183F]">AI Coach</h3>
                      </div>
                      <button 
                        onClick={() => handleNavClick('ai_coach')}
                        className="text-[10px] font-bold text-[#6345FF] bg-[#EEF0FF] hover:bg-[#E0E4FC] px-2.5 py-1 rounded-xl transition"
                      >
                        Try Now
                      </button>
                    </div>
                    <p className="text-[11px] text-[#66729B] leading-relaxed">
                      Get personalized workout suggestions, nutrition tips and real-time guidance.
                    </p>
                  </div>

                  {/* 3 Prompt Pills */}
                  <div className="space-y-1.5 pt-3">
                    {[
                      { prompt: "Suggest a workout for today", icon: Zap },
                      { prompt: "Give me a nutrition plan", icon: Utensils },
                      { prompt: "How can I improve my stamina?", icon: Sparkles }
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            handleNavClick('ai_coach');
                            handleSendChatMessage(item.prompt);
                          }}
                          className="w-full px-3 py-2 bg-[#F7F8FF] hover:bg-[#EEF0FF] border border-[#E6E8F5] rounded-xl text-left text-[11px] font-bold text-[#10183F] hover:text-[#6345FF] transition flex items-center gap-2 active:scale-98"
                        >
                          <Icon size={13} className="text-[#6345FF] flex-shrink-0" />
                          <span className="truncate">{item.prompt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* ROW 4: NUTRITION OVERVIEW (1/3) + ACHIEVEMENTS (1/3) + LEADERBOARD (1/3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Nutrition Overview */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-[#10183F]">Nutrition Overview</h3>
                    <button onClick={() => handleNavClick('nutrition')} className="text-[11px] font-bold text-[#6345FF] hover:underline flex items-center gap-0.5">
                      View All →
                    </button>
                  </div>

                  {(() => {
                    const totalMacroGrams = (consumedProtein || 0) + (consumedCarbs || 0) + (consumedFat || 0);
                    const proteinPct = totalMacroGrams > 0 ? Math.round(((consumedProtein || 0) / totalMacroGrams) * 100) : 0;
                    const carbsPct = totalMacroGrams > 0 ? Math.round(((consumedCarbs || 0) / totalMacroGrams) * 100) : 0;
                    const fatsPct = totalMacroGrams > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0;

                    return (
                      <div className="flex items-center justify-between gap-4 my-2">
                        {/* Donut SVG Ring */}
                        <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                          <svg width="104" height="104" viewBox="0 0 104 104" className="transform -rotate-90">
                            {/* Background track */}
                            <circle cx="52" cy="52" r="42" fill="none" stroke="#F1F3FD" strokeWidth="9" />
                            {consumedCalories > 0 && (
                              <>
                                <circle 
                                  cx="52" 
                                  cy="52" 
                                  r="42" 
                                  fill="none" 
                                  stroke="#6345FF" 
                                  strokeWidth="9" 
                                  strokeDasharray="264" 
                                  strokeDashoffset={264 - (264 * (proteinPct / 100))} 
                                  strokeLinecap="round" 
                                />
                                <circle 
                                  cx="52" 
                                  cy="52" 
                                  r="42" 
                                  fill="none" 
                                  stroke="#FFAB38" 
                                  strokeWidth="9" 
                                  strokeDasharray="264" 
                                  strokeDashoffset={264 - (264 * (carbsPct / 100))} 
                                  className="rotate-120 origin-center" 
                                  strokeLinecap="round" 
                                />
                                <circle 
                                  cx="52" 
                                  cy="52" 
                                  r="42" 
                                  fill="none" 
                                  stroke="#34C98B" 
                                  strokeWidth="9" 
                                  strokeDasharray="264" 
                                  strokeDashoffset={264 - (264 * (fatsPct / 100))} 
                                  className="rotate-240 origin-center" 
                                  strokeLinecap="round" 
                                />
                              </>
                            )}
                          </svg>
                          <div className="absolute text-center">
                            <strong className="text-sm font-black text-[#10183F] block leading-none">{consumedCalories.toLocaleString()}</strong>
                            <span className="text-[9px] font-bold text-[#66729B] uppercase block mt-0.5">kcal</span>
                          </div>
                        </div>

                        {/* Macro Percentages */}
                        <div className="flex-1 space-y-2 text-xs font-bold text-[#10183F]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[#66729B] font-semibold text-[11px]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#6345FF]" /> Protein
                            </span>
                            <span>{consumedCalories > 0 ? `${proteinPct}% (${consumedProtein}g)` : '0g'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[#66729B] font-semibold text-[11px]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FFAB38]" /> Carbs
                            </span>
                            <span>{consumedCalories > 0 ? `${carbsPct}% (${consumedCarbs}g)` : '0g'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[#66729B] font-semibold text-[11px]">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#34C98B]" /> Fats
                            </span>
                            <span>{consumedCalories > 0 ? `${fatsPct}% (${consumedFat}g)` : '0g'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Achievements Preview */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-[#10183F]">Achievements</h3>
                    <button onClick={() => handleNavClick('achievements')} className="text-[11px] font-bold text-[#6345FF] hover:underline flex items-center gap-0.5">
                      View All →
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 my-2 text-center">
                    {achievementsLoading ? (
                      <div className="col-span-4 py-4 text-center text-xs text-[#66729B] font-bold">Loading...</div>
                    ) : achievements.length === 0 ? (
                      <div className="col-span-4 py-4 text-center text-xs text-[#66729B] font-semibold">No achievements yet</div>
                    ) : (
                      achievements.slice(0, 4).map((ach, idx) => (
                        <div key={ach.id || idx} className="flex flex-col items-center gap-1.5" title={ach.description || ach.name}>
                          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs ${
                            ach.unlocked 
                              ? 'bg-[#FFF5F2] border-[#FFE7DE] text-[#FF6B4A]' 
                              : 'bg-[#F8F9FE] border-[#E6E8F5] text-[#94A3B8] opacity-60'
                          }`}>
                            {idx === 0 ? <Flame size={20} fill={ach.unlocked ? "#FF6B4A" : "none"} /> :
                             idx === 1 ? <Calendar size={18} /> :
                             idx === 2 ? <Star size={18} fill={ach.unlocked ? "#FFAB38" : "none"} className={ach.unlocked ? "text-[#FFAB38]" : ""} /> :
                             <Award size={18} />}
                          </div>
                          <span className="text-[9px] font-bold text-[#10183F] leading-tight truncate max-w-[65px]">{ach.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Leaderboard Preview */}
                <div className="bg-white border border-[#E6E8F5] rounded-3xl p-5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-[#10183F]">Leaderboard</h3>
                    <button onClick={() => handleNavClick('leaderboard')} className="text-[11px] font-bold text-[#6345FF] hover:underline flex items-center gap-0.5">
                      View All →
                    </button>
                  </div>

                  <div className="space-y-2 my-1">
                    {leaderboardLoading ? (
                      <div className="py-4 text-center text-xs text-[#66729B] font-bold">Loading rankings...</div>
                    ) : leaderboard.length === 0 ? (
                      <div className="py-4 text-center text-xs text-[#66729B] font-semibold">No leaderboard rankings yet</div>
                    ) : (
                      leaderboard.slice(0, 3).map((item, idx) => {
                        const isMe = item.user_id === (auth?.uid || profile?.id) || item.is_current_user;
                        const rankBadgeColor = idx === 0 ? 'bg-[#FEF3C7] text-[#D97706]' : idx === 1 ? 'bg-[#E2E8F0] text-[#475569]' : 'bg-[#FFEDD5] text-[#EA580C]';
                        return (
                          <div key={item.user_id || idx} className={`flex items-center justify-between p-2 rounded-xl transition ${
                            isMe ? 'bg-[#EEF0FF] border border-[#DDD6FE]/60' : 'bg-[#F7F8FF] hover:bg-[#EEF0FF]/50'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${rankBadgeColor}`}>
                                {item.rank || idx + 1}
                              </span>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black overflow-hidden ${
                                isMe ? 'bg-[#6345FF] text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {item.avatar ? (
                                  <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  (item.name || 'U').charAt(0).toUpperCase()
                                )}
                              </div>
                              <span className={`text-xs font-bold truncate max-w-[110px] ${isMe ? 'text-[#6345FF]' : 'text-[#10183F]'}`}>
                                {isMe ? `You (${item.name || auth?.name || 'Athlete'})` : (item.name || 'Athlete')}
                              </span>
                            </div>
                            <span className="text-xs font-black text-[#6345FF]">{(item.points || item.score || 0).toLocaleString()} pts</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* WORKOUTS VIEW */}
          {view === 'workouts' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    Your Workout Plan 💪
                  </h2>
                  <p className="text-slate-500 text-sm mt-0.5">Personalized workouts tailored for your goals</p>
                </div>
                <button 
                  onClick={() => { handleNavClick('profile'); setProfileTab('preferences'); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles size={14} className="text-indigo-500" /> Customize Plan
                </button>
              </div>

              {/* Sub-tabs Plan Overview / Exercises / Muscle Focus */}
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm max-w-md">
                {['overview', 'exercises', 'muscle'].map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setWorkoutSubTab(sub)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition capitalize ${
                      workoutSubTab === sub 
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/40' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {sub === 'overview' ? 'Plan Overview' : (sub === 'exercises' ? 'Exercises' : 'Muscle Focus')}
                  </button>
                ))}
              </div>

              {workoutSubTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Next Workout Card & Schedule */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Next Workout Feature Card */}
                    <div className="card-elevated bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] text-white rounded-3xl overflow-hidden relative min-h-[220px] flex flex-col justify-between p-7 shadow-lg shadow-[#6345FF]/20">
                      {/* Decorative Background Glow */}
                      <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="relative z-10 space-y-4">
                        <span className="text-[10px] bg-white/20 backdrop-blur-md text-white font-black px-3 py-1 rounded-full uppercase tracking-wider">Next Workout</span>
                        <div className="space-y-1.5">
                          <h3 className="text-2xl font-black tracking-tight">{nextWorkoutFocus}</h3>
                          <p className="text-white/80 text-xs max-w-md leading-relaxed">Build strength and definition in your upper body with compound movements.</p>
                        </div>
                        <div className="flex items-center gap-5 text-xs text-white/90 font-bold">
                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-white/80" /> 60 min</span>
                          <span className="flex items-center gap-1.5"><Flame size={14} className="text-white/80" /> 450 kcal est.</span>
                          <span className="flex items-center gap-1.5"><Activity size={14} className="text-white/80" /> Advanced Level</span>
                        </div>
                      </div>
                      
                      <div className="relative z-10 flex gap-2 pt-4">
                        <button 
                          onClick={handleStartDailyCircuit}
                          className="px-6 py-3 bg-white hover:bg-slate-50 text-[#6345FF] font-black rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 text-xs"
                        >
                          <Play size={14} fill="currentColor" /> Start Workout
                        </button>
                        <button 
                          onClick={() => handleNavClick('ai_coach')}
                          className="p-3 bg-white/15 hover:bg-white/25 text-white rounded-xl transition active:scale-95 border border-white/20"
                        >
                          <MessageCircle size={14} />
                        </button>
                      </div>
                    </div>

                    {/* This Week's Schedule */}
                    <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">This Week's Schedule</h3>
                        <button onClick={() => setWorkoutSubTab('exercises')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition">View All Workouts</button>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {WEEK_DAYS.map((d, index) => {
                          const dayData = weeklyPlan?.[d.key];
                          const isRest = !dayData?.circuit?.length;
                          const completed = index < 4; // Mock completed state
                          return (
                            <div key={d.key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                              <div className="flex items-center gap-4">
                                <div className="text-center w-12 flex-shrink-0">
                                  <span className="text-[9px] font-black text-slate-400 uppercase block">{d.short}</span>
                                  <span className="text-lg font-black text-slate-800 leading-tight block">{19 + index}</span>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                                  {isRest ? <Heart size={14} className="text-emerald-500" /> : <Dumbbell size={14} className="text-indigo-500" />}
                                </div>
                                <div className="min-w-0">
                                  <strong className="text-slate-800 text-sm block truncate leading-none">{isRest ? 'Rest Day' : (dayData?.focus || 'Upper Body Strength')}</strong>
                                  <span className="text-[10px] text-slate-400 font-semibold block mt-1">{isRest ? 'Rest & Regeneration' : `${dayData?.circuit?.length || 4} Exercises · Chest, Shoulders`}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="hidden sm:inline-block text-[11px] text-slate-400 font-bold">{isRest ? '—' : '60 min · 450 kcal'}</span>
                                <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                                  isRest 
                                    ? 'bg-amber-50 border-amber-100 text-amber-600' 
                                    : (completed ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600')
                                }`}>
                                  {isRest ? 'Rest Day' : (completed ? 'Completed' : 'Upcoming')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Workout Calendar & Program Details */}
                  <div className="space-y-6">
                    {/* Workout Calendar & Calorie Range Calculator */}
                    <div className="card-elevated bg-white p-5 rounded-2xl space-y-4 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={14} className="text-indigo-600" /> Workout Calendar & Calories
                          </h3>
                          <p className="text-[10px] text-slate-500 font-medium">Select start & end date to compute calories burned</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          Aug 2026
                        </span>
                      </div>

                      {/* Date Inputs & Presets */}
                      <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1 uppercase text-[9px]">Start Date</label>
                            <input
                              type="date"
                              value={calStartDate}
                              onChange={(e) => setCalStartDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1 uppercase text-[9px]">End Date</label>
                            <input
                              type="date"
                              value={calEndDate}
                              onChange={(e) => setCalEndDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase">Quick:</span>
                          <button onClick={() => setQuickDateRange('today')} className="text-[9px] font-extrabold px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md transition">Today</button>
                          <button onClick={() => setQuickDateRange(7)} className="text-[9px] font-extrabold px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md transition">7 Days</button>
                          <button onClick={() => setQuickDateRange(15)} className="text-[9px] font-extrabold px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md transition">15 Days</button>
                          <button onClick={() => setQuickDateRange(30)} className="text-[9px] font-extrabold px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md transition">30 Days</button>
                          <button onClick={() => setQuickDateRange('month')} className="text-[9px] font-extrabold px-2 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-md transition">This Month</button>
                        </div>
                      </div>

                      {/* CALORIE CALCULATION RESULT BADGE */}
                      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-4 rounded-xl shadow-md shadow-indigo-600/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-200">
                            Calories Burned ({calStartDate} to {calEndDate})
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-orange-300">
                            <Flame size={16} />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <strong className="text-3xl font-black tracking-tight">{rangeTotalCalories}</strong>
                          <span className="text-xs font-bold text-indigo-200">kcal total</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-[10px] font-bold text-indigo-100">
                          <div>
                            <span className="block text-[8px] text-indigo-300 uppercase">Workouts</span>
                            <strong>{rangeFilteredSessions.length} sessions</strong>
                          </div>
                          <div>
                            <span className="block text-[8px] text-indigo-300 uppercase">Duration</span>
                            <strong>{rangeTotalDurationMin} min</strong>
                          </div>
                          <div>
                            <span className="block text-[8px] text-indigo-300 uppercase">Total Reps</span>
                            <strong>{rangeTotalReps} reps</strong>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Calendar Days Grid */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 pb-1 border-b border-slate-100">
                          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                        </div>

                        <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center text-xs font-bold text-slate-700">
                          {calendarDaysGrid.map((d, idx) => {
                            const isStart = d.dateStr === calStartDate;
                            const isEnd = d.dateStr === calEndDate;
                            const isRange = d.dateStr >= (calStartDate <= calEndDate ? calStartDate : calEndDate) && 
                                            d.dateStr <= (calStartDate <= calEndDate ? calEndDate : calStartDate);

                            return (
                              <div key={idx} className="flex flex-col items-center justify-center h-9">
                                <button
                                  onClick={() => handleCalendarDayClick(d.dateStr)}
                                  title={d.hasWorkout ? `${d.dayCalories} kcal (${d.workoutCount} workouts)` : d.dateStr}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition relative ${
                                    isStart || isEnd
                                      ? 'bg-indigo-600 text-white font-black shadow-md scale-105'
                                      : (isRange 
                                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' 
                                          : (d.isPrevMonth || d.isNextMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'))
                                  }`}
                                >
                                  {d.day}
                                </button>
                                <div className="h-1.5 flex items-center justify-center mt-0.5">
                                  {d.hasWorkout && (
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-sm" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 pt-1">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600" /> Selected Range</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Workout Logged</span>
                          <span className="text-slate-400 font-normal italic">Click dates to pick range</span>
                        </div>
                      </div>
                    </div>

                    {/* Program Progress Card */}
                    <div className="card-elevated bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 rounded-2xl flex items-center gap-5">
                      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                        <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
                          <circle cx="32" cy="32" r="28" fill="none" stroke="white" strokeWidth="6" strokeDasharray="175.8" strokeDashoffset="58" strokeLinecap="round" />
                        </svg>
                        <div className="absolute text-center">
                          <span className="text-sm font-extrabold block">4</span>
                          <span className="text-[8px] text-white/70 block uppercase leading-none mt-0.5">of 6</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm">Your Program</h4>
                        <p className="text-[10px] text-white/70 leading-relaxed mt-1">Push · Strength · Consistency<br />6 Days Program · Advanced Level</p>
                        <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-2.5">
                          <div className="bg-white h-full rounded-full" style={{ width: '67%' }} />
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold text-white/80 mt-1">
                          <span>Program Progress</span>
                          <span>67%</span>
                        </div>
                      </div>
                    </div>

                    {/* Muscle Focus Card */}
                    <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Muscle Focus This Week</h4>
                      <div className="flex items-center gap-4">
                        <svg viewBox="0 0 100 150" className="w-14 h-auto text-indigo-500 opacity-60 flex-shrink-0">
                          <path d="M50 15a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM50 16a4 4 0 0 0-4 4v30a4 4 0 0 0 4 4v20M50 74v40l-12 30M50 114l12 30M32 25l18 10 18-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <div className="flex-1 space-y-2">
                          {[
                            { label: 'Chest', val: 85 },
                            { label: 'Back', val: 70 },
                            { label: 'Legs', val: 90 },
                            { label: 'Shoulders', val: 75 },
                            { label: 'Core', val: 80 }
                          ].map((m) => (
                            <div key={m.label} className="text-[10px]">
                              <div className="flex justify-between font-bold text-slate-700 mb-0.5">
                                <span>{m.label}</span>
                                <span>{m.val}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${m.val}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold leading-normal pt-1.5 border-t border-slate-100/60">
                        Focus areas are adjusted automatically based on performance.
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {workoutSubTab === 'exercises' && (
                <div className="card-elevated bg-white p-6 rounded-2xl space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Dumbbell size={15} className="text-indigo-600" /> Current Circuit Exercises
                  </h3>
                  
                  {activeCircuit?.exercises?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeCircuit.exercises.map((ex, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 transition group">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block leading-none">{ex.exercise_name || ex.exercise}</span>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-1">{ex.sets} sets</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                              {ex.reps ? `${ex.reps} reps` : `${ex.duration_sec}s`}
                            </span>
                            <button 
                              onClick={() => handleSelectCircuitExercise(idx)}
                              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition active:scale-95 shadow-sm"
                            >
                              <Play size={12} fill="currentColor" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs">
                      No active circuit loaded. Switch goals or calibrate profile.
                    </div>
                  )}
                </div>
              )}

              {workoutSubTab === 'muscle' && (
                <div className="card-elevated bg-white p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Anatomical Line Outline */}
                  <div className="flex flex-col items-center justify-center border-r border-slate-100 pr-0 md:pr-8">
                    <svg viewBox="0 0 100 150" className="w-36 h-auto text-indigo-500 opacity-60">
                      {/* Stylized human pose skeleton vector */}
                      <path d="M50 15a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM50 16a4 4 0 0 0-4 4v30a4 4 0 0 0 4 4v20M50 74v40l-12 30M50 114l12 30M32 25l18 10 18-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-4">Biomechanical Load Distribution</span>
                  </div>

                  {/* Muscle focus progress bars */}
                  <div className="space-y-4 flex flex-col justify-center">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Muscle Focus This Week</h4>
                    {[
                      { label: 'Chest', val: 85 },
                      { label: 'Back', val: 70 },
                      { label: 'Legs', val: 90 },
                      { label: 'Shoulders', val: 75 },
                      { label: 'Core', val: 80 }
                    ].map((m) => (
                      <div key={m.label} className="text-xs">
                        <div className="flex justify-between font-bold text-slate-700 mb-1">
                          <span>{m.label}</span>
                          <span>{m.val}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full transition-all duration-300" style={{ width: `${m.val}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-slate-500 italic mt-2">
                      Focus areas are adjusted automatically based on your workout form performance.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROGRESS VIEW */}
          {view === 'progress' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Training Progress Log</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Historical logs and synchronization rankings</p>
                </div>
                <button 
                  onClick={fetchLeaderboard}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Refresh
                </button>
              </div>

              {/* Progress Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Total Calories', value: `${historyStats?.total_kcal_burned || 0} kcal`, color: 'orange' },
                  { label: 'Total Sessions', value: historyStats?.total_sessions || 0, color: 'blue' },
                  { label: 'Total Repetitions', value: historyStats?.total_reps || 0, color: 'violet' },
                  { label: 'Avg. Form Accuracy', value: `${historyStats?.avg_form_score || 100}%`, color: 'emerald' }
                ].map((item, i) => (
                  <div key={i} className="card-elevated bg-white p-5 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{item.label}</span>
                    <strong className="text-slate-800 text-xl font-black mt-1.5 block">{item.value}</strong>
                  </div>
                ))}
              </div>

              {/* Leaderboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Global Leaderboard */}
                <div className="lg:col-span-2 card-elevated bg-white p-6 rounded-2xl">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Trophy size={16} className="text-amber-500" /> Global Leaderboard
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <th className="pb-3 w-16">Rank</th>
                          <th className="pb-3">Athlete</th>
                          <th className="pb-3 text-right">Calories</th>
                          <th className="pb-3 text-center">Form Score</th>
                          <th className="pb-3 text-center">Valid Reps</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {leaderboard.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center py-12 text-slate-400 text-xs">
                              <Trophy size={24} className="mx-auto mb-2 text-slate-300" />
                              No records found. Complete a set to appear!
                            </td>
                          </tr>
                        ) : (
                          leaderboard.map((user, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition">
                              <td className="py-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                                  idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                                }`}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-3 font-bold text-slate-900">{user.athlete_alias}</td>
                              <td className="py-3 text-right font-bold text-emerald-600">{(user.total_kcal_burned || 0).toFixed(1)} kcal</td>
                              <td className="py-3 text-center">
                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  (user.global_form_score_avg || 0) >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {(user.global_form_score_avg || 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 text-center font-semibold text-slate-700">{user.total_valid_reps || 0}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Workout History Log */}
                <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Session History</h3>
                  
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {history.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">No workout history logged yet.</div>
                    ) : (
                      history.map((sess, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 text-xs block leading-none">{sess.exercise_name || 'Workout Set'}</span>
                            <span className="text-[9px] text-slate-400 font-semibold block mt-1">
                              {new Date(sess.timestamp).toLocaleDateString()} · {Math.round(sess.duration_sec)}s
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-emerald-600 block">{Math.round(sess.predicted_kcal)} kcal</span>
                            <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">{sess.form_score_pct}% accuracy</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* AI COACH VIEW */}
          {view === 'ai_coach' && (
            <div className="card-elevated bg-white p-6 rounded-2xl max-w-4xl mx-auto flex flex-col h-[560px] fade-in shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-500/5">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Burn-Ex AI Coach</h3>
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full pulse-soft" />
                      • Online • Gemini AI
                    </span>
                  </div>
                </div>

                {/* AI Daily Credit Pill */}
                <div 
                  onClick={() => !subscription.is_pro && setIsProModalOpen(true)}
                  title={subscription.is_pro ? "Unlimited Pro AI Credits" : "5 AI Coach credits refreshed daily at 00:00 UTC"}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F5F3FF] border border-[#DDD6FE] text-[#6345FF] rounded-full text-xs font-black shadow-xs cursor-pointer hover:bg-[#EDE9FE] transition active:scale-95"
                >
                  <Brain size={14} className="text-[#6345FF]" />
                  <span>{subscription.is_pro ? 'Unlimited' : `${subscription.ai_credits_remaining ?? 5} / 5`} credits</span>
                  <span className="text-[10px] text-[#6345FF]/70">ⓘ</span>
                </div>
              </div>

              {/* Chat Message Buffer */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                {chatMessages.map((m, idx) => {
                  const isCoach = m.role === 'coach';
                  return (
                    <div key={idx} className={`flex items-start gap-2.5 ${isCoach ? '' : 'justify-end'}`}>
                      {isCoach && (
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0 mt-0.5">
                          <Bot size={16} />
                        </div>
                      )}
                      <div 
                        className={`max-w-[75%] p-3.5 text-xs leading-relaxed ${
                          isCoach 
                            ? 'bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl rounded-tl-none' 
                            : 'bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-sm'
                        }`}
                      >
                        {isCoach ? renderMarkdown(m.text) : m.text}
                      </div>
                    </div>
                  );
                })}
                {isChatLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0 mt-0.5">
                      <Bot size={16} />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 text-slate-500 p-3.5 flex items-center gap-3 w-fit rounded-2xl rounded-tl-none">
                      <span className="text-[11px] font-semibold animate-pulse">Burn-Ex AI is thinking...</span>
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Credits Exhausted (Today) Banner */}
              {!subscription.is_pro && (subscription.ai_credits_remaining <= 0) && (
                <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-2xl flex items-start gap-3 mb-2 animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                    <Brain size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-red-900">You've used all 5 AI credits for today</h4>
                    <p className="text-[11px] text-red-700/80 font-medium mt-0.5">
                      Your credit limit will reset tomorrow at 12:00 AM (UTC).
                    </p>
                  </div>
                </div>
              )}

              {/* Suggestion pills */}
              <div className="flex gap-2 flex-wrap pb-3">
                {COACH_SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChatMessage(s)}
                    disabled={isChatLoading || (!subscription.is_pro && subscription.ai_credits_remaining <= 0)}
                    className="text-[10px] font-bold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition truncate active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Send controls */}
              <div className="flex gap-2 pt-3 border-t border-slate-100/60">
                <input 
                  type="text" 
                  disabled={isChatLoading || (!subscription.is_pro && subscription.ai_credits_remaining <= 0)}
                  placeholder={
                    (!subscription.is_pro && subscription.ai_credits_remaining <= 0)
                      ? "Daily credit limit reached. Resets tomorrow at 12:00 AM (UTC)..."
                      : isChatLoading 
                        ? "Burn-Ex AI is responding..." 
                        : "Ask your AI coach about form improvements, workouts, or recovery..."
                  } 
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-medium disabled:opacity-60"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                />
                <button 
                  onClick={() => handleSendChatMessage()}
                  disabled={isChatLoading || !chatInput.trim() || (!subscription.is_pro && subscription.ai_credits_remaining <= 0)}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition disabled:opacity-40 active:scale-95 flex items-center justify-center flex-shrink-0 w-11"
                >
                  <Send size={15} />
                </button>
              </div>

              {/* Need more AI credits? Pro Upgrade Card */}
              {!subscription.is_pro && (
                <div className="mt-3 p-3 bg-gradient-to-r from-[#F5F3FF] via-[#F8F7FF] to-[#EDE9FE] border border-[#DDD6FE]/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#6345FF]/10 text-[#6345FF] flex items-center justify-center flex-shrink-0">
                      <Crown size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black text-[#10183F] leading-tight">Need more AI credits?</p>
                      <p className="text-[10px] text-[#66729B] font-semibold truncate">Upgrade to Burn-Ex Pro for unlimited AI Coach access and many more features.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsProModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#6345FF] hover:bg-[#5235E8] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer active:scale-95"
                  >
                    Upgrade to Pro <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* NUTRITION VIEW */}
          {view === 'nutrition' && (
            <div className="space-y-6 fade-in">
              {/* TOP HEADER CONTROLS: Date Selector & Dietary Preference */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border border-slate-200/80 rounded-2xl shadow-sm">
                
                {/* Date Switcher */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDateChange(-1)} 
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition active:scale-95 text-slate-600"
                    title="Previous Day"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  
                  <div className="text-center min-w-[120px]">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">MEAL PLAN DATE</span>
                    <strong className="text-slate-800 text-sm font-black mt-0.5 block">{getSelectedDateDisplayString()}</strong>
                  </div>

                  <button 
                    onClick={() => handleDateChange(1)} 
                    className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl transition active:scale-95 text-slate-600"
                    title="Next Day"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>

                  {/* Manual Date Input Picker */}
                  <div className="relative">
                    <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                      className="opacity-0 absolute inset-0 cursor-pointer w-8 h-8"
                    />
                    <div className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 flex items-center justify-center pointer-events-none w-8.5 h-8.5">
                      <Calendar size={14} />
                    </div>
                  </div>
                </div>

                {/* Dietary Preference selector */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-500 hidden md:inline">Dietary Preference:</span>
                  <select 
                    value={dietaryPref}
                    onChange={(e) => {
                      setDietaryPref(e.target.value);
                      localStorage.setItem('burnex_dietary_pref', e.target.value);
                    }}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 cursor-pointer"
                  >
                    <option value="vegetarian">🟢 Strict Vegetarian</option>
                    <option value="non-vegetarian">🔴 Non-Vegetarian</option>
                    <option value="eggetarian">🟡 Eggetarian</option>
                    <option value="vegan">🌱 Pure Vegan</option>
                  </select>
                </div>
              </div>

              {/* NUTRITION METRICS UPPER GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Daily Calorie Tracker */}
                <div className="lg:col-span-2 card-elevated bg-white p-5 rounded-2xl flex flex-col justify-between min-h-[300px]">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                      <Flame size={14} className="text-orange-500" /> Daily Calorie Tracker
                    </h3>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      
                      {/* Calorie circular progress ring */}
                      <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
                        <svg width="144" height="144" viewBox="0 0 144 144" className="transform -rotate-90">
                          <circle cx="72" cy="72" r="62" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                          <circle 
                            cx="72" 
                            cy="72" 
                            r="62" 
                            fill="none" 
                            stroke="url(#nutri-circle-grad)" 
                            strokeWidth="10" 
                            strokeDasharray="389.5" 
                            strokeDashoffset={389.5 - (389.5 * Math.min(1, consumedCalories / dailyCalorieTarget))} 
                            strokeLinecap="round" 
                            className="transition-all duration-500" 
                          />
                          <defs>
                            <linearGradient id="nutri-circle-grad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#8B5CF6" />
                              <stop offset="100%" stopColor="#6366F1" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-slate-900 leading-none">{consumedCalories}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">kcal consumed</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">of {dailyCalorieTarget}</span>
                        </div>
                      </div>

                      {/* Calorie Stats Breakdown */}
                      <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Target Calorie</span>
                          <strong className="text-slate-800 text-sm font-black mt-0.5 block">{dailyCalorieTarget} kcal</strong>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Remaining</span>
                          <strong className={`text-sm font-black mt-0.5 block ${dailyCalorieTarget - consumedCalories < 0 ? 'text-red-500' : 'text-indigo-600'}`}>
                            {dailyCalorieTarget - consumedCalories} kcal
                          </strong>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl col-span-2 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Calorie Deficit / Surplus</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">Based on your goal: <strong>{profile?.fitness_goal || selectedGoal}</strong></span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            profile?.fitness_goal === 'Weight Gain' || selectedGoal === 'Muscle-gain' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {profile?.fitness_goal === 'Weight Gain' || selectedGoal === 'Muscle-gain' ? 'Surplus' : 'Deficit'}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Macros Progress Bar Lists */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-4 border-t border-slate-100/60">
                    {[
                      { label: 'Protein', cur: consumedProtein, tar: targetProtein, color: 'bg-indigo-500', text: 'text-indigo-600', unit: 'g' },
                      { label: 'Carbs', cur: consumedCarbs, tar: targetCarbs, color: 'bg-emerald-500', text: 'text-emerald-600', unit: 'g' },
                      { label: 'Fat', cur: consumedFat, tar: targetFat, color: 'bg-amber-500', text: 'text-amber-600', unit: 'g' },
                      { label: 'Fiber', cur: consumedFiber, tar: targetFiber, color: 'bg-orange-500', text: 'text-orange-600', unit: 'g' },
                      { label: 'Water', cur: getSelectedDateWater(), tar: targetWater, color: 'bg-blue-500', text: 'text-blue-600', unit: 'L' }
                    ].map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-500">{m.label}</span>
                          <span className="text-slate-800">{m.cur}/{m.tar}{m.unit}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`${m.color} h-full rounded-full transition-all duration-300`} 
                            style={{ width: `${Math.min(100, (m.cur / m.tar) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Side Widgets Stack */}
                <div className="space-y-6">
                  
                  {/* Hydration tracker widget */}
                  <div className="card-elevated bg-white p-5 rounded-2xl">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Droplet size={14} className="text-blue-500" /> Hydration Tracker
                    </h3>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>Water Intake</span>
                      <span className="text-blue-600">{getSelectedDateWater().toFixed(2)} / 2.5 L</span>
                    </div>

                    {/* Interactive glasses grid */}
                    <div className="flex flex-wrap gap-2.5 my-3">
                      {Array.from({ length: 10 }, (_, i) => {
                        const filled = getSelectedDateWater() >= (i + 1) * 0.25;
                        return (
                          <div 
                            key={i} 
                            onClick={() => handleAddWater(filled ? -0.25 : 0.25)}
                            className={`w-6 h-9 border-2 rounded-b-md cursor-pointer transition-all duration-300 relative flex items-end justify-center ${
                              filled 
                                ? 'bg-blue-500/20 border-blue-500 shadow-sm shadow-blue-500/10' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            title={`${(i + 1) * 250} ml`}
                          >
                            {filled && <div className="absolute inset-0 bg-gradient-to-t from-blue-500/80 to-blue-400/80 rounded-b-sm animate-pulse" />}
                            <span className="text-[7px] font-black text-blue-600 z-10 select-none pb-1">{(i + 1) * 250}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick increment buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '+250 ml', val: 0.25 },
                        { label: '+500 ml', val: 0.50 },
                        { label: '+750 ml', val: 0.75 }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          onClick={() => handleAddWater(btn.val)}
                          className="py-1.5 bg-blue-50 hover:bg-blue-100/80 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100 transition active:scale-95"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nutrition Scorecard widget */}
                  <div className="card-elevated bg-white p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy size={14} className="text-amber-500" /> Nutrition Score
                      </h3>
                      <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                        {nutritionScoreData.score} / 100
                      </span>
                    </div>

                    {/* Score insights */}
                    <div className="space-y-2 max-h-[110px] overflow-y-auto pr-1">
                      {nutritionScoreData.tips.map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[10px] leading-relaxed">
                          <span className={`mt-0.5 flex-shrink-0 ${
                            tip.status === 'success' ? 'text-emerald-500' : tip.status === 'warning' ? 'text-amber-500' : 'text-slate-400'
                          }`}>
                            {tip.status === 'success' ? '✓' : tip.status === 'warning' ? '⚠' : '○'}
                          </span>
                          <span className={`font-semibold ${
                            tip.status === 'success' ? 'text-slate-600' : tip.status === 'warning' ? 'text-slate-700' : 'text-slate-500'
                          }`}>{tip.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* MEAL PLAN & RECOMMENDATIONS BOTTOM HALF GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 2. Today's Meal Plan chronological list */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* Smart Next Meal Recommendation Alert */}
                  {!nextRecommendedMeal.isLogged && (
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-white"><Sparkles size={18} /></div>
                        <div>
                          <span className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider block">Recommended Next Meal</span>
                          <strong className="text-sm font-black mt-0.5 block leading-none capitalize">
                            {nextRecommendedMeal.slotName === 'midMorning' ? 'Mid-Morning Snack' : (nextRecommendedMeal.slotName === 'eveningSnack' ? 'Evening Snack' : nextRecommendedMeal.slotName)} · {nextRecommendedMeal.dish.name}
                          </strong>
                          <span className="text-[10px] text-indigo-100/80 block mt-1">
                            {nextRecommendedMeal.dish.calories} kcal · {nextRecommendedMeal.dish.protein}g protein
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleLogMeal(nextRecommendedMeal.slotName, nextRecommendedMeal.dish, nextRecommendedMeal.dish.qty)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold rounded-xl shadow-sm transition active:scale-95 flex-shrink-0"
                      >
                        Log Meal
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Utensils size={14} className="text-indigo-500" /> Today's Meal Plan
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 capitalize">Goal Program: <strong>{profile?.fitness_goal || selectedGoal}</strong></span>
                  </div>

                  {/* Chronological Meal Presets Cards */}
                  <div className="space-y-4">
                    {[
                      { key: 'breakfast', label: 'Breakfast', time: '08:00 AM' },
                      { key: 'midMorning', label: 'Mid-Morning Snack', time: '10:30 AM' },
                      { key: 'lunch', label: 'Lunch', time: '01:00 PM' },
                      { key: 'eveningSnack', label: 'Evening Snack', time: '04:30 PM' },
                      { key: 'dinner', label: 'Dinner', time: '08:00 PM' }
                    ].map((slot) => {
                      const plannedMeal = selectedDateMealPlan[slot.key];
                      const logs = selectedDateLoggedMeals.filter(m => m.mealType === slot.key);
                      const isLogged = logs.length > 0;
                      
                      return (
                        <div key={slot.key} className="card-elevated bg-white p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-indigo-100">
                          
                          {/* Meal Info details */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-[10px] text-slate-400 font-extrabold flex-shrink-0">
                              <span className="uppercase text-[8px] font-bold text-slate-400">{slot.key === 'midMorning' ? 'SNACK' : (slot.key === 'eveningSnack' ? 'SNACK' : slot.key.toUpperCase())}</span>
                              <span className="text-slate-600 font-black mt-0.5 leading-none">{slot.time.split(' ')[0]}</span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-800 text-sm leading-snug">{plannedMeal.name}</h4>
                                <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md">
                                  {plannedMeal.qty} {plannedMeal.unit}
                                </span>
                              </div>
                              
                              <p className="text-[10px] text-slate-400 truncate mt-1 leading-relaxed">{plannedMeal.ingredients}</p>
                              
                              {/* Macros labels */}
                              <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 flex-wrap">
                                <span className="text-orange-500">{plannedMeal.calories} kcal</span>
                                <span>P: {plannedMeal.protein}g</span>
                                <span>C: {plannedMeal.carbs}g</span>
                                <span>F: {plannedMeal.fat}g</span>
                              </div>
                            </div>
                          </div>

                          {/* Logging Actions & Controls */}
                          <div className="flex items-center gap-3 flex-wrap justify-end pt-3 md:pt-0 border-t border-slate-100 md:border-t-0">
                            
                            {/* Portion sizing picker */}
                            <div className="flex items-center border border-slate-200/80 rounded-xl p-0.5 bg-slate-50">
                              {[0.5, 1.0, 1.5, 2.0].map((mul) => (
                                <button
                                  key={mul}
                                  onClick={() => handleLogMeal(slot.key, plannedMeal, parseFloat((plannedMeal.qty * mul).toFixed(1)))}
                                  className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all ${
                                    isLogged && Math.abs(logs[0].qty - parseFloat((plannedMeal.qty * mul).toFixed(1))) < 0.05
                                      ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100/50' 
                                      : 'text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {mul}x
                                </button>
                              ))}
                            </div>

                            {/* Actions panel */}
                            <div className="flex items-center gap-2">
                              {/* Replace button */}
                              <button 
                                onClick={() => setActiveReplaceModal({ mealType: slot.key, currentFood: plannedMeal })}
                                className="px-3 py-2 border border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-[10px] font-bold rounded-xl transition active:scale-95"
                              >
                                Replace
                              </button>

                              {/* Details button */}
                              <button 
                                onClick={() => setActiveFoodModal({ mealType: slot.key, food: plannedMeal, isLogged: false })}
                                className="px-3 py-2 border border-slate-200/80 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-[10px] font-bold rounded-xl transition active:scale-95"
                              >
                                Edit
                              </button>

                              {/* Log toggle button */}
                              {isLogged ? (
                                <button 
                                  onClick={() => handleUnlogMeal(selectedDateLoggedMeals.findIndex(m => m.mealType === slot.key))}
                                  className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black rounded-xl transition active:scale-95 flex items-center gap-1"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  Logged
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleLogMeal(slot.key, plannedMeal, plannedMeal.qty)}
                                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl shadow-sm transition active:scale-95"
                                >
                                  Log Meal
                                </button>
                              )}
                            </div>

                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Left/Right Sidebar widgets */}
                <div className="space-y-6">
                  
                  {/* Food Search panel */}
                  <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      Search Food & Add Meal
                    </h3>

                    {/* Search Field input */}
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search Indian foods (e.g. Paneer)"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-medium"
                        value={foodSearchQuery}
                        onChange={(e) => setFoodSearchQuery(e.target.value)}
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </div>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2 border border-slate-100 p-2.5 rounded-xl bg-slate-50 max-h-[160px] overflow-y-auto">
                        {searchResults.map((food) => (
                          <div key={food.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-[10px]">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 block truncate">{food.name}</span>
                              <span className="text-slate-400 block mt-0.5">{food.qty} {food.unit} · {food.calories} kcal · {food.protein}g P</span>
                            </div>
                            <button
                              onClick={() => handleLogMeal('lunch', food, food.qty)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition active:scale-95 ml-2 border border-indigo-100/50"
                              title="Add to Logged Lunch"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Collapsible custom meal entry form */}
                    <div className="border-t border-slate-100 pt-3">
                      <button
                        onClick={() => setIsAddingCustomFormOpen(!isAddingCustomFormOpen)}
                        className="w-full text-left text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center justify-between"
                      >
                        <span>{isAddingCustomFormOpen ? '− Hide Custom Meal Form' : '+ Add Custom Meal Entry'}</span>
                      </button>

                      {isAddingCustomFormOpen && (
                        <div className="space-y-3 mt-3 scale-in">
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Meal Name</label>
                            <input 
                              type="text" 
                              placeholder="e.g. Paneer Bhurji" 
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                              value={customFoodForm.name}
                              onChange={(e) => setCustomFoodForm(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Serving Qty</label>
                              <input 
                                type="number" 
                                placeholder="1" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.qty}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, qty: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Unit Label</label>
                              <input 
                                type="text" 
                                placeholder="plate" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.unit}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, unit: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Calories (kcal)</label>
                              <input 
                                type="number" 
                                placeholder="320" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.calories}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, calories: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Protein (g)</label>
                              <input 
                                type="number" 
                                placeholder="20" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.protein}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, protein: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Carbs (g)</label>
                              <input 
                                type="number" 
                                placeholder="4" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.carbs}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, carbs: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Fat (g)</label>
                              <input 
                                type="number" 
                                placeholder="16" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.fat}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, fat: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 mb-1 uppercase">Fiber (g)</label>
                              <input 
                                type="number" 
                                placeholder="1" 
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px]"
                                value={customFoodForm.fiber}
                                onChange={(e) => setCustomFoodForm(prev => ({ ...prev, fiber: e.target.value }))}
                              />
                            </div>
                          </div>

                          <button 
                            onClick={handleAddCustomFoodItem}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl transition active:scale-95 shadow-sm"
                          >
                            Log to Today's Lunch
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weight Progress Widget */}
                  <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Target size={14} className="text-indigo-500" /> Weight Progress
                      </h3>
                      <button 
                        onClick={() => setShowWeightModal(true)} 
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition"
                      >
                        Log Weight
                      </button>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold">Current</span>
                        <span>{weightHistory[weightHistory.length - 1]?.weight || 70} kg</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold">Goal</span>
                        <span>{parseFloat(profile?.weight_kg || 70) - 5} kg</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-slate-400 block uppercase font-bold">Total Lost</span>
                        <span className="text-emerald-600">
                          {((weightHistory[0]?.weight || 71.8) - (weightHistory[weightHistory.length - 1]?.weight || 70)).toFixed(1)} kg
                        </span>
                      </div>
                    </div>

                    {/* Weight History SVG line graph */}
                    {weightPath && (
                      <div className="pt-2 border-t border-slate-100/60">
                        {weightPoints.length > 1 ? (
                          <svg viewBox="0 0 260 80" className="w-full h-20 overflow-visible mt-2">
                            <path d={weightPath} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
                            {weightPoints.map((p, idx) => (
                              <g key={idx} className="group cursor-pointer">
                                <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="#6366F1" strokeWidth="2" />
                                <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  <rect x={p.x - 20} y={p.y - 20} width="40" height="14" rx="4" fill="#0F172A" />
                                  <text x={p.x} y={p.y - 10} fill="white" fontSize="8" fontWeight="black" textAnchor="middle">{p.weight}kg</text>
                                </g>
                                <text x={p.x} y="76" fill="#94A3B8" fontSize="7" fontWeight="bold" textAnchor="middle">{p.label}</text>
                              </g>
                            ))}
                          </svg>
                        ) : (
                          <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 font-bold italic">
                            Log more weight entries to see trend line.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Weekly Calories aggregation chart widget */}
                  <div className="card-elevated bg-white p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-indigo-500" /> Weekly Calories
                      </h3>
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg font-bold">
                        Avg: {avgHistoryCalories} kcal
                      </span>
                    </div>

                    <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                      <span>Meals Logged: <strong>{totalMealsLoggedWeek}</strong></span>
                      <span>Target: {dailyCalorieTarget} kcal</span>
                    </div>

                    {/* Dynamic Bar chart */}
                    <div className="pt-2 border-t border-slate-100/60 flex items-center justify-center">
                      <svg viewBox="0 0 320 80" className="w-full h-20 overflow-visible mt-2">
                        {weeklyHistory.map((h, idx) => {
                          const barWidth = 24;
                          const gap = 16;
                          const x = 20 + idx * (barWidth + gap);
                          const maxVal = Math.max(...weeklyHistory.map(d => d.calories), 1000);
                          const barHeight = (h.calories / maxVal) * 50 || 2;
                          const y = 60 - barHeight;
                          const isToday = h.dateStr === selectedDate;
                          return (
                            <g key={idx} className="group cursor-pointer">
                              <rect x={x} y="10" width={barWidth} height="50" rx="4" fill="#F8FAFC" />
                              <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill={isToday ? '#6366F1' : '#CBD5E1'} className="transition-all duration-500 group-hover:fill-indigo-400" />
                              <text x={x + barWidth / 2} y="75" fill="#94A3B8" fontSize="9" fontWeight="bold" textAnchor="middle">{h.dayName}</text>
                              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <rect x={x - 12} y={y - 22} width="48" height="16" rx="4" fill="#0F172A" />
                                <text x={x + barWidth / 2} y={y - 11} fill="white" fontSize="8" fontWeight="black" textAnchor="middle">{h.calories}k</text>
                              </g>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                </div>
              </div>

              {/* Visual timeline display checklist */}
              <div className="card-elevated bg-white p-5 rounded-2xl">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                  <Clock size={14} className="text-indigo-500" /> Daily Meal Timeline
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {[
                    { key: 'breakfast', label: 'Breakfast', time: '08:00' },
                    { key: 'midMorning', label: 'Snack', time: '10:30' },
                    { key: 'lunch', label: 'Lunch', time: '13:00' },
                    { key: 'eveningSnack', label: 'Snack', time: '16:30' },
                    { key: 'dinner', label: 'Dinner', time: '20:00' }
                  ].map((item, index) => {
                    const logs = selectedDateLoggedMeals.filter(m => m.mealType === item.key);
                    const isLogged = logs.length > 0;
                    const hour = new Date().getHours();
                    const slotHour = parseInt(item.time.split(':')[0]);
                    const isUpcoming = hour < slotHour;
                    
                    return (
                      <div key={item.key} className="flex-1 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] font-black border transition ${
                          isLogged 
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10' 
                            : (isUpcoming ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-amber-50 border-amber-200 text-amber-600')
                        }`}>
                          {isLogged ? '✓' : (isUpcoming ? '○' : '⚠')}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-xs block leading-none">{item.label}</span>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-1">{item.time} {isLogged ? '· Logged' : (isUpcoming ? '· Upcoming' : '· Pending')}</span>
                        </div>
                        {index < 4 && <div className="hidden lg:block flex-1 h-0.5 bg-slate-100 rounded-full mx-2" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ──────────────────────────────────────────────────────────
                  MODAL OVERLAYS RENDERING
              ────────────────────────────────────────────────────────── */}

              {/* A. Food details modal overlay */}
              {activeFoodModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                  <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-6 scale-in">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">{activeFoodModal.mealType} Details</span>
                        <h3 className="text-lg font-black text-slate-900 mt-1">{activeFoodModal.food.name}</h3>
                      </div>
                      <button 
                        onClick={() => setActiveFoodModal(null)} 
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-500">Base Portion</span>
                        <span className="font-extrabold text-slate-800">{activeFoodModal.food.qty} {activeFoodModal.food.unit}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                        <span className="font-bold text-slate-500">Base Calories</span>
                        <span className="font-black text-orange-600">{activeFoodModal.food.calories} kcal</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-[10px] font-bold text-slate-500">
                        <div>
                          <span>Protein</span>
                          <span className="block text-slate-800 text-xs font-black mt-0.5">{activeFoodModal.food.protein}g</span>
                        </div>
                        <div>
                          <span>Carbs</span>
                          <span className="block text-slate-800 text-xs font-black mt-0.5">{activeFoodModal.food.carbs}g</span>
                        </div>
                        <div>
                          <span>Fat</span>
                          <span className="block text-slate-800 text-xs font-black mt-0.5">{activeFoodModal.food.fat}g</span>
                        </div>
                        <div>
                          <span>Fiber</span>
                          <span className="block text-slate-800 text-xs font-black mt-0.5">{activeFoodModal.food.fiber || 0}g</span>
                        </div>
                      </div>
                    </div>

                    {activeFoodModal.food.ingredients && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ingredients</h4>
                        <p className="text-slate-600 text-xs leading-relaxed">{activeFoodModal.food.ingredients}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleLogMeal(activeFoodModal.mealType, activeFoodModal.food, activeFoodModal.food.qty)}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95"
                      >
                        Log recommended portion ({activeFoodModal.food.qty})
                      </button>
                      <button
                        onClick={() => setActiveFoodModal(null)}
                        className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* B. Replace food selection modal overlay */}
              {activeReplaceModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                  <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-5 scale-in">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">REPLACE MEAL RECOMMENDED</span>
                        <h3 className="text-md font-black text-slate-900 mt-1 capitalize">Alternatives for {activeReplaceModal.mealType === 'midMorning' ? 'Mid-Morning Snack' : (activeReplaceModal.mealType === 'eveningSnack' ? 'Evening Snack' : activeReplaceModal.mealType)}</h3>
                      </div>
                      <button 
                        onClick={() => setActiveReplaceModal(null)} 
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-xs text-slate-400 leading-relaxed font-semibold">
                      Current planned: <strong>{activeReplaceModal.currentFood.name}</strong> ({activeReplaceModal.currentFood.calories} kcal). Select a similar caloric Indian meal alternative:
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {[
                        ...INDIAN_FOODS_DB,
                        ...customFoodsList
                      ].filter(f => 
                        f.tags.includes(activeReplaceModal.mealType === 'midMorning' || activeReplaceModal.mealType === 'eveningSnack' ? 'snack' : activeReplaceModal.mealType) &&
                        (dietaryPref === 'vegan' ? f.tags.includes('vegan') : true) &&
                        (dietaryPref === 'vegetarian' ? f.tags.includes('veg') : true) &&
                        (dietaryPref === 'eggetarian' ? (f.tags.includes('veg') || f.tags.includes('egg')) : true) &&
                        f.name !== activeReplaceModal.currentFood.name
                      ).slice(0, 5).map((alt) => (
                        <div key={alt.id} className="p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl flex items-center justify-between transition gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-800 text-xs block truncate">{alt.name}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {alt.qty} {alt.unit} · <strong className="text-orange-500">{alt.calories} kcal</strong> · P: {alt.protein}g · C: {alt.carbs}g
                            </span>
                          </div>
                          <button
                            onClick={() => handleReplaceMeal(activeReplaceModal.mealType, alt)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition active:scale-95 flex-shrink-0"
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setActiveReplaceModal(null)}
                        className="px-4 py-2 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* C. Weight Log modal overlay */}
              {showWeightModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                  <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-5 scale-in">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">BODY CALIBRATION LOG</span>
                        <h3 className="text-sm font-black text-slate-900 mt-1">Log Today's Body Weight</h3>
                      </div>
                      <button 
                        onClick={() => setShowWeightModal(false)} 
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[8px] font-bold text-slate-400 mb-1.5 uppercase">Weight (kg)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="70.0" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-900 pr-12 text-xs"
                            value={weightInputVal}
                            onChange={(e) => setWeightInputVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogWeight(weightInputVal)}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleLogWeight(weightInputVal)}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl shadow-sm transition active:scale-95"
                      >
                        Log Weight Entry
                      </button>
                      <button
                        onClick={() => { setShowWeightModal(false); setWeightInputVal(''); }}
                        className="px-4 py-2.5 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-xl hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* LIVE STUDIO VIEW */}
          {view === 'studio' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
              <div className="lg:col-span-2 space-y-4">
                <div className="card-elevated bg-white p-5 space-y-4 rounded-2xl">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusDotClass(workoutStatus)}`} />
                      <span className="font-bold text-slate-800 text-sm">
                        {telemetry?.exercise_name || (activeCircuit?.exercises?.[activeCircuitIndex]?.exercise_name) || 'Push-Up'}
                      </span>
                      <span className={`text-[10px] border font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                        workoutStatus === 'STREAMING' ? 'bg-red-50 text-red-600 border-red-200' :
                        workoutStatus === 'CONNECTING' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        workoutStatus === 'PAUSED' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                        workoutStatus === 'ERROR' ? 'bg-red-100 text-red-700 border-red-300' :
                        'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>{workoutStatus}</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold">Mode:</span>
                        <select 
                          value={workoutMode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWorkoutMode(val);
                            // If currently streaming, restart the set with new mode
                            if (workoutStatus === 'STREAMING' || workoutStatus === 'CONNECTING') {
                              startWorkoutSet(telemetry?.exercise_type || 'pushup');
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-bold focus:outline-none"
                        >
                          <option value="websocket">Trained AI (WebSocket)</option>
                          <option value="local">Trained Local AI</option>
                          <option value="server">Server Feed (Legacy)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold">Exercise:</span>
                        <select 
                          value={telemetry?.exercise_type || (activeCircuit?.exercises?.[activeCircuitIndex]?.exercise_type) || 'pushup'}
                          onChange={(e) => startWorkoutSet(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-bold focus:outline-none"
                        >
                          <option value="pushup">Push-Up</option>
                          <option value="squat">Squat</option>
                          <option value="jumping_jack">Jumping Jack</option>
                          {(workoutMode === 'local' || workoutMode === 'websocket') && (
                            <>
                              <option value="lunge">Lunge</option>
                              <option value="plank">Plank</option>
                              <option value="burpee">Burpee</option>
                            </>
                          )}
                        </select>
                      </div>
                      {workoutMode === 'server' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">Input Device:</span>
                          <select 
                            value={selectedCamera}
                            onChange={(e) => handleSelectCamera(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-bold focus:outline-none"
                          >
                            {cameras.map((idx) => (
                              <option key={idx} value={idx}>Webcam {idx}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Streaming canvas */}
                  <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-inner">
                    {(workoutMode === 'local' || workoutMode === 'websocket') ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                        <canvas
                          ref={canvasRef}
                          className="absolute top-0 left-0 w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      </>
                    ) : (
                      <img 
                        src={`${API_BASE}/api/video_feed`} 
                        alt="Webcam Stream" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = ''; e.target.onerror = null; }}
                      />
                    )}
                    <div className="absolute top-4 left-4 bg-black/75 backdrop-blur-sm text-white text-[10px] font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-md">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-soft" />
                      FPS: {telemetry?.fps !== undefined ? telemetry.fps.toFixed(1) : '0.0'}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border flex items-center gap-3 font-bold text-xs transition-all ${
                    workoutStatus === 'ERROR' || workoutStatus === 'CONNECTING' || (telemetry && !telemetry.camera_online) || (telemetry && !telemetry.is_form_valid)
                      ? 'bg-red-50 border-red-100 text-red-700' 
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    {workoutStatus === 'ERROR' || workoutStatus === 'CONNECTING' || (telemetry && !telemetry.camera_online) || (telemetry && !telemetry.is_form_valid)
                      ? <AlertCircle size={16} /> 
                      : <CheckCircle2 size={16} />}
                    <span>
                      {workoutStatus === 'ERROR' 
                        ? 'Live analysis connection lost.' 
                        : workoutStatus === 'CONNECTING' 
                        ? 'CONNECTING — Initializing video feed...' 
                        : telemetry && !telemetry.camera_online 
                        ? 'Unable to access camera. Camera permission is required for Live Studio.' 
                        : telemetry?.is_form_valid 
                        ? 'FORM COMPLIANT — Posture is bio-mechanically optimal' 
                        : (telemetry?.form_error || 'ADJUST FORM — skeletal angle threshold violation')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Telemetry metrics column */}
              <div className="space-y-4">
                
                {/* Rep counter card */}
                <div className="card-elevated bg-white p-5 flex items-center justify-between rounded-2xl">
                  <div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Completed Reps</span>
                    <span className="text-5xl font-black text-slate-900 tracking-tight leading-none mt-1.5 block">{telemetry?.total_reps || 0}</span>
                  </div>
                  <div className="text-right space-y-1.5">
                    <span className="inline-block text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg">
                      {telemetry?.valid_reps || 0} Valid
                    </span>
                    <span className="block text-xs font-bold bg-red-50 border border-red-100 text-red-500 px-3 py-1.5 rounded-lg">
                      {telemetry?.invalid_reps || 0} Faulty
                    </span>
                  </div>
                </div>

                {/* Biomechanics detail */}
                <div className="card-elevated bg-white p-5 space-y-4 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Biomechanics HUD</span>
                    <span className="font-mono text-xs font-black text-indigo-600">
                      {Math.floor((telemetry?.duration_sec || 0)/60).toString().padStart(2, '0')}:{(Math.floor(telemetry?.duration_sec || 0)%60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-slate-50 border-4 border-indigo-50 text-indigo-600 font-black text-lg">
                      {telemetry?.form_score_pct || 100}%
                    </div>
                    <div className="flex-1 space-y-3">
                      {[
                        { label: 'Joint Angle', val: telemetry?.current_angle || 180, max: 180, unit: '°' },
                        { label: 'Avg ROM', val: telemetry?.avg_rom || 0, max: 120, unit: '°' },
                        { label: 'Torso Incline', val: telemetry?.torso_inclination_angle || 0, max: 90, unit: '°' }
                      ].map((metric) => (
                        <div key={metric.label} className="text-xs">
                          <div className="flex justify-between font-bold text-slate-600 mb-1">
                            <span>{metric.label}</span>
                            <span>{metric.val}{metric.unit}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (metric.val / metric.max) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Burn rate info */}
                <div className="card-elevated bg-white p-5 space-y-3 rounded-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Burn Rate</span>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${telemetry?.intensity === 'HIGH' ? 'bg-red-50 text-red-500' : (telemetry?.intensity === 'MEDIUM' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400')}`}>
                      {telemetry?.intensity || 'IDLE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">{(telemetry?.burn_rate_kcal_min || 0.0).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 block font-semibold mt-1">kcal/min burn rate</span>
                  </div>
                </div>

                {/* Session control buttons */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleTogglePause}
                      className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-xs border border-slate-200 active:scale-95"
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button 
                      onClick={handleResetWorkout}
                      className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-xs border border-slate-200 active:scale-95"
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                  <button 
                    onClick={handleEndWorkout}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs active:scale-95"
                  >
                    <CheckCircle2 size={16} /> End Set & Analyze
                  </button>
                </div>

                {/* Set summary details */}
                {summary && (
                  <div className="card-elevated p-4 space-y-3 bg-indigo-50/50 border-indigo-200 scale-in rounded-2xl">
                    <h3 className="font-black text-indigo-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} /> Set Analysis
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Reps</span>
                        <strong className="text-slate-800 text-sm">{summary.total_reps} ({summary.valid_reps} clean)</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Calories</span>
                        <strong className="text-emerald-600 text-sm">{summary.kcal_point.toFixed(1)} kcal</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Form accuracy</span>
                        <strong className="text-slate-800 text-sm">{summary.form_score_pct}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Duration</span>
                        <strong className="text-slate-800 text-sm">{summary.duration_sec}s</strong>
                      </div>
                    </div>
                    <button 
                      onClick={handleNextCircuitExercise}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all hover:shadow-md flex items-center justify-center gap-2 active:scale-95"
                    >
                      Next Exercise <ArrowRight size={14} />
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* PROFILE VIEW */}
          {view === 'profile' && (
            <div className="space-y-6 fade-in max-w-6xl mx-auto pb-10">
              {/* Profile Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-[#6345FF] via-[#7C3AED] to-[#8B5CF6] text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-5 relative z-10">
                  <div className="relative group">
                    {auth?.photoURL || profile?.avatar ? (
                      <img 
                        src={auth?.photoURL || profile?.avatar} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-600 border-2 border-white/20 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                        {(auth?.name || profile?.name || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <button 
                      title="Change Picture"
                      onClick={() => {
                        const newUrl = prompt("Enter Image URL for profile avatar:", profile?.avatar || auth?.photoURL || "");
                        if (newUrl) {
                          setProfile(prev => ({ ...prev, avatar: newUrl }));
                        }
                      }}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition active:scale-95 border border-white/20"
                    >
                      <Camera size={14} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-2xl font-black tracking-tight">{profile?.name || auth?.name || 'Athlete'}</h2>
                      <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {profile?.fitness_goal || 'Athlete'}
                      </span>
                    </div>
                    <p className="text-xs text-indigo-200/80 font-medium">{profile?.email || auth?.email || 'athlete@burnex.app'}</p>
                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <span className="bg-white/10 text-white font-extrabold px-3 py-1 rounded-xl backdrop-blur-md border border-white/10">
                        Level {profile?.level || 1}
                      </span>
                      <span className="text-indigo-200/90 font-bold text-xs">
                        {profile?.xp || 0} Total XP
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                  <button
                    onClick={async () => {
                      await saveProfile(selectedGoal);
                      alert("Profile changes saved successfully!");
                    }}
                    className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow-md transition-all text-xs flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 size={16} /> Save Changes
                  </button>
                </div>
              </div>

              {/* Main 2-Column Section */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left Profile Navigation */}
                <div className="md:col-span-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex md:flex-col overflow-x-auto gap-1">
                  {[
                    { id: 'overview', label: 'Overview', icon: User, desc: 'Stats & Progression' },
                    { id: 'personal', label: 'Personal Info', icon: Shield, desc: 'Biometrics & Details' },
                    { id: 'account', label: 'Account Settings', icon: Sliders, desc: 'Theme, Language & Units' },
                    { id: 'security', label: 'Security', icon: Lock, desc: 'Password & Sessions' },
                    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Reminders & Alerts' },
                    { id: 'privacy', label: 'Privacy', icon: Eye, desc: 'Visibility & Export' },
                    { id: 'preferences', label: 'Preferences', icon: Target, desc: 'Goals & Training' },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = profileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setProfileTab(tab.id)}
                        className={`w-full px-3.5 py-3 rounded-xl text-left transition-all duration-150 flex items-center gap-3 whitespace-nowrap ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                        }`}
                      >
                        <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                        <div className="min-w-0 hidden md:block">
                          <span className="text-xs block leading-tight">{tab.label}</span>
                          <span className={`text-[10px] block font-normal truncate mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{tab.desc}</span>
                        </div>
                        <span className="text-xs md:hidden">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Content Area */}
                <div className="md:col-span-9 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                  {/* OVERVIEW TAB */}
                  {profileTab === 'overview' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Profile Overview</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Your fitness progression breakdown and session metrics</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Level Progress */}
                        <div className="card-elevated bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 md:col-span-1 space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Progression Level</h4>
                          <div className="text-center py-2">
                            <span className="text-5xl font-black text-indigo-600 leading-none">{profile?.level || 1}</span>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Rank Tier</p>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                              <span>XP: {profile?.xp || 0}</span>
                              <span>Next: {((profile?.level || 1) ** 2) * 100} XP</span>
                            </div>
                            <div className="w-full h-3 bg-slate-200/60 rounded-full overflow-hidden border border-slate-200 p-[1px]">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                                style={{
                                  width: `${(() => {
                                    const lvl = profile?.level || 1;
                                    const xp = profile?.xp || 0;
                                    const prevMin = (lvl - 1) ** 2 * 100;
                                    const nextMin = lvl ** 2 * 100;
                                    const diff = nextMin - prevMin;
                                    return diff > 0 ? Math.min(100, Math.max(0, ((xp - prevMin) / diff) * 100)) : 0;
                                  })()}%`
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 text-center font-semibold">
                              {((profile?.level || 1) ** 2) * 100 - (profile?.xp || 0)} XP needed for Level {(profile?.level || 1) + 1}
                            </p>
                          </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="card-elevated bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 md:col-span-2 space-y-4">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">All-Time Statistics</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl text-center shadow-sm">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Workouts</span>
                              <strong className="text-lg font-black text-slate-800 block mt-1">{profile?.total_workouts || history?.length || 0}</strong>
                            </div>
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl text-center shadow-sm">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Total Reps</span>
                              <strong className="text-lg font-black text-slate-800 block mt-1">{profile?.total_reps || 0}</strong>
                            </div>
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl text-center shadow-sm">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Calories</span>
                              <strong className="text-lg font-black text-orange-600 block mt-1">{Math.round(profile?.total_calories || 0)} kcal</strong>
                            </div>
                            <div className="bg-white border border-slate-200/80 p-3.5 rounded-xl text-center shadow-sm">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Streak</span>
                              <strong className="text-lg font-black text-emerald-600 block mt-1">{profile?.current_streak || streakInfo?.current || 0} Days</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* History Log */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Recent Workout Sessions</h4>
                        {historyLoading ? (
                          <div className="text-center py-6 text-slate-400 font-bold text-xs">Loading workout history...</div>
                        ) : history.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-xl">No workout sessions logged yet. Head to Live Studio to start!</div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase">
                                  <th className="py-3 px-4">Timestamp</th>
                                  <th className="py-3 px-4">Exercise</th>
                                  <th className="py-3 px-4">Duration</th>
                                  <th className="py-3 px-4 text-center">Reps</th>
                                  <th className="py-3 px-4 text-center">Form Score</th>
                                  <th className="py-3 px-4 text-right">Calories</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.slice(0, 5).map((s, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition text-xs text-slate-700 font-semibold">
                                    <td className="py-3 px-4">{s.timestamp}</td>
                                    <td className="py-3 px-4 font-bold text-slate-800">{s.exercise_name}</td>
                                    <td className="py-3 px-4">{Math.round(s.duration_sec)}s</td>
                                    <td className="py-3 px-4 text-center">{s.total_reps} (<span className="text-indigo-600 font-bold">{s.valid_reps}</span>)</td>
                                    <td className="py-3 px-4 text-center">
                                      <span className={`px-2 py-0.5 rounded font-bold ${s.form_score_pct >= 90 ? 'bg-emerald-50 text-emerald-600' : s.form_score_pct >= 70 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                        {Math.round(s.form_score_pct)}%
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-black text-orange-600">{Math.round(s.kcal_point || s.predicted_kcal || 0)} kcal</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* PERSONAL INFORMATION TAB */}
                  {profileTab === 'personal' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Personal Information</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Manage your identity, body metrics, and contact details</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Full Name</label>
                          <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 text-sm" 
                            value={profile?.name || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Athlete Name"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Date of Birth</label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 text-sm" 
                            value={profile?.dob || ''}
                            onChange={(e) => setProfile(prev => ({ ...prev, dob: e.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Age</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                              value={profile?.age ?? ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, age: e.target.value ? Number(e.target.value) : '' }))}
                              placeholder="25"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">yrs</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Gender</label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 text-sm"
                            value={profile?.gender || 'male'}
                            onChange={(e) => setProfile(prev => ({ ...prev, gender: e.target.value }))}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="non-binary">Non-binary</option>
                            <option value="prefer-not-to-say">Prefer not to say</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Height</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                              value={profile?.height_cm ?? ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, height_cm: e.target.value ? Number(e.target.value) : '' }))}
                              placeholder="175"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">cm</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Body Weight</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 pr-12 text-sm" 
                              value={profile?.weight_kg ?? ''}
                              onChange={(e) => setProfile(prev => ({ ...prev, weight_kg: e.target.value ? Number(e.target.value) : '' }))}
                              placeholder="70"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Mobile Number</label>
                          <IndianPhoneInput 
                            value={profile?.mobile || ''}
                            onChange={(val) => setProfile(prev => ({ ...prev, mobile: val }))}
                            placeholder="9876543210"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Alternate Mobile Number</label>
                          <IndianPhoneInput 
                            value={profile?.alt_mobile || ''}
                            onChange={(val) => setProfile(prev => ({ ...prev, alt_mobile: val }))}
                            placeholder="9876543210"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={async () => {
                            await saveProfile(selectedGoal);
                            alert("Personal Information updated successfully!");
                          }}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 text-xs active:scale-95"
                        >
                          <CheckCircle2 size={16} /> Save Personal Information
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ACCOUNT SETTINGS TAB */}
                  {profileTab === 'account' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Account Settings</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Customize your interface theme, language, and measurement units</p>
                      </div>

                      <div className="space-y-6">
                        {/* Theme Preference */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-3 uppercase">Application Theme</label>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: 'light', label: 'Light', icon: Sun, desc: 'Clean & Bright' },
                              { id: 'dark', label: 'Dark', icon: Moon, desc: 'Low Light OLED' },
                              { id: 'system', label: 'System', icon: Laptop, desc: 'Match Device' }
                            ].map(t => {
                              const Icon = t.icon;
                              const isSelected = (profile?.theme || 'light') === t.id;
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => setProfile(prev => ({ ...prev, theme: t.id }))}
                                  className={`p-4 rounded-xl border text-left transition-all ${
                                    isSelected
                                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                      : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/60'
                                  }`}
                                >
                                  <Icon size={20} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                                  <span className="text-xs font-bold text-slate-800 block mt-2">{t.label}</span>
                                  <span className="text-[10px] text-slate-400 font-medium block">{t.desc}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Language */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Language</label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-semibold text-slate-900 text-sm"
                            value={profile?.language || 'en'}
                            onChange={(e) => setProfile(prev => ({ ...prev, language: e.target.value }))}
                          >
                            <option value="en">English (US)</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="hi">Hindi (हिंदी)</option>
                          </select>
                        </div>

                        {/* Units */}
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Measurement Units</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setProfile(prev => ({ ...prev, units: 'metric' }))}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                (profile?.units || 'metric') === 'metric'
                                  ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <span className="text-xs font-bold text-slate-900 block">Metric System</span>
                              <span className="text-[10px] text-slate-500 block">Kilograms (kg), Centimeters (cm)</span>
                            </button>
                            <button
                              onClick={() => setProfile(prev => ({ ...prev, units: 'imperial' }))}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                profile?.units === 'imperial'
                                  ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <span className="text-xs font-bold text-slate-900 block">Imperial System</span>
                              <span className="text-[10px] text-slate-500 block">Pounds (lbs), Inches (in)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECURITY TAB */}
                  {profileTab === 'security' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Security & Authentication</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Manage your credentials, connected accounts, and active device sessions</p>
                      </div>

                      {/* Change Password */}
                      <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Key size={14} className="text-indigo-600" /> Change Password
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input 
                            type="password" 
                            placeholder="Current Password" 
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                          />
                          <input 
                            type="password" 
                            placeholder="New Password" 
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                          />
                          <input 
                            type="password" 
                            placeholder="Confirm New Password" 
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button 
                          onClick={() => alert("Password update confirmation sent.")}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
                        >
                          Update Password
                        </button>
                      </div>

                      {/* Connected Accounts */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Connected Third-Party Accounts</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { name: 'Google Workspace', connected: true },
                            { name: 'Apple ID', connected: false },
                            { name: 'Strava Sync', connected: true },
                            { name: 'Garmin Connect', connected: false }
                          ].map(acc => (
                            <div key={acc.name} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl">
                              <span className="text-xs font-bold text-slate-800">{acc.name}</span>
                              <button 
                                onClick={() => alert(`${acc.connected ? 'Disconnected' : 'Connected'} ${acc.name}`)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black transition ${
                                  acc.connected ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {acc.connected ? 'Connected' : 'Connect'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Active Sessions */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Active Device Sessions</h4>
                        <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Current Web Browser Session</span>
                            <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Windows PC · Chrome · Active Now</span>
                          </div>
                          <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md border border-emerald-200/60">Active Session</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NOTIFICATIONS TAB */}
                  {profileTab === 'notifications' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Notification Preferences</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Manage how and when Burn-Ex sends you daily alerts</p>
                      </div>

                      <div className="space-y-4">
                        {[
                          { title: 'Workout Reminders', desc: 'Get daily reminders when your scheduled workout time approaches.', active: true },
                          { title: 'Achievement Alerts', desc: 'Notify me when I level up or unlock new badges.', active: true },
                          { title: 'Email Digest & Reports', desc: 'Send weekly performance analytics summary to my email.', active: false },
                          { title: 'Community Leaderboard Updates', desc: 'Alert me when someone overtakes my position on global ranks.', active: true }
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/60 border border-slate-200/70 rounded-xl">
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{item.title}</span>
                              <span className="text-[10px] text-slate-500 font-medium block mt-0.5 max-w-md">{item.desc}</span>
                            </div>
                            <input type="checkbox" defaultChecked={item.active} className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PRIVACY TAB */}
                  {profileTab === 'privacy' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Privacy & Data Management</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Control data visibility and export your fitness statistics</p>
                      </div>

                      <div className="space-y-5">
                        {/* Data Export */}
                        <div className="p-5 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-3">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Download size={14} className="text-indigo-600" /> Export Personal Data
                          </h4>
                          <p className="text-xs text-slate-500">Download a full JSON archive of your workout history, telemetry logs, and profile metrics.</p>
                          <button 
                            onClick={() => {
                              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile || {}, null, 2));
                              const downloadAnchor = document.createElement('a');
                              downloadAnchor.setAttribute("href", dataStr);
                              downloadAnchor.setAttribute("download", "burnex_profile_data.json");
                              document.body.appendChild(downloadAnchor);
                              downloadAnchor.click();
                              downloadAnchor.remove();
                            }}
                            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-800 text-xs rounded-xl shadow-sm transition flex items-center gap-2"
                          >
                            <Download size={14} /> Download Fitness Data (.json)
                          </button>
                        </div>

                        {/* Danger Zone */}
                        <div className="p-5 bg-red-50/50 border border-red-200 rounded-2xl space-y-3">
                          <h4 className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-2">
                            <Trash2 size={14} className="text-red-600" /> Danger Zone
                          </h4>
                          <p className="text-xs text-red-600/80 font-medium">Permanently delete your Burn-Ex account and clear all associated workout history.</p>
                          <button 
                            onClick={() => {
                              if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
                                handleLogout();
                              }
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition"
                          >
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PREFERENCES TAB */}
                  {profileTab === 'preferences' && (
                    <div className="space-y-6 fade-in">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-black text-slate-900">Training & Goal Preferences</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Calibrate AI target goal tracks and exercise preferences</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Primary Fitness Goal Track</label>
                          <select 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition font-bold text-slate-900 text-sm"
                            value={selectedGoal}
                            onChange={(e) => setSelectedGoal(e.target.value)}
                          >
                            {GOAL_PROGRAMS.map(g => (
                              <option key={g.value} value={g.value}>{g.title}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Preferred Session Length</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 text-sm">
                            <option value="15">15 Minutes (Express)</option>
                            <option value="30">30 Minutes (Standard)</option>
                            <option value="45">45 Minutes (Intense)</option>
                            <option value="60">60 Minutes (Elite)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Available Equipment</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 text-sm">
                            <option value="bodyweight">Bodyweight Only</option>
                            <option value="dumbbells">Dumbbells & Resistance Bands</option>
                            <option value="full_gym">Full Gym Access</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Rest Timer Duration</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 text-sm">
                            <option value="30">30 Seconds</option>
                            <option value="45">45 Seconds</option>
                            <option value="60">60 Seconds</option>
                            <option value="90">90 Seconds</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Target Intensity Level</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 text-sm">
                            <option value="light">Light & Recoverable</option>
                            <option value="moderate">Moderate & Steady</option>
                            <option value="high">High Intensity (HIIT)</option>
                            <option value="max">Max Effort (VBT)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={async () => {
                            await saveProfile(selectedGoal);
                            alert("Training preferences and target goals updated!");
                          }}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 text-xs active:scale-95"
                        >
                          <CheckCircle2 size={16} /> Save Preferences & Re-calibrate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS VIEW */}
          {view === 'analytics' && (
            <AnalyticsPage auth={auth} history={history} />
          )}

          {/* LEADERBOARD VIEW */}
          {view === 'leaderboard' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Global Leaderboards</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Compete with athletes worldwide across five metric spaces</p>
                </div>
                <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/40">
                  {[
                    { id: 'global', label: 'Global XP' },
                    { id: 'weekly', label: 'Weekly XP' },
                    { id: 'monthly', label: 'Monthly XP' },
                    { id: 'calories', label: 'Calories' },
                    { id: 'reps', label: 'Total Reps' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setLeaderboardType(tab.id);
                        fetchLeaderboard(tab.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        leaderboardType === tab.id 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Leaderboard user rank overlay */}
              {(() => {
                const myRank = leaderboard.find(x => x.user_id === auth?.uid);
                if (!myRank) return null;
                return (
                  <div className="card-elevated bg-gradient-to-r from-[#6345FF] to-[#8B5CF6] p-5 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-[#6345FF]/20">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-extrabold text-lg">
                        #{myRank.rank}
                      </div>
                      <div>
                        <strong className="text-sm font-black block">Your Position</strong>
                        <span className="text-[10px] font-bold text-indigo-100/90 block">Level {myRank.level} • {myRank.xp} XP</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-indigo-100/80 uppercase block">Weekly XP</span>
                      <strong className="text-xl font-black leading-none block">{myRank.weekly_xp} XP</strong>
                    </div>
                  </div>
                );
              })()}

              <div className="card-elevated bg-white p-6 rounded-2xl space-y-4">
                {leaderboardLoading ? (
                  <div className="text-center py-10 text-slate-400 font-bold text-xs">Fetching rankings...</div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-xl">No players in this leaderboard yet.</div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((u, index) => {
                      const isMe = u.user_id === auth?.uid;
                      const rankColor = 
                        u.rank === 1 ? 'bg-amber-100 text-amber-600 border-amber-200 font-extrabold' :
                        u.rank === 2 ? 'bg-slate-100 text-slate-500 border-slate-200 font-extrabold' :
                        u.rank === 3 ? 'bg-orange-100 text-orange-600 border-orange-200 font-extrabold' :
                        'bg-slate-50 text-slate-400 border-slate-100';

                      return (
                        <div 
                          key={index} 
                          className={`flex items-center justify-between p-3.5 border rounded-2xl transition-all duration-200 ${
                            isMe 
                              ? 'bg-indigo-50/50 border-indigo-200 shadow-sm shadow-indigo-500/5' 
                              : 'bg-white hover:bg-slate-50/40 border-slate-100/80'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs border ${rankColor}`}>
                              {u.rank}
                            </div>
                            <img src={u.avatar} alt="Avatar" className="w-9 h-9 rounded-xl border border-slate-100 bg-slate-50" />
                            <div>
                              <strong className={`text-sm font-bold block ${isMe ? 'text-indigo-600' : 'text-slate-800'}`}>
                                {u.username} {isMe && <span className="text-[9px] bg-indigo-100 text-indigo-600 font-extrabold px-2 py-0.5 rounded-full ml-1 uppercase">You</span>}
                              </strong>
                              <span className="text-[10px] font-semibold text-slate-400 block">Level {u.level}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            {leaderboardType === 'calories' && (
                              <div>
                                <strong className="text-sm font-black text-orange-600 block">{Math.round(u.calories)}</strong>
                                <span className="text-[9px] text-slate-400 font-bold block">Calories Burned</span>
                              </div>
                            )}
                            {leaderboardType === 'reps' && (
                              <div>
                                <strong className="text-sm font-black text-indigo-600 block">{u.total_reps}</strong>
                                <span className="text-[9px] text-slate-400 font-bold block">Total Reps</span>
                              </div>
                            )}
                            {leaderboardType === 'global' && (
                              <div>
                                <strong className="text-sm font-black text-indigo-600 block">{u.xp} XP</strong>
                                <span className="text-[9px] text-slate-400 font-bold block">Total XP</span>
                              </div>
                            )}
                            {leaderboardType === 'weekly' && (
                              <div>
                                <strong className="text-sm font-black text-indigo-600 block">{u.weekly_xp} XP</strong>
                                <span className="text-[9px] text-slate-400 font-bold block">Weekly XP</span>
                              </div>
                            )}
                            {leaderboardType === 'monthly' && (
                              <div>
                                <strong className="text-sm font-black text-indigo-600 block">{u.monthly_xp} XP</strong>
                                <span className="text-[9px] text-slate-400 font-bold block">Monthly XP</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACHIEVEMENTS VIEW */}
          {view === 'achievements' && (
            <div className="space-y-6 fade-in">
              <div>
                <h2 className="text-xl font-black text-slate-900">Milestone Achievements</h2>
                <p className="text-slate-500 text-sm mt-0.5">Collect XP bonuses by conquering workout landmarks</p>
              </div>

              {/* Unlocked Summary banner */}
              <div className="card-elevated bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shadow-inner"><Award size={24} /></div>
                  <div>
                    <strong className="text-slate-800 text-sm font-black block">Badges Collected</strong>
                    <span className="text-[10px] font-bold text-slate-400 block">Unlock all challenges to gain +1000 XP master bonus!</span>
                  </div>
                </div>
                <div>
                  <strong className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                    {achievements.filter(x => x.unlocked).length} <span className="text-xs text-slate-400 font-bold">/ {achievements.length}</span>
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {achievementsLoading ? (
                  <div className="col-span-full text-center py-10 text-slate-400 font-bold text-xs">Loading achievement vault...</div>
                ) : achievements.map((a, idx) => {
                  const unlockedColor = "from-amber-400 to-orange-500 shadow-amber-500/15";
                  const lockedColor = "from-slate-200 to-slate-300";

                  return (
                    <div 
                      key={a.id || idx} 
                      className={`card-elevated p-5 rounded-2xl border flex flex-col justify-between h-[180px] transition duration-300 ${
                        a.unlocked 
                          ? 'bg-white border-amber-200 shadow-md' 
                          : 'bg-slate-50/50 border-slate-200/60 opacity-60'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-extrabold shadow-sm ${a.unlocked ? unlockedColor : lockedColor}`}>
                          <Award size={18} />
                        </div>
                        {a.unlocked ? (
                          <span className="bg-emerald-50 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-wide">Unlocked</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-slate-200/50 uppercase tracking-wide">Locked</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <strong className="text-slate-800 text-xs font-black block">{a.name}</strong>
                        <p className="text-[10px] text-slate-400 font-bold line-clamp-2 leading-relaxed">{a.description}</p>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                        <span className="text-[9px] font-extrabold text-indigo-600 uppercase">+{a.xp_bonus} XP Reward</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN VIEW */}
          {view === 'admin' && (
            <div className="space-y-6 fade-in">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <ShieldAlert size={20} className="text-indigo-600" />
                  Admin Control Center
                </h2>
                <p className="text-slate-500 text-sm mt-0.5 font-medium">Platform-wide metrics and system health overview</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Platform Users', value: adminMetrics?.total_users || 0, icon: Users, color: 'indigo' },
                  { label: 'Workouts Logged', value: adminMetrics?.total_sessions || 0, icon: Activity, color: 'emerald' },
                  { label: 'Total Burn', value: `${(adminMetrics?.total_kcal_burned_platform || 0).toFixed(1)} kcal`, icon: Flame, color: 'orange' },
                  { label: 'Failure Rate', value: `${(adminMetrics?.mediapipe_failure_rate_pct || 0.0).toFixed(1)}%`, icon: AlertCircle, color: 'red' },
                ].map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <div key={i} className="card-elevated bg-white p-5 rounded-2xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{m.label}</span>
                        <Icon size={16} className={`text-indigo-500`} />
                      </div>
                      <span className="text-2xl font-black text-slate-900 block mt-1">
                        {m.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="card-elevated bg-white p-6 rounded-2xl">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider mb-4">Registered Athletes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        <th className="pb-3">User ID</th>
                        <th className="pb-3">Alias</th>
                        <th className="pb-3 text-center">Age</th>
                        <th className="pb-3">Goal</th>
                        <th className="pb-3 text-center">Sets</th>
                        <th className="pb-3 text-right">Total Burn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {adminUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">No registered athletes found</td>
                        </tr>
                      ) : (
                        adminUsers.map((user, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 font-mono text-xs text-slate-400">{user.uid}</td>
                            <td className="py-3 font-bold text-slate-800">{user.name}</td>
                            <td className="py-3 text-center text-slate-600">{user.age}</td>
                            <td className="py-3">
                              <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100/50 px-2.5 py-1 rounded-lg">{user.goal}</span>
                            </td>
                            <td className="py-3 text-center font-semibold text-slate-700">{user.sessions_count}</td>
                            <td className="py-3 text-right font-bold text-emerald-600">{user.total_kcal.toFixed(1)} kcal</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ─── FLOATING CHAT BUTTON (outside chat view) ─── */}
        {view !== 'dashboard' && view !== 'login' && view !== 'onboarding' && view !== 'ai_coach' && profile?.fitness_goal && (
          <>
            {isChatOpen && (
              <div className="fixed bottom-24 right-6 w-96 card-elevated bg-white flex flex-col z-50 shadow-2xl scale-in rounded-2xl h-[420px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><Bot size={14} /></div>
                    <span className="font-bold text-slate-900 text-sm">AI Coach</span>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-slate-600 transition text-sm font-bold">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className={`max-w-[85%] p-3 text-[11px] leading-relaxed ${m.role === 'coach' ? 'bg-slate-100 border border-slate-200 text-slate-700 mr-auto rounded-xl rounded-bl-xs' : 'bg-indigo-600 text-white ml-auto rounded-xl rounded-br-xs'}`}>
                      {m.text}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="bg-slate-100 mr-auto p-3 flex items-center gap-2 w-fit rounded-xl rounded-bl-xs border border-slate-200">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="p-3 border-t border-slate-100 flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ask your coach..." 
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition font-medium"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  />
                  <button 
                    onClick={() => handleSendChatMessage()}
                    disabled={!chatInput.trim()}
                    className="p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-40 transition active:scale-95 flex items-center justify-center"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:scale-105 transition-all z-50 active:scale-95"
            >
              <MessageCircle size={22} />
            </button>
          </>
        )}

        {/* ─── FOOTER ─── */}
        <footer className="bg-white border-t border-slate-200/80 py-5 text-center mt-auto">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Burn-Ex · Privacy-Preserving Fitness intelligence · Processed locally on-device
          </p>
        </footer>

      </div>

      {/* Pre-Workout Safety & Positioning Confirmation Modal */}
      <PreWorkoutModal
        isOpen={isPreWorkoutModalOpen}
        exerciseName={((SAFE_EXERCISE_CONFIGS && SAFE_EXERCISE_CONFIGS[pendingExerciseRef.current]) || {}).name || (pendingExerciseRef.current || 'Push-up').replace('_', ' ').toUpperCase()}
        onClose={() => setIsPreWorkoutModalOpen(false)}
        onConfirmStart={handleConfirmPreWorkoutStart}
      />

      {/* End Workout Confirmation Modal */}
      {isEndWorkoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">End Workout?</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Are you sure you want to end this workout session?</p>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
              Your completed reps, calories burned, and form accuracy will be calculated and saved to your history.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEndWorkoutConfirmOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Continue Workout
              </button>

              <button
                type="button"
                onClick={_confirmEndWorkout}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-lg shadow-red-600/20 transition active:scale-95"
              >
                End Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Workout Start & Resume Countdown System */}
      <WorkoutCountdown
        status={countdown.status}
        secondsLeft={countdown.secondsLeft}
        totalSeconds={countdown.totalSeconds}
        exerciseName={countdown.exerciseName}
        bodyDetected={countdown.bodyDetected}
        bodyConfidence={countdown.bodyConfidence}
        isMuted={countdown.isMuted}
        onToggleMute={countdown.toggleMute}
        onCancel={countdown.cancelCountdown}
      />

      {/* Burn-Ex Pro Subscription & Razorpay Modal */}
      <BurnExProModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
        subscription={subscription}
        onTrialStarted={(sub) => {
          setSubscription(sub);
          fetchSubscriptionStatus();
        }}
        onPaymentSuccess={(sub) => {
          setSubscription(sub);
          fetchSubscriptionStatus();
        }}
        token={auth?.token}
        apiBaseUrl={API_BASE}
      />
    </div>
  );
}
