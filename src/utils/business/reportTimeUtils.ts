/**
 * Utility functions for handling report_time conversion
 * Supports backward compatibility between old number format (0-23) and new string format ("HH:mm")
 */

/**
 * Convert report_time to "HH:mm" format
 * Handles both old format (number 0-23) and new format (string "HH:mm")
 * @param reportTime - Report time (number 0-23 or string "HH:mm")
 * @returns "HH:mm" format string (e.g., "19:30") or "08:00" as default
 */
export const formatReportTime = (reportTime: string | number | undefined | null): string => {
  if (!reportTime && reportTime !== 0) {
    return '08:00'; // Default time
  }

  // If already in "HH:mm" format, validate and return
  if (typeof reportTime === 'string') {
    const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (timePattern.test(reportTime)) {
      // Normalize to 2-digit format (e.g., "9:30" -> "09:30")
      const [hour, minute] = reportTime.split(':');
      return `${hour.padStart(2, '0')}:${minute}`;
    }
  }

  // Old format: number (0-23) -> convert to "HH:mm" with minute = 0
  if (typeof reportTime === 'number') {
    if (reportTime >= 0 && reportTime < 24) {
      return `${reportTime.toString().padStart(2, '0')}:00`;
    }
  }

  // Invalid format, return default
  return '08:00';
};

/**
 * Parse report_time from "HH:mm" format to number (for backward compatibility if needed)
 * @param reportTime - Report time string in "HH:mm" format
 * @returns Hour as number (0-23) or null if invalid
 */
export const parseReportTimeToHour = (reportTime: string | number | undefined | null): number | null => {
  if (typeof reportTime === 'number') {
    return reportTime >= 0 && reportTime < 24 ? reportTime : null;
  }

  if (typeof reportTime === 'string') {
    const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = reportTime.match(timePattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
};

