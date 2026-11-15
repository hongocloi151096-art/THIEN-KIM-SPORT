import { ReactNode } from 'react';

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary: 'bg-blue-700 hover:bg-blue-800 text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-sm',
    outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white',
    ghost: 'hover:bg-slate-100 text-slate-600',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    neutral: 'bg-slate-200 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  );
}

export function Select({
  value,
  onChange,
  children,
  label,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
      >
        {children}
      </select>
    </div>
  );
}

export function StatCard({
  label,
  value,
  variant = 'default',
  icon,
}: {
  label: string;
  value: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  const colors = {
    default: 'bg-white border-slate-200',
    primary: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      {icon && <div className="mb-3">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  partial: 'Thanh toán một phần',
  refunded: 'Đã hoàn tiền',
};

export const SHIPPING_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ giao hàng',
  preparing: 'Đang chuẩn bị',
  shipped: 'Đã giao hàng',
  delivered: 'Đã nhận hàng',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_VARIANT: Record<string, 'warning' | 'success' | 'info' | 'danger'> = {
  pending: 'warning',
  paid: 'success',
  partial: 'info',
  refunded: 'danger',
};

export const SHIPPING_STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  preparing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
};
