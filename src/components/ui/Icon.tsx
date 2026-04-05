interface IconProps {
  name: string
  className?: string
  filled?: boolean
  size?: number
  weight?: number
}

export default function Icon({
  name,
  className = '',
  filled = false,
  size = 24,
  weight = 400,
}: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  )
}
