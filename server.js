'use strict';

const { createServer } = require('./src/app');

const port = Number(process.env.PORT) || 8080;
const server = createServer();

server.listen(port, '0.0.0.0', () => {
  console.log(`Urimai listening on ${port} (AI ${process.env.GEMINI_API_KEY ? 'on' : 'off — rules only'})`);
});

// Cloud Run sends SIGTERM before it stops an instance; finish in-flight requests.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
