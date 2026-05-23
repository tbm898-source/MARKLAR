import os from "node:os";

/** First non-internal IPv4 address (typical LAN IP for phone testing). */
export function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue;
    for (const net of ifaces) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}
