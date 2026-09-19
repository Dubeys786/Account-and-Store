import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'blue';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  const variantStyles = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/60 font-medium',
    error: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-medium',
    info: 'bg-sky-50 text-sky-700 border border-sky-200/60 font-medium',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
