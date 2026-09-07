import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROJECT_ROOT } from './build-manifest-lib.mjs';
import { verifyReleaseReport } from './verify-release-report.mjs';
import {
  parseStartArguments,
  DEFAULT_PORT,
} from './start-local.mjs';

const DEFAULT_IP = '0.0.0.0';
const hasIpArgument = (arguments_) =>
  arguments_.some(
    (value) =>
      value === '--ip' ||
      value.startsWith('--ip='),
  );

const assertPortAvailable = (port, ip = DEFAULT_IP) =>
  new Promise((resolveAvailable, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} används redan på ${ip}. Stoppa den andra processen eller välj en annan port.`,
          ),
        );
        return;
      }
      reject(error);
    });
    probe.listen({ host: ip, port, exclusive: true }, () => {
      probe.close((error) => (error ? reject(error) : resolveAvailable()));
    });
  });

const createWranglerArguments = (
  { ip, port },
  wrangler,
  wranglerConfig,
) => [
  wrangler,
  'dev',
  '--config',
  wranglerConfig,
  '--local',
  '--show-interactive-dev-session=false',
  '--ip',
  ip,
  '--inspector-ip',
  ip,
  '--port',
  String(port),
];

const runLocalServer = async (arguments_ = process.argv.slice(2)) => {
  const { ip: resolvedIp, port } = parseStartArguments(arguments_, {
    allowRemoteIp: true,
  });
  const ip = hasIpArgument(arguments_) ? resolvedIp : DEFAULT_IP;
  await assertPortAvailable(port, ip);
  await verifyReleaseReport();

  const wrangler = resolve(PROJECT_ROOT, 'node_modules/wrangler/bin/wrangler.js');
  const wranglerConfig = resolve(PROJECT_ROOT, 'dist/server/wrangler.json');
  if (!existsSync(wrangler)) {
    throw new Error(
      'Wrangler saknas i node_modules. Kör `npm ci` och försök igen.',
    );
  }
  if (!existsSync(wranglerConfig)) {
    throw new Error(
      'Wrangler-konfiguration saknas. Kör `npm run build` innan mobilstart.',
    );
  }

  if (ip === '0.0.0.0') {
    process.stdout.write(
      'VARNING: Mobilläge lyssnar på alla nätverksgränssnitt.\n',
    );
    process.stdout.write(
      'Säkerställ att brandväggen endast tillåter nätet du vill exponera.\n',
    );
  }

  const child = spawn(process.execPath, createWranglerArguments({ ip, port }, wrangler, wranglerConfig), {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      WRANGLER_SEND_ERROR_REPORTS: 'false',
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_WRITE_LOGS: 'false',
      X_LOCAL_EXPLORER: 'false',
      X_LOCAL_OBSERVABILITY: 'false',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  let forwardedSignal;
  const signalHandlers = new Map();
  const forwardSignal = (signal) => {
    forwardedSignal ??= signal;
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => forwardSignal(signal);
    signalHandlers.set(signal, handler);
    process.once(signal, handler);
  }
  const removeSignalHandlers = () => {
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
  };
  child.once('error', (error) => {
    removeSignalHandlers();
    console.error(`Kunde inte starta mobilservern: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    removeSignalHandlers();
    process.exitCode = forwardedSignal ? 0 : (code ?? (signal ? 1 : 0));
  });
  return child;
};

if (typeof process.argv[1] === 'string' && process.argv[1].endsWith('start-local-mobile.mjs')) {
  try {
    await runLocalServer();
  } catch (error) {
    console.error(
      `DivineList kunde inte startas i mobilläge: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  }
}

export { runLocalServer };
