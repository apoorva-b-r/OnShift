const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.static(path.join(__dirname)));

app.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'OnShift DigiLocker Identity Demo UI',
    backendTarget: process.env.BACKEND_URL || 'http://localhost:4000/api/v1',
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Identity Demo UI] Server running on http://localhost:${PORT}`);
  console.log(`[Identity Demo UI] Target Backend API: http://localhost:4000/api/v1`);
});
