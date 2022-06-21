
export function dateDiff(a, b, output = 'object') {
  if (b === null || b === undefined) {
    b = new Date(new Date().getTime()); // utc now
  }
  const seconds = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };
  let delta = Math.abs((a - b) / 1000);
  let diff = {};
  Object.keys((seconds)).filter((p, pI) => Number.isInteger(output) ? pI <= output : true).forEach((period) => {
    diff[period] = Math.floor(delta / seconds[period]);
    delta -= diff[period] * seconds[period];
  });
  switch (output) {
    case 'object':
      return diff;
    case 'significant':
    case 1:
      return (diff.year > 0)
        ? `${diff.year} year${(diff.year > 1) ? 's' : ''}`
        : (diff.month > 0)
          ? `${diff.month} month${(diff.month > 1) ? 's' : ''}`
          : (diff.week > 0)
            ? `${diff.week} week${(diff.week > 1) ? 's' : ''}`
            : (diff.day > 0)
              ? `${diff.day} day${(diff.day > 1) ? 's' : ''}`
              : (diff.hour > 0)
                ? `${diff.hour} hour${(diff.hour > 1) ? 's' : ''}`
                : (diff.minute > 0)
                  ? `${diff.minute} minute${(diff.minute > 1) ? 's' : ''}`
                  : (diff.second > 0)
                    ? `${diff.second} second${(diff.second > 1) ? 's' : ''}`
                    : '';
    case 2:
    default:
      return Object.keys(diff).map((period) => `${(diff[period] > 0) ? `${diff[period]} ${period}${(diff[period] > 1) ? 's' : ''}`: ''}`).filter((x) => !!x).join(', ');
  }
}
