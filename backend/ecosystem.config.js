module.exports = [
  {
    script: 'build/index.js',
    name: 'app',
    exec_mode: 'cluster',
    instances: 1,
    kill_timeout: 5000,
  },
];
