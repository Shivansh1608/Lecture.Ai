import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 300000 }); // long lectures can take a few minutes
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('lecturai_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
export default api;
