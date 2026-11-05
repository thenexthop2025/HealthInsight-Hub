const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Dev only: proxy API calls to backend when running on port 3000
  app.use(
    '/api',
    createProxyMiddleware({
      // Use docker-compose service name to reach backend from inside the container
      target: 'http://backend:8000',
      changeOrigin: true,
      logLevel: 'warn',
    })
  );

  // Serve uploaded assets (avatars etc.) from backend during dev
  app.use(
    '/uploads',
    createProxyMiddleware({
      target: 'http://backend:8000',
      changeOrigin: true,
      logLevel: 'warn',
    })
  );
};

