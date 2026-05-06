'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

/**
 * Styled <select> — replaces native browser select with ERP design system styling.
 * Accepts all native <select> props plus `wrapperClassName` for the outer wrapper div.
 */
export function Select({ className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        className={cn(
          'w-full appearance-none bg-white text-gray-700 text-sm',
          'border border-gray-200 rounded-xl px-3 py-2 pr-8',
          'focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
    </div>
  )
}
