import api from './api';

export const attendanceService = {
  getAllAttendance: async (page = 1, limit = 20, employeeId = '') => {
    let url = `/attendance?page=${page}&limit=${limit}`;
    if (employeeId) {
      url += `&employeeId=${employeeId}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/attendance/stats');
    return response.data;
  },
  getDailySummary: async (date) => {
    const response = await api.get(`/attendance/daily-summary?date=${date}`);
    return response.data;
  },
  getRouteHistory: async (employeeId, date) => {
    let url = `/attendance/tracking/route?employeeId=${employeeId}`;
    if (date) {
      url += `&date=${date}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  getRecordCount: async (employeeId, date) => {
    let url = `/attendance/tracking/record-count?employeeId=${employeeId}`;
    if (date) {
      url += `&date=${date}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  requestLiveLocation: async (employeeId) => {
    const response = await api.post('/attendance/tracking/live-request', { employeeId });
    return response.data;
  },
  getLiveLocation: async (employeeId) => {
    const response = await api.get(`/attendance/tracking/live-location?employeeId=${employeeId}`);
    return response.data;
  },
  getLiveRequestStatus: async (requestId, employeeId) => {
    let url = '/attendance/tracking/live-request-status?';
    if (requestId) url += `requestId=${requestId}&`;
    if (employeeId) url += `employeeId=${employeeId}`;
    const response = await api.get(url);
    return response.data;
  }
};
