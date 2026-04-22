import React, { useState, useRef } from 'react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { adminAPI } from '../../services/api';

const ALLOWED = ['.pdf', '.txt', '.doc', '.docx'];
const MAX_MB = 10;

const DocumentUpload = ({ onUploaded }) => {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('general');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const inputRef = useRef(null);

  const validate = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) return `Only ${ALLOWED.join(', ')} files allowed`;
    if (f.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB}MB`;
    return null;
  };

  const pick = (f) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); return; }
    setFile(f); setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('category', category);
      await adminAPI.uploadDocument(fd);
      setSuccess(`"${file.name}" uploaded and queued for processing.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="doc-upload">
      {/* Drop zone */}
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}${file ? ' drop-zone--has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(',')}
          style={{ display: 'none' }}
          onChange={e => e.target.files[0] && pick(e.target.files[0])}
        />
        {file ? (
          <div className="drop-zone__file">
            <span className="drop-zone__file-icon">📄</span>
            <div>
              <p className="drop-zone__file-name">{file.name}</p>
              <p className="drop-zone__file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button className="drop-zone__clear" onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
          </div>
        ) : (
          <div className="drop-zone__prompt">
            <div className="drop-zone__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <p className="drop-zone__main">Drop file here or <span>browse</span></p>
            <p className="drop-zone__sub">{ALLOWED.join(', ')} · Max {MAX_MB}MB</p>
          </div>
        )}
      </div>

      {/* Category select */}
      <div className="doc-upload__row">
        <div className="doc-upload__field">
          <label className="doc-upload__label">Category</label>
          <select
            className="doc-upload__select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="general">General</option>
            <option value="admissions">Admissions</option>
            <option value="academic_policy">Academic Policy</option>
            <option value="fees">Fees</option>
            <option value="hostel">Hostel</option>
            <option value="exam">Exams</option>
            <option value="courses">Courses</option>
          </select>
        </div>
        <Button
          variant="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={!file || uploading}
        >
          Upload & Process
        </Button>
      </div>

      {error && <p className="doc-upload__msg doc-upload__msg--err">⚠ {error}</p>}
      {success && <p className="doc-upload__msg doc-upload__msg--ok">✓ {success}</p>}
    </div>
  );
};

export default DocumentUpload;
