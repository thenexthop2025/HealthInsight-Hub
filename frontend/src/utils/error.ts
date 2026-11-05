export function extractErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (!error) {
    return fallback;
  }

  const responseDetail = (error as any)?.response?.data?.detail;
  const message = (error as any)?.message;
  const detail = responseDetail ?? message ?? error;

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (!item) {
          return '';
        }
        if (typeof item === 'string') {
          return item;
        }
        if (typeof item === 'object') {
          const msg = (item as any).msg || (item as any).message;
          const loc = (item as any).loc;
          if (msg && loc) {
            return `${msg} (${loc})`;
          }
          return msg || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('; ');
    }
  }

  if (typeof detail === 'object') {
    const obj = detail as any;
    if (obj.msg || obj.message) {
      const loc = obj.loc ? ` (${obj.loc})` : '';
      return `${obj.msg || obj.message}${loc}`;
    }
    try {
      return JSON.stringify(detail);
    } catch (error) {
      return fallback;
    }
  }

  if (typeof detail === 'string') {
    return detail;
  }

  return fallback;
}
