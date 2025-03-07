export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const createHeaders = (contentType = 'application/json') => ({
  'Content-Type': contentType,
});
