export const projectDateHint = 'Format: YYYY-MM-DD, z.B. 2026-05-04.';

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

export const isValidIsoDate = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const projectDateError = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!isIsoDate(trimmed)) {
    return 'Datum bitte im Format YYYY-MM-DD eingeben.';
  }
  if (!isValidIsoDate(trimmed)) {
    return 'Datum ist kein gueltiges Kalenderdatum.';
  }
  return null;
};

export const isoDateToPickerDate = (value: string) => {
  if (!isValidIsoDate(value)) {
    return new Date();
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const pickerDateToIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
