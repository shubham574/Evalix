import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  id,
  type = 'text',
  error,
  icon: Icon,
  className = '',
  textarea = false,
  rows = 4,
  ...props
}, ref) => {
  const baseInputStyles =
    'w-full bg-bg-surface border border-border-subtle rounded-[11px] text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/15 hover:border-text-secondary/50 transition-all duration-200';
  const paddingStyles = Icon ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5';
  const errorStyles = error ? 'border-danger focus:ring-danger/20 focus:border-danger' : '';

  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
            <Icon className="h-4 w-4" />
          </div>
        )}

        {textarea ? (
          <textarea
            id={id}
            ref={ref}
            rows={rows}
            className={`${baseInputStyles} ${Icon ? 'pl-10 pr-4 py-2.5' : 'px-4 py-2.5'} ${errorStyles} resize-y`}
            {...props}
          />
        ) : (
          <input
            id={id}
            ref={ref}
            type={type}
            className={`${baseInputStyles} ${paddingStyles} ${errorStyles}`}
            {...props}
          />
        )}
      </div>
      {error && (
        <span className="text-xs font-medium text-danger mt-1">{error}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
