'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function LocationHeader() {
  const [address, setAddress] = useState('Detecting location...')

  useEffect(() => {
    if (!navigator.geolocation) {
      setAddress('Belfast, Northern Ireland')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
          const data = await res.json()
          const suburb =
            data.address?.suburb ??
            data.address?.city_district ??
            data.address?.city ??
            'Belfast'
          setAddress(suburb)
        } catch {
          setAddress(`${latitude.toFixed(3)}°N, ${Math.abs(longitude).toFixed(3)}°W`)
        }
      },
      () => setAddress('Belfast, Northern Ireland')
    )
  }, [])

  return (
    <div className="flex items-center gap-2">
      <Icon name="location_on" filled size={18} className="text-primary" />
      <span className="text-sm font-medium text-on-surface-variant">{address}</span>
    </div>
  )
}
