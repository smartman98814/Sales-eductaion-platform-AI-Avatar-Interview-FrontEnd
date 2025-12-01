export const config = {
  heygen: {
    apiKey: import.meta.env.VITE_HEYGEN_API_KEY || 'YourApiKey',
    serverUrl: import.meta.env.VITE_HEYGEN_SERVER_URL || 'https://api.heygen.com',
  },
  backend: {
    baseUrl: import.meta.env.VITE_BACKEND_URL,
  },
};

