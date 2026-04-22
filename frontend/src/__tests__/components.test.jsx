/**
 * components.test.jsx
 * React Testing Library unit tests for CourseCard, FeeRow (dashboard),
 * SourceCitations (chat), and ChatInterface input behaviour.
 *
 * Run: npx vitest run
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock all module-level dependencies so sub-components render in isolation ──

vi.mock('react-router-dom', () => ({
  useLocation:  () => ({ state: null }),
  useNavigate:  () => vi.fn(),
  Link:         ({ children }) => children,
}));

vi.mock('../../contexts/authStore', () => ({
  default: () => ({
    user: { profile: { firstName: 'Jane', lastName: 'Doe' }, role: 'student' },
  }),
}));

vi.mock('../../services/api', () => ({
  chatAPI:    { getConversations: vi.fn(() => Promise.resolve([])), sendMessage: vi.fn() },
  studentAPI: { getDashboard: vi.fn(() => Promise.resolve({ data: {} })) },
}));

// ── Import sub-components (exported from their modules) ───────────────────────

import { CourseCard, FeeRow } from '../components/dashboard/StudentDashboard';
import { SourceCitations } from '../components/chat/ChatInterface';

// ── CourseCard ────────────────────────────────────────────────────────────────

describe('CourseCard', () => {
  const course = {
    courseCode: 'CS4001',
    courseName: 'Artificial Intelligence',
    credits: 4,
    instructor: 'Dr Smith',
    schedule: 'Monday 10:00–12:00',
  };

  it('renders the course code', () => {
    render(<CourseCard course={course} index={0} />);
    expect(screen.getByText('CS4001')).toBeInTheDocument();
  });

  it('renders the full course name', () => {
    render(<CourseCard course={course} index={0} />);
    expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
  });

  it('renders credit count with "cr" suffix', () => {
    render(<CourseCard course={course} index={0} />);
    expect(screen.getByText('4 cr')).toBeInTheDocument();
  });

  it('shows "N/A" when courseCode is missing', () => {
    render(<CourseCard course={{ courseName: 'Math' }} index={0} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows "Unnamed Course" fallback when courseName is missing', () => {
    render(<CourseCard course={{ courseCode: 'XX100' }} index={0} />);
    expect(screen.getByText('Unnamed Course')).toBeInTheDocument();
  });
});

// ── FeeRow ────────────────────────────────────────────────────────────────────

describe('FeeRow', () => {
  const paidFee = {
    feeType: 'tuition',
    description: 'Tuition Fee 2024',
    amount: 9250,
    status: 'paid',
    dueDate: '2024-09-01T00:00:00.000Z',
  };

  it('renders the formatted fee amount', () => {
    render(<FeeRow fee={paidFee} />);
    expect(screen.getByText('£9250.00')).toBeInTheDocument();
  });

  it('renders the fee status badge', () => {
    render(<FeeRow fee={paidFee} />);
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<FeeRow fee={paidFee} />);
    expect(screen.getByText('Tuition Fee 2024')).toBeInTheDocument();
  });

  it('falls back to feeType when description is absent', () => {
    const { feeType, ...rest } = paidFee;
    const fee = { ...rest, feeType: 'library', description: '' };
    render(<FeeRow fee={fee} />);
    expect(screen.getByText('library')).toBeInTheDocument();
  });

  it('renders "Fee" as last-resort label when both description and feeType absent', () => {
    render(<FeeRow fee={{ amount: 50, status: 'pending' }} />);
    expect(screen.getByText('Fee')).toBeInTheDocument();
  });
});

// ── SourceCitations ───────────────────────────────────────────────────────────

describe('SourceCitations', () => {
  const sources = [
    {
      document_id: 'doc_1',
      document_name: 'Module Handbook',
      relevance_score: 0.91,
      chunk_text: 'Students must submit coursework via Blackboard.',
    },
    {
      document_id: 'doc_1',
      document_name: 'Module Handbook',
      relevance_score: 0.82,
      chunk_text: 'Late submissions incur a 10% grade penalty.',
    },
    {
      document_id: 'doc_2',
      document_name: 'Fee Schedule',
      relevance_score: 0.76,
      chunk_text: 'Tuition fees are due by 1 September each year.',
    },
  ];

  it('renders null when sources array is empty', () => {
    const { container } = render(<SourceCitations sources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when sources prop is undefined', () => {
    const { container } = render(<SourceCitations sources={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toggle button with passage count', () => {
    render(<SourceCitations sources={sources} />);
    expect(screen.getByText(/3 passages/i)).toBeInTheDocument();
  });

  it('source list is hidden before toggle is clicked', () => {
    const { container } = render(<SourceCitations sources={sources} />);
    const list = container.querySelector('.sources__list');
    expect(list).not.toBeInTheDocument();
  });

  it('source list becomes visible after toggle click', () => {
    render(<SourceCitations sources={sources} />);
    fireEvent.click(screen.getByRole('button'));
    expect(document.querySelector('.sources__list')).toBeInTheDocument();
  });

  it('deduplicates sources: shows one card per unique document_id', () => {
    render(<SourceCitations sources={sources} />);
    fireEvent.click(screen.getByRole('button'));
    // doc_1 appears twice in data but should render only one card
    const items = document.querySelectorAll('.sources__item');
    expect(items).toHaveLength(2);
  });

  it('collapses source list on second toggle click', () => {
    render(<SourceCitations sources={sources} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(document.querySelector('.sources__list')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(document.querySelector('.sources__list')).not.toBeInTheDocument();
  });
});
