module.exports = {
  apps : [{
    name: 'RemoteCodeServer',
    script: 'index.js',
    instances : '1',
    watch: "misc/*",
    max_memory_restart: '1024M',
    exec_mode : "cluster",
    env: {
        "NODE_ENV": "production"
    }
  }]
};
