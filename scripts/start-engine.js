/**
 * Detached launcher for the Python verification engine (port 8000).
 * Usage: node scripts/start-engine.js
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const engineDir = path.join(__dirname, '..', 'apps', 'verification-engine');
const logFile = path.join(engineDir, 'engine.log');

const child = spawn('py', ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'], {
  cwd: engineDir,
  detached: true,
  stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
  shell: false,
});

child.unref();
console.log('Verification engine starting (pid ' + child.pid + '), logs: ' + logFile);