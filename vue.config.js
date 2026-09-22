module.exports = {
  devServer: {
    port: 8080,
    open: false,
    proxy: {
      '/api/label': {
        target: 'http://localhost:9001',
        pathRewrite: { '^/api/label': '/label' },
        changeOrigin: true
      },
      '/api/article': {
        target: 'http://localhost:9004',
        pathRewrite: { '^/api/article': '/article' },
        changeOrigin: true
      },
      '/api/comment': {
        target: 'http://localhost:9004',
        pathRewrite: { '^/api/comment': '/comment' },
        changeOrigin: true
      },
      '/api/user': {
        target: 'http://localhost:9008',
        pathRewrite: { '^/api/user': '/user' },
        changeOrigin: true
      },
      '/im': {
        target: 'http://localhost:9008',
        ws: true,
        changeOrigin: true
      }
    }
  }
}
