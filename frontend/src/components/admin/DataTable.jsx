import React, { useState } from 'react';
import Badge from '../common/Badge';

// Safely convert any value to something React can render
const safeCell = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    return v.map(item =>
      typeof item === 'object' && item !== null
        ? (item.name || item.label || item.title || item.day || JSON.stringify(item))
        : String(item)
    ).join(', ');
  }
  if (typeof v === 'object') {
    return v.name || v.label || v.title || v.email || v.courseName || '—';
  }
  return String(v);
};

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  onRowClick,
  actions,
  className = '',
}) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  return (
    <div className={`dt-wrap ${className}`}>
      <div className="dt-scroll">
        <table className="dt">
          <thead className="dt__head">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`dt__th${col.sortable ? ' dt__th--sortable' : ''}${sortKey === col.key ? ' dt__th--active' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="dt__sort-icon">
                      {sortKey === col.key
                        ? sortDir === 'asc' ? ' ↑' : ' ↓'
                        : ' ↕'}
                    </span>
                  )}
                </th>
              ))}
              {actions && <th className="dt__th dt__th--actions">Actions</th>}
            </tr>
          </thead>
          <tbody className="dt__body">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="dt__row">
                  {columns.map(col => (
                    <td key={col.key} className="dt__td">
                      <div className="dt__skeleton" />
                    </td>
                  ))}
                  {actions && <td className="dt__td"><div className="dt__skeleton" /></td>}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="dt__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, ri) => (
                <tr
                  key={row._id || row.id || ri}
                  className={`dt__row${onRowClick ? ' dt__row--clickable' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <td key={col.key} className="dt__td">
                      {col.render ? col.render(row[col.key], row) : safeCell(row[col.key])}
                    </td>
                  ))}
                  {actions && (
                    <td className="dt__td dt__td--actions" onClick={e => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
