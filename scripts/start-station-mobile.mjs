import { createStationServer } from './station/server.mjs';
import { PROJECT_ROOT } from './build-manifest-lib.mjs';
import { assertPortAvailable, parseStartArguments } from './start-local.mjs';

const DEFAULT_PORT = 8790;
const DEFAULT_IP = '0.0.0.0';

const printUsage = (exitCode = 1) => {
  console.error(
    'Använd: node scripts/start-station-mobile.mjs [--ip 0.0.0.0] [--port 8790]',
  );
  process.exitCode = exitCode;
};

const parseMobileArguments = (arguments_) => {
  const { ip: resolvedIp, port } = parseStartArguments(arguments_, {
    allowRemoteIp: true,
  });
  const hasIpArgument = arguments_.some(
    (value) => value === '--ip' || value.startsWith('--ip='),
  );
  const ip = hasIpArgument ? resolvedIp : DEFAULT_IP;
  if (port < 1 || port > 65_535) {
    printUsage();
    throw new Error('Användbar port saknas eller är ogiltig.');
  }
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(ip)) {
    printUsage();
    throw new Error(`Ogiltig IP-adress: ${ip}.`);
  }
  return { ip, port };
};

const runStationServer = async (arguments_ = process.argv.slice(2)) => {
  const { ip, port } = parseMobileArguments(arguments_);
  await assertPortAvailable(port, ip);

  const app = await createStationServer({
    root: PROJECT_ROOT,
    allowExternalRequests: true,
  });

  try {
    await new Promise((resolveListen, reject) => {
      app.server.once('error', reject);
      app.server.listen(port, ip, resolveListen);
    });
    const localAddress = `http://${ip}:${port}/`;
    if (ip === DEFAULT_IP) {
      console.log(
        `DivineList Skeppet (mobilläge): lyssnar på 0.0.0.0\nInga uppdrag startas automatiskt. Ctrl+C stoppar stationen.`,
      );
      console.log('Mobilaccess kräver din lokala IP-adress: http://<din-ip>:8790/');
    } else {
      console.log(
        `DivineList Skeppet (mobilläge): ${localAddress}\nInga uppdrag startas automatiskt. Ctrl+C stoppar stationen.`,
      );
    }
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await app.close();
    };
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        void shutdown().catch((error) => {
          console.error(error.message);
          process.exitCode = 1;
        });
      });
    }
  } catch (error) {
    await app.close();
    throw error;
  }
};

if (
  typeof process.argv[1] === 'string' &&
  process.argv[1].endsWith('start-station-mobile.mjs')
) {
  try {
    await runStationServer();
  } catch (error) {
    console.error(`Skeppet kunde inte startas i mobilläge: ${error.message}`);
    process.exitCode = 1;
  }
}

export { runStationServer };
