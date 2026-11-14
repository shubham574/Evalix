import React, { forwardRef } from 'react';
import { FiChevronDown } from 'react-icons/fi';

const Select = forwardRef(({
  label,
  id,
  options = [],
  error,
  className = '',
  icon: Icon,
  ...props
}, ref) => {
  const baseSelectStyles =
    'w-full appearance-none bg-bg-surface border border-border-subtle rounded-[11px] text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/15 focus:border-[#FF6B35] hover:border-text-secondary/50 transition-all duration-200 cursor-pointer';
  const paddingStyles = Icon ? 'pl-10 pr-10 py-2.5' : 'px-4 py-2.5 pr-10';
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

        <select
          id={id}
          ref={ref}
          className={`${baseSelectStyles} ${paddingStyles} ${errorStyles}`}
          {...props}
        >
          {options.map((opt, index) => (
            <option key={index} value={opt.value ?? opt} className="bg-bg-surface text-text-primary">
              {opt.label ?? opt}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-text-muted">
          <FiChevronDown className="h-4 w-4" />
        </div>
      </div>
      {error && (
        <span className="text-xs font-medium text-danger mt-1">{error}</span>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
