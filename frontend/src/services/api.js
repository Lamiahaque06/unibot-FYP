import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const customError = {
      message: error.response?.data?.message || error.response?.data?.error || 'An error occurred',
      status: error.response?.status,
      data: error.response?.data,
    };
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(customError);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  logout: () => api.post('/auth/logout'),
};

export const studentAPI = {
  getDashboard: () => api.get('/student/dashboard'),
  getEnrollments: (params) => api.get('/student/enrollments', { params }),
  getEnrollmentDetails: (id) => api.get(`/student/enrollments/${id}`),
  enrollInCourse: (data) => api.post('/student/enroll', data),
  getFees: (params) => api.get('/student/fees', { params }),
  getFeeDetails: (id) => api.get(`/student/fees/${id}`),
  getSchedule: () => api.get('/student/schedule'),
};

export const chatAPI = {
  sendMessage: (data) => api.post('/chat/message', data),
  getConversations: (params) => api.get('/chat/conversations', { params }),
  getConversation: (id) => api.get(`/chat/conversations/${id}`),
  createConversation: (data) => api.post('/chat/conversations', data),
  archiveConversation: (id) => api.put(`/chat/conversations/${id}/archive`),
  deleteConversation: (id) => api.delete(`/chat/conversations/${id}`),
  addFeedback: (id, data) => api.post(`/chat/conversations/${id}/feedback`, data),
  getAIStatus: () => api.get('/chat/ai-status'),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getCourses: (params) => api.get('/admin/courses', { params }),
  createCourse: (data) => api.post('/admin/courses', data),
  updateCourse: (id, data) => api.put(`/admin/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/admin/courses/${id}`),
  getDocuments: (params) => api.get('/admin/documents', { params }),
  uploadDocument: (formData) =>
    api.post('/admin/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteDocument: (id) => api.delete(`/admin/documents/${id}`),
  getFAQs: (params) => api.get('/admin/faqs', { params }),
  createFAQ: (data) => api.post('/admin/faqs', data),
  updateFAQ: (id, data) => api.put(`/admin/faqs/${id}`, data),
  deleteFAQ: (id) => api.delete(`/admin/faqs/${id}`),
  createFee: (data) => api.post('/admin/fees', data),
  syncFAQs: () => api.post('/admin/ai/sync-faqs'),
  runDemoEvaluation: () => api.get('/admin/ai/evaluation/demo'),
  runEvaluation: (data) => api.post('/admin/ai/evaluation', data),
};

export default api;
