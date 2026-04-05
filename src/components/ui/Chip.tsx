import { ButtonHTMLAttributes } from 'react'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  icon?: React.ReactNode
}

export default function Chip({
  children,
  className = '',
  active = false,
  icon,
  ...props
}: ChipProps) {
  return (
    <button
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95
        ${active
          ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
        } ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
