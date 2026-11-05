const hasTimezoneInfo = (value: string): boolean => /[+-]\d\d:?(\d\d)?$|Z$/i.test(value);

const normaliseInput = (value: string): string => {
  const trimmed = value.trim();
  if (hasTimezoneInfo(trimmed)) return trimmed;

  // Replace space with 'T' so that Date constructor treats it as ISO string
  const isoLike = trimmed.replace(' ', 'T');
  return `${isoLike}Z`;
};

export const formatDateTime = (
  value?: string | number | Date | null,
  locale: string = 'zh-CN',
  timeZone: string = 'Asia/Shanghai'
): string => {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    date = new Date(normaliseInput(value));
  }

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  try {
    return date.toLocaleString(locale, { timeZone, hour12: false });
  } catch {
    return date.toLocaleString(locale);
  }
};
