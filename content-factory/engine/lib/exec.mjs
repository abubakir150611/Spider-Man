import { spawn, spawnSync } from 'node:child_process';

/** Runs a command, resolving with stdout/stderr. Rejects on non-zero exit. */
export function run(cmd, args, { cwd, input, timeoutMs = 0, env, logger, onStderr } = {}) {
  return new Promise((resolvePromise, reject) => {
    logger?.debug(`$ ${cmd} ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timer;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${cmd}: превышено время ожидания ${Math.round(timeoutMs / 1000)}с`));
      }, timeoutMs);
    }
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => {
      stderr += d;
      onStderr?.(String(d));
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error.code === 'ENOENT' ? new Error(`Команда не найдена: ${cmd}`) : error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise({ stdout, stderr, code });
      else {
        const tail = stderr.trim().split('\n').slice(-15).join('\n');
        const error = new Error(`${cmd} завершился с кодом ${code}:\n${tail}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

export function which(cmd) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n')[0].trim() : null;
}

export function pythonBin() {
  return process.env.CF_PYTHON || which('python3') || which('python') || 'python3';
}
