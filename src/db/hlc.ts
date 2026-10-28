// Гибридные логические часы: метка сравнивается как строка и монотонно растёт
// даже если системные часы устройства отстают.
let last = 0;
let counter = 0;
let node = 'local';

export function setNode(deviceId: string) {
  node = deviceId;
}

export function stamp(): string {
  const now = Date.now();
  if (now > last) {
    last = now;
    counter = 0;
  } else {
    counter++;
  }
  return format(last, counter, node);
}

/** Сдвинуть часы вперёд, увидев чужую метку, чтобы наши следующие метки были новее. */
export function observe(ts: string) {
  const [ms, c] = ts.split(':');
  const t = Number(ms);
  const n = Number(c);
  if (t > last || (t === last && n > counter)) {
    last = t;
    counter = n;
  }
}

function format(ms: number, c: number, id: string) {
  return `${String(ms).padStart(15, '0')}:${String(c).padStart(5, '0')}:${id}`;
}
