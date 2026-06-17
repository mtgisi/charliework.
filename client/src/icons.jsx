import React from 'react';

export const Mark = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--cw-ink)" />
    <path d="M9 16.5 L14 21.5 L23 11.5" stroke="var(--cw-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PinIcon = ({ filled = false, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M9.5 1.5 L14.5 6.5 L11.5 7.5 L11 11.5 L7.5 8 L3 13 L3 13 L8 8.5 L4.5 5 L8.5 4.5 Z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      fill={filled ? 'currentColor' : 'none'}
    />
  </svg>
);

export const ChevronDown = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronRight = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M4.5 3 L7.5 6 L4.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronUp = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M2.5 6 L5 3.5 L7.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronDownSmall = ({ size = 10 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M2.5 4 L5 6.5 L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const NoteIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 2.5 H8 L9.5 4 V9.5 H2.5 Z M8 2.5 V4 H9.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M4 6 H8 M4 7.5 H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

export const DragIcon = ({ size = 14 }) => (
  <svg width={size * 0.7} height={size} viewBox="0 0 10 14" fill="none" aria-hidden="true">
    <circle cx="3" cy="2.5"  r="1.2" fill="currentColor" />
    <circle cx="7" cy="2.5"  r="1.2" fill="currentColor" />
    <circle cx="3" cy="7"    r="1.2" fill="currentColor" />
    <circle cx="7" cy="7"    r="1.2" fill="currentColor" />
    <circle cx="3" cy="11.5" r="1.2" fill="currentColor" />
    <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
  </svg>
);

export const CloseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const BlockedIcon = ({ size = 14, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" fill={filled ? 'currentColor' : 'none'} />
    <path d="M5 8 H11" stroke={filled ? 'var(--cw-paper)' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const ReviewIcon = ({ size = 14, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" strokeDasharray={filled ? '0' : '2.4 1.6'} fill={filled ? 'currentColor' : 'none'} />
    <path d="M5 8.4 L7.2 10.4 L11 6.4" stroke={filled ? 'var(--cw-paper)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const QuestionIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5.6 5.5 C5.6 4.2 8.4 4.2 8.4 6.3 C8.4 7.3 7 7.6 7 8.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="7" cy="10.4" r="0.7" fill="currentColor" />
  </svg>
);
