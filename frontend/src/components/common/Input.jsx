import React, { useState } from 'react';
import './Input.css';

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const Input = ({
  label,
  type = 'text',
  name,
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helpText,
  required = false,
  disabled = false,
  prefix,
  suffix,
  className = '',
  autoComplete,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const inputId = id || name;

  return (
    <div className={`field ${error ? 'field--error' : ''} ${disabled ? 'field--disabled' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <div className="field__control">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          id={inputId}
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          className={`field__input${prefix ? ' field__input--prefixed' : ''}${(suffix || isPassword) ? ' field__input--suffixed' : ''}`}
          aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
          aria-invalid={!!error}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShowPassword(p => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        {suffix && !isPassword && <span className="field__suffix">{suffix}</span>}
      </div>
      {error && <p id={`${inputId}-error`} className="field__error" role="alert">{error}</p>}
      {helpText && !error && <p id={`${inputId}-help`} className="field__help">{helpText}</p>}
    </div>
  );
};

export default Input;
