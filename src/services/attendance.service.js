import api from './api';

export const attendanceService = {
  getAllAttendance: async (page = 1, limit = 20, employeeId = '') => {
    let url = `/attendance?page=${page}&limit=${limit}`;
    const empId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
    if (empId) {
      url += `&employeeId=${encodeURIComponent(empId)}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/attendance/stats');
    return response.data;
  },
  getDailySummary: async (date) => {
    const response = await api.get(`/attendance/daily-summary?date=${encodeURIComponent(date)}`);
    return response.data;
  },
  getRouteHistory: async (employeeId, date, signal = null) => {
    const empId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
    let url = `/attendance/tracking/route?employeeId=${encodeURIComponent(empId)}`;
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }
    const config = signal ? { signal } : {};
    const response = await api.get(url, config);
    return response.data;
  },
  getRecordCount: async (employeeId, date) => {
    const empId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
    let url = `/attendance/tracking/record-count?employeeId=${encodeURIComponent(empId)}`;
    if (date) {
      url += `&date=${encodeURIComponent(date)}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  requestLiveLocation: async (employeeId) => {
    const empId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
    const response = await api.post('/attendance/tracking/live-request', { employeeId: empId });
    return response.data;
  },
  getLiveLocation: async (employeeId) => {
    const empId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
    const response = await api.get(`/attendance/tracking/live-location?employeeId=${encodeURIComponent(empId)}`);
    return response.data;
  },
  getLiveRequestStatus: async (requestId, employeeId) => {
    const params = new URLSearchParams();
    if (requestId) {
      const rId = typeof requestId === 'object' && requestId ? (requestId._id || requestId.id) : requestId;
      if (rId) params.append('requestId', rId);
    }
    if (employeeId) {
      const eId = typeof employeeId === 'object' && employeeId ? (employeeId._id || employeeId.id) : employeeId;
      if (eId) params.append('employeeId', eId);
    }
    const queryString = params.toString();
    const url = `/attendance/tracking/live-request-status${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  reviewRecord: async (recordId, status, reviewNote = '') => {
    const response = await api.patch('/attendance/tracking/verify-record', {
      recordId,
      status,
      reviewNote
    });
    return response.data;
  }
};
