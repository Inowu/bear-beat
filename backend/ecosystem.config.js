module.exports = [
  {
    script: 'build/index.js',
    name: 'app',
    exec_mode: 'cluster',
    instances: 1,
    kill_timeout: 5000,
  },
  {
    script: 'build/automationRunner.js',
    name: 'automation-runner',
    exec_mode: 'fork',
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
