import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, id, ...props }, ref) => {
    const fallbackId = useId()
    const inputId = id ?? props.name ?? fallbackId
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-charcoal-700">
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          className={`rounded-lg border bg-sand-50 px-4 py-2.5 text-sm text-charcoal-900 outline-none transition-colors placeholder:text-charcoal-500 focus:border-teal-700 ${
            error ? 'border-coral-500' : 'border-sand-400'
          }`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-coral-500">
            {error}
          </p>
        )}
      </div>
    )
  },
)
TextareaField.displayName = 'TextareaField'
