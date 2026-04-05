import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'low' | 'flat'
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  ...props
}: CardProps) {
  const base = 'rounded-xl'
  const variants = {
    default: 'bg-surface-container-lowest shadow-[0_8px_32px_rgba(26,28,28,0.04)]',
    low: 'bg-surface-container-low',
    flat: 'bg-surface-container',
  }
  return (
    <div className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  )
}
