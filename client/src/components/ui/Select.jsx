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
    'w-full appearance-none bg-bg-surface border border-border-subtle rounded-[14px] text-text-primary text-[15px] focus:outline-none focus:ring-4 focus:ring-[#1D9E4B]/10 focus:border-[#1D9E4B]/60 hover:border-text-primary/25 transition-all duration-300 cursor-pointer';
  const paddingStyles = Icon ? 'pl-11 pr-10 py-3' : 'px-4 py-3 pr-10';
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

        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-text-muted">
          <FiChevronDown className="h-4 w-4" />
        </div>
      </div>
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
