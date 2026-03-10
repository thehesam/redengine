interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-medium rounded-lg transition-colors focus:outline-none';

  const variantStyles = {
    primary: 'bg-[#FF3B3B] text-white hover:bg-[#FF2222]',
    secondary: 'bg-transparent border border-[#2A2A33] text-[#E6E6EB] hover:border-[#3A3A43]',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 text-[13px]',
    md: 'px-4 py-2 text-[15px]',
    lg: 'px-6 py-3 text-[15px]',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    />
  );
}
