function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== "string") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    });

    return true;
  } catch {
    return false;
  }
}

function getTimezoneOffsetMinutes(timezone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  });

  const parts = formatter.formatToParts(date);

  const offsetPart = parts.find((part) => part.type === "timeZoneName");

  if (!offsetPart) {
    return 0;
  }

  const match = offsetPart.value.match(/GMT([+-])(\d{2}):(\d{2})/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);

  return sign * (hours * 60 + minutes);
}

module.exports = {
  isValidTimezone,
  getTimezoneOffsetMinutes,
};
