/**
 * OnShift Monorepo Development Starter Script
 */

const { spawn } = require('child_process');

console.log('==================================================');
console.log('STARTING ONSHIFT SERVICES (DEV MODE)');
console.log('==================================================');
console.log('Backend API: http://localhost:4000/api/v1');
console.log('Verifier Web App: http://localhost:3000');
console.log('Python Verification Engine: http://localhost:8000');
console.log('--------------------------------------------------');

const backend = spawn('npm', ['--prefix', 'apps/backend', 'run', 'dev'], { stdio: 'inherit', shell: true });
const web = spawn('npm', ['--prefix', 'apps/verifier-web', 'run', 'dev'], { stdio: 'inherit', shell: true });

process.on('SIGINT', () => {
  backend.kill();
  web.kill();
  process.exit();
});
