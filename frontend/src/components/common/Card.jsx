import React from 'react';
import './Card.css';

const Card = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  className = '',
  noPadding = false,
  ...props
}) => (
  <div className={`card ${className}`} {...props}>
    {(title || headerAction) && (
      <div className="card__header">
        <div className="card__header-text">
          {title && <h3 className="card__title">{title}</h3>}
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        {headerAction && <div className="card__header-action">{headerAction}</div>}
      </div>
    )}
    <div className={`card__body${noPadding ? ' card__body--no-pad' : ''}`}>{children}</div>
    {footer && <div className="card__footer">{footer}</div>}
  </div>
);

export default Card;
