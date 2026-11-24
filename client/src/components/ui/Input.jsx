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
    'w-full bg-bg-surface border border-border-subtle rounded-[14px] text-text-primary placeholder:text-text-muted text-[15px] focus:outline-none focus:border-[#1D9E4B]/60 focus:ring-4 focus:ring-[#1D9E4B]/10 hover:border-text-primary/25 transition-all duration-300';
  const paddingStyles = Icon ? 'pl-11 pr-4 py-3' : 'px-4 py-3';
  const errorStyles = error ? 'border-danger focus:ring-danger/15 focus:border-danger' : '';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted">
            <Icon className="h-4 w-4" />
          </div>
        )}

        {textarea ? (
          <textarea
            id={id}
            ref={ref}
            rows={rows}
            className={`${baseInputStyles} ${paddingStyles} ${errorStyles} resize-y leading-relaxed`}
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
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
