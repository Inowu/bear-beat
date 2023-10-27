module.exports = [
  {
    script: 'build/src/index.js',
    name: 'app',
    exec_mode: 'cluster',
    instances: 1,
    kill_timeout: 5000,
  },
];
