'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá']

function parse(v?: string): Date | null {
  if (!v) return null
  const d = new Date(v + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDisplay(v: string): string {
  const d = parse(v)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  min?: string
  max?: string
  disabled?: boolean
}

export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', className, min, max, disabled }: DatePickerProps) {
  const [open, setOpen]     = useState(false)
  const ref                 = useRef<HTMLDivElement>(null)
  const today               = new Date()
  const parsed              = parse(value)

  const [viewYear,  setViewYear]  = useState(() => parsed?.getFullYear()  ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth()     ?? today.getMonth())

  // Sync view when value changes externally
  useEffect(() => {
    const d = parse(value)
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
  }, [value])

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDay   = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const v = fmt(d)
    if (min && v < min) return
    if (max && v > max) return
    onChange(v)
    setOpen(false)
  }

  const todayStr    = fmt(today)
  const selectedStr = value

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition-all bg-white',
          open
            ? 'border-[#293c4f] ring-2 ring-[#293c4f]/10'
            : 'border-gray-200 hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className={cn('flex-1 text-left', value ? 'text-gray-800' : 'text-gray-400')}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onMouseDown={e => { e.stopPropagation(); onChange(''); }}
            className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
          >
            ×
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-64">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
              className="text-sm font-semibold text-gray-800 hover:text-[#293c4f] transition-colors"
            >
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-3 pt-2 pb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const ds       = fmt(new Date(viewYear, viewMonth, day))
              const isToday  = ds === todayStr
              const isSel    = ds === selectedStr
              const disabled = (min && ds < min) || (max && ds > max)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!!disabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-xl text-sm transition-all font-medium',
                    isSel  && 'bg-[#293c4f] text-white',
                    !isSel && isToday  && 'ring-2 ring-[#293c4f]/30 text-[#293c4f] font-bold',
                    !isSel && !isToday && !disabled && 'hover:bg-gray-100 text-gray-700',
                    disabled && 'opacity-30 cursor-not-allowed text-gray-400',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer — go to today */}
          <div className="border-t border-gray-100 px-4 py-2">
            <button type="button"
              onClick={() => { onChange(todayStr); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setOpen(false) }}
              className="text-xs font-medium text-[#293c4f] hover:opacity-70 transition-opacity w-full text-center">
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
