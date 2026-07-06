import { execSync } from 'child_process';

const DEV_PORTS = [5000, 5173];

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getListeningPids(port) {
  if (process.platform !== 'win32') return [];

  const output = run('netstat -ano');
  const lines = output.split(/\r?\n/);

  return [...new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line.includes('LISTENING'))
      .filter((line) => {
        const parts = line.split(/\s+/);
        return parts[1]?.endsWith(`:${port}`);
      })
      .map((line) => {
        const parts = line.split(/\s+/);
        return Number(parts[parts.length - 1]);
      })
      .filter(Boolean)
  )];
}

function getProcessName(pid) {
  if (process.platform !== 'win32') return '';

  const output = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
  const firstColumn = output.split(',')[0] || '';
  return firstColumn.replace(/^"|"$/g, '').toLowerCase();
}

function killNodeProcess(pid, port) {
  const processName = getProcessName(pid);

  if (!processName || processName === 'info: no tasks are running which match the specified criteria.') {
    return;
  }

  if (processName !== 'node.exe') {
    throw new Error(`Port ${port} sedang dipakai proses lain: ${processName} (PID ${pid}). Tutup proses itu dulu agar dev server tetap memakai port default.`);
  }

  run(`taskkill /F /PID ${pid}`);
  console.log(`[dev] Port ${port}: menghentikan ${processName} lama (PID ${pid})`);
}

function main() {
  if (process.platform !== 'win32') {
    console.log('[dev] ensureDevPorts dilewati: helper ini khusus Windows.');
    return;
  }

  for (const port of DEV_PORTS) {
    const pids = getListeningPids(port);
    for (const pid of pids) {
      killNodeProcess(pid, port);
    }
  }

  console.log('[dev] Port check selesai.');
}

try {
  main();
} catch (error) {
  console.error(`[dev] ${error.message}`);
  process.exit(1);
}
