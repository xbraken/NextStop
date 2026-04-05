import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  fullWidth?: boolean
}

export default function Button({
  children,
  className = '',
  variant = 'primary',
  fullWidth = false,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    primary:
      'bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full py-4 px-8 shadow-lg shadow-primary/20 font-headline font-extrabold',
    secondary:
      'bg-surface-container-low text-on-surface rounded-full py-3 px-6',
    ghost:
      'text-primary hover:bg-primary/5 rounded-full py-2 px-4',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
