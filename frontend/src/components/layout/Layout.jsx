import React from 'react';
import Sidebar from './Sidebar';
import './Layout.css';

const Layout = ({ children }) => (
  <div className="layout">
    <Sidebar />
    <main className="layout__main">
      <div className="layout__content">
        {children}
      </div>
    </main>
  </div>
);

export default Layout;
