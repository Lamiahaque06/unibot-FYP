import React from 'react';
import './Button.css';

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconRight,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => (
  <button
    type={type}
    className={`btn btn--${variant} btn--${size}${fullWidth ? ' btn--full' : ''}${loading ? ' btn--loading' : ''} ${className}`}
    disabled={disabled || loading}
    onClick={onClick}
    {...props}
  >
    {loading && (
      <span className="btn__spinner" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
      </span>
    )}
    {!loading && icon && <span className="btn__icon">{icon}</span>}
    <span>{children}</span>
    {!loading && iconRight && <span className="btn__icon btn__icon--right">{iconRight}</span>}
  </button>
);

export default Button;
