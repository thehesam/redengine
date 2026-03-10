interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'default';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  const variantStyles = {
    success: 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
    error: 'bg-[#FF3B3B]/10 text-[#FF3B3B] border border-[#FF3B3B]/20',
    default: 'bg-[#2A2A33] text-[#E6E6EB] border border-[#3A3A43]',
  };

  return (
    <span className={`inline-block px-2 py-1 rounded text-[13px] font-medium ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
