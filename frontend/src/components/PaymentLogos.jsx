import React from 'react';

// Official Razorpay Logo
export const RazorpayLogo = ({ className = "h-5" }) => (
  <svg viewBox="0 0 120 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12.8 0L0 28H7.2L16.2 8.4L22.6 28H29.8L17.2 0H12.8Z" fill="#0C2340" />
    <path d="M7.6 15.6L12.8 4.2L17.9 15.6H7.6Z" fill="#0C2340" />
    <path d="M16.5 0L12.1 9.8L21.4 15.6L16.5 0Z" fill="#0284C7" />
    <text x="32" y="20" fill="#0C2340" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="18" letterSpacing="-0.5">Razorpay</text>
  </svg>
);

// Official UPI Logo
export const UPILogo = ({ className = "h-4" }) => (
  <svg viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M18 4L12 20H18L24 4H18Z" fill="#097939" />
    <path d="M26 4L20 20H26L32 4H26Z" fill="#ED7524" />
    <path d="M15 4L9 20H13L17 9.5L18.5 4H15Z" fill="#097939" />
    <path d="M23 4L17 20H21L25 9.5L26.5 4H23Z" fill="#ED7524" />
  </svg>
);

// Official Google Pay Logo
export const GooglePayLogo = ({ className = "h-4" }) => (
  <svg viewBox="0 0 40 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M6.9 7.9v2.5H6.1V2.8h2.2c.6 0 1.1.2 1.5.5.4.4.6.8.6 1.4 0 .5-.2 1-.6 1.3-.4.4-.9.5-1.5.5H6.9zm0-4.3v3.6h1.5c.4 0 .7-.1 1-.3.2-.2.4-.5.4-.8 0-.3-.1-.6-.4-.8-.2-.2-.6-.3-1-.3H6.9z" fill="#5F6368" />
    <path d="M13.2 5.5c.7 0 1.2.2 1.6.5.4.4.6.9.6 1.5v3.1h-.8v-.7c-.3.5-.8.8-1.4.8-.5 0-.9-.1-1.3-.4-.4-.3-.5-.7-.5-1.1 0-.5.2-.9.5-1.1.4-.3.9-.4 1.5-.4.6 0 1 .1 1.4.3v-.2c0-.3-.1-.6-.4-.8-.2-.2-.5-.3-.9-.3-.5 0-1 .2-1.3.6l-.6-.5c.5-.6 1.1-.9 1.9-.9zm-1.1 3.5c0 .2.1.4.3.6.2.1.4.2.7.2.4 0 .7-.1 1-.4.3-.3.4-.6.4-.9-.3-.2-.7-.3-1.2-.3-.4 0-.7.1-.9.3-.2.1-.3.3-.3.5z" fill="#5F6368" />
    <path d="M20.2 5.6l-2.8 6.4h-.8l1-2.3-1.8-4.1h.9l1.4 3.2 1.3-3.2h.8z" fill="#5F6368" />
    <path d="M4.3 6.3c0-.2 0-.4-.1-.6H0v1.2h2.5c-.1.6-.4 1.1-.9 1.4v1.1h1.4c.8-.8 1.3-2 1.3-3.1z" fill="#4285F4" />
    <path d="M2.2 2.3c.6 0 1.1.2 1.5.6l1.1-1.1C4.1.8 3.2.3 2.2.3.9.3-.2 1.1-.7 2.1l1.3 1c.3-.8 1-1.4 1.6-1.4z" fill="#EA4335" />
    <path d="M-.7 4.9c-.1-.3-.1-.6-.1-.9s0-.6.1-.9L-.7 2.1C-1.1 2.9-1.3 3.9-1.3 4.9s.2 2 .6 2.8l1.3-1c-.3-.5-.3-1.1-.3-1.8z" fill="#FBBC05" />
    <path d="M2.2 7.5c-.6 0-1.3-.6-1.6-1.4L-.7 7.1C-.2 8.1.9 8.9 2.2 8.9c1 0 1.9-.4 2.5-1.1L3.3 6.7c-.3.4-.7.8-1.1.8z" fill="#34A853" />
  </svg>
);

// Official PhonePe Logo
export const PhonePeLogo = ({ className = "h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="12" fill="#5F259F" />
    <path d="M14.5 7H10.5C9.67 7 9 7.67 9 8.5V17.5C9 18.05 9.45 18.5 10 18.5C10.55 18.5 11 18.05 11 17.5V14.5H13.8C15.8 14.5 17.3 12.9 17.3 10.9C17.3 8.7 16 7 14.5 7ZM13.7 12.5H11V9H13.7C14.7 9 15.3 9.8 15.3 10.7C15.3 11.7 14.6 12.5 13.7 12.5Z" fill="white" />
  </svg>
);

// Official Visa Logo
export const VisaLogo = ({ className = "h-4" }) => (
  <svg viewBox="0 0 36 12" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14.2 0.3L9.3 11.7H6.1L3.7 2.6C3.6 2.1 3.4 1.7 3 1.5C2.3 1.1 1.1 0.7 0 0.5L0.1 0.3H5.1C5.8 0.3 6.3 0.7 6.5 1.5L7.7 8.2L11.2 0.3H14.2ZM26.6 8C26.6 4.9 22.3 4.8 22.3 3.4C22.3 2.9 22.8 2.4 23.8 2.3C24.3 2.2 25.7 2.2 27.2 2.9L27.8 0.5C27 0.2 26 0 24.7 0C21.7 0 19.6 1.6 19.6 3.9C19.6 5.6 21.1 6.6 22.3 7.1C23.5 7.7 23.9 8.1 23.9 8.7C23.9 9.5 22.9 9.9 22 9.9C20.4 9.9 19.5 9.5 18.8 9.1L18.1 11.5C19 11.9 20.4 12.2 21.8 12.2C25 12.2 26.6 10.6 26.6 8ZM34.7 11.7H37.3L35 0.3H32.7C32.1 0.3 31.6 0.6 31.4 1.2L26.8 11.7H29.6L30.2 10.1H34.3L34.7 11.7ZM31 7.9L32.7 3.3L33.7 7.9H31ZM19.2 0.3L17 11.7H14.3L16.5 0.3H19.2Z" fill="#1A1F71" />
  </svg>
);

// Official Mastercard Logo
export const MastercardLogo = ({ className = "h-4" }) => (
  <svg viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="10" cy="10" r="10" fill="#EB001B" />
    <circle cx="22" cy="10" r="10" fill="#F79E1B" fillOpacity="0.9" />
    <path d="M16 3.2C18.2 5 19.5 7.4 19.5 10C19.5 12.6 18.2 15 16 16.8C13.8 15 12.5 12.6 12.5 10C12.5 7.4 13.8 5 16 3.2Z" fill="#FF5F00" />
  </svg>
);
