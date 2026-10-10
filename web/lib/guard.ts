const hits = new Map<string, number[]>();
let running: Promise<void> = Promise.resolve();

export function allowRequest(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = running.then(task, task);
  running = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
