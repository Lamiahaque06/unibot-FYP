import React from 'react';
import './Alert.css';

/**
 * Alert Component
 * Shows alert messages with different types
 *
 * @param {Object} props
 * @param {string} props.type - Alert type (success, error, warning, info)
 * @param {string} props.message - Alert message
 * @param {function} props.onClose - Close handler
 * @param {boolean} props.closable - Show close button
 */
const Alert = ({ type = 'info', message, onClose, closable = false, className = '' }) => {
  if (!message) return null;

  return (
    <div className={`alert alert-${type} ${className}`}>
      <div className="alert-content">
        <span className="alert-icon">{getIcon(type)}</span>
        <span className="alert-message">{message}</span>
      </div>
      {closable && (
        <button onClick={onClose} className="alert-close">
          &times;
        </button>
      )}
    </div>
  );
};

/**
 * Get icon based on alert type
 */
const getIcon = (type) => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
};

export default Alert;
