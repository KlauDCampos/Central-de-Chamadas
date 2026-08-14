const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log('Resposta:', chunk.toString());
  });
});

req.on('error', (e) => {
  console.error('Erro:', e.message);
});

req.end();