function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function daysFromToday(value, todayValue = today()) {
  if (!isDateOnly(value) || !isDateOnly(todayValue)) return NaN;
  const target = Date.parse(`${value}T00:00:00.000Z`);
  const current = Date.parse(`${todayValue}T00:00:00.000Z`);
  return (target - current) / 86400000;
}

module.exports = { today, isDateOnly, daysFromToday };
