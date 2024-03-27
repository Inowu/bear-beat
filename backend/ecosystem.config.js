module.exports = [
  {
    script: 'build/index.js',
    name: 'app',
    exec_mode: 'cluster',
    instances: 1,
    kill_timeout: 5000,
  },
  {
    script: 'sse_server/index.js',
    name: 'sse-server',
    exec_mode: 'cluster',
    instances: 1,
    kill_timeout: 5000,
  },
];
