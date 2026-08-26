/**
 * Detached launcher for the backend dev server (port 4000).
 * Usage: node scripts/start-backend.js
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '..', 'apps', 'backend');
const logFile = path.join(backendDir, 'backend.log');

const child = spawn('npx', ['ts-node-dev', '--respawn', '--transpile-only', 'src/index.ts'], {
  cwd: backendDir,
  detached: true,
  stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
  shell: true,
});

child.unref();
console.log('Backend starting (pid ' + child.pid + '), logs: ' + logFile);