import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import toast from 'react-hot-toast';

// Create a centralized Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// ----------------------------------------------------
// REQUEST INTERCEPTOR
// ----------------------------------------------------
// Automatically injects the JWT Access Token into EVERY request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ----------------------------------------------------
// RESPONSE INTERCEPTOR
// ----------------------------------------------------
// Globally catches 401 Unauthorized errors and tries to seamlessly refresh the token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401, AND we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Mark as retried to prevent infinite loops

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Ping the backend refresh endpoint
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = response.data.accessToken;

        // Save the new token
        localStorage.setItem('accessToken', newAccessToken);

        // Retry the original request with the shiny new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // If the refresh token is ALSO dead or missing, completely log the user out
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        toast.error('Session expired. Please log in again.', { id: 'session-expired' });
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Do not show unexpected error for unauthenticated 401 requests that are redirecting
    if (error.response?.status === 401) {
      return Promise.reject(error);
    }

    // For any other standard error (400, 404, 500) or network failure
    const errorMessage = error.response?.data?.message || 
      (error.code === 'ERR_NETWORK' || !error.response 
        ? 'Cannot connect to backend server. Make sure the local backend is running on http://localhost:3000' 
        : 'An unexpected error occurred');
        
    // Deduplicate toast notifications using id
    toast.error(errorMessage, { id: errorMessage });
    return Promise.reject(error);
  }
);

export default api;
