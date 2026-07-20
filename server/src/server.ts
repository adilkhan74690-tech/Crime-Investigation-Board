import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './services/socket.service';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`[CIB SECURE ENTERPRISE BACKEND] Server active on port ${PORT}`);
});
