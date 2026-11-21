import api from './api';

export const employeeService = {
  getAllEmployees: async (page = 1, limit = 10) => {
    const response = await api.get(`/employees?page=${page}&limit=${limit}`);
    return response.data;
  },
  
  createEmployee: async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    return response.data;
  },

  toggleEmployeeStatus: async (id) => {
    const response = await api.patch(`/employees/${id}/toggle-status`);
    return response.data;
  }
,
  resetEmployeePassword: async (id, newPassword) => {
    const response = await api.patch(`/employees/${id}/reset-password`, { newPassword });
    return response.data;
  },

  updateEmployee: async (id, data) => {
    const response = await api.patch(`/employees/${id}`, data);
    return response.data;
  }
};