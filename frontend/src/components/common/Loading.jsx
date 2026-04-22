import React from 'react';
import './Loading.css';

const Loading = ({ message, fullScreen = false, size = 'md' }) => {
  const content = (
    <div className={`loading loading--${size}`}>
      <div className="loading__ring" aria-hidden="true">
        <svg viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4"
            stroke="var(--blue-500)" strokeLinecap="round"
            strokeDasharray="90 150" strokeDashoffset="0" />
        </svg>
      </div>
      {message && <p className="loading__text">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-overlay" role="status" aria-label={message || 'Loading'}>
        {content}
      </div>
    );
  }

  return content;
};

export default Loading;
