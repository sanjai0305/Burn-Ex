import React from 'react';

/**
 * Authentic India Flag SVG component with saffron, white, green bands and 24-spoke navy Ashoka Chakra
 */
export function IndiaFlag({ className = "w-5 h-3.5" }) {
  return (
    <svg 
      className={`${className} rounded-xs shadow-2xs border border-slate-200/80 inline-block flex-shrink-0`} 
      viewBox="0 0 640 480" 
      aria-label="India (+91)"
      role="img"
    >
      <path fill="#FF9933" d="M0 0h640v160H0z"/>
      <path fill="#FFFFFF" d="M0 160h640v160H0z"/>
      <path fill="#138808" d="M0 320h640v160H0z"/>
      <g transform="translate(320 240)">
        <circle r="70" fill="none" stroke="#000080" strokeWidth="8"/>
        <circle r="14" fill="#000080"/>
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            y1="0"
            x2="0"
            y2="-70"
            stroke="#000080"
            strokeWidth="3.5"
            transform={`rotate(${i * 15})`}
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Extracts the 10-digit local Indian mobile number from any raw input format
 * e.g. "+919876543210", "919876543210", "09876543210", "9876543210" -> "9876543210"
 */
export function extractLocal10Digit(inputStr) {
  if (!inputStr) return '';
  let str = String(inputStr).trim();
  
  if (str.startsWith('+91')) {
    str = str.slice(3);
  } else if (str.startsWith('91') && str.replace(/\D/g, '').length === 12) {
    str = str.replace(/\D/g, '').slice(2);
  } else if (str.startsWith('0') && str.replace(/\D/g, '').length === 11) {
    str = str.replace(/\D/g, '').slice(1);
  }
  
  const digits = str.replace(/\D/g, '');
  return digits.slice(0, 10);
}

/**
 * Validates Indian 10-digit mobile number starting with 6, 7, 8, or 9
 */
export function validateIndianMobile(rawInput, isRequired = true) {
  const local = extractLocal10Digit(rawInput);
  if (!local) {
    if (isRequired) {
      return { valid: false, error: 'Primary mobile number is required.', local: '', normalized: '' };
    }
    return { valid: true, error: null, local: '', normalized: '' };
  }

  if (local.length < 10) {
    return { valid: false, error: 'Please enter a full 10-digit Indian mobile number.', local, normalized: '' };
  }

  if (!/^[6-9]/.test(local)) {
    return { valid: false, error: 'Indian mobile numbers must start with 6, 7, 8, or 9.', local, normalized: '' };
  }

  return { valid: true, error: null, local, normalized: `+91${local}` };
}

/**
 * Reusable Indian Phone Input component with Flag, +91 Prefix, 10-Digit restriction
 */
export default function IndianPhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = "9876543210",
  id,
  name,
  className = ""
}) {
  // Ensure the displayed value is strictly the 10-digit local number
  const localValue = extractLocal10Digit(value);

  const handleInputChange = (e) => {
    const rawVal = e.target.value;
    const sanitized = extractLocal10Digit(rawVal);
    onChange(sanitized);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = extractLocal10Digit(pastedText);
    onChange(sanitized);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 🇮🇳 +91 | Prefix Badge */}
      <div 
        className="flex items-center gap-1.5 px-3 py-3 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs select-none flex-shrink-0 shadow-2xs"
        title="India (+91)"
      >
        <IndiaFlag className="w-5 h-3.5" />
        <span className="text-slate-500 font-semibold text-[11px] hidden sm:inline">IN</span>
        <span className="text-slate-900 font-extrabold text-xs">+91</span>
        <span className="text-slate-300 font-normal ml-0.5">|</span>
      </div>

      {/* 10-Digit Input Field */}
      <input
        type="tel"
        id={id}
        name={name}
        maxLength={10}
        value={localValue}
        disabled={disabled}
        onChange={handleInputChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold text-sm tracking-wide focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition hover:bg-slate-50/50"
      />
    </div>
  );
}
