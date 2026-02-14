/**
 * Data type formatting utilities for IRIS Table Editor
 * TypeScript versions of formatting functions shared between VS Code and desktop targets.
 *
 * These handle date, time, timestamp, and numeric formatting for IRIS database values.
 * The webview (grid.js) currently uses its own JS versions; this module provides
 * the canonical TypeScript implementations for core/backend use.
 */

/**
 * Parsed time components
 */
export interface ITimeParts {
    hours: number;
    minutes: number;
    seconds: number;
}

/**
 * Parsed timestamp components
 */
export interface ITimestampParts {
    date: Date;
    time: ITimeParts;
}

/**
 * Numeric parse result
 */
export interface INumericParseResult {
    valid: boolean;
    value?: number;
    error?: string;
    rounded?: boolean;
}

/**
 * Format a date/time value for display based on its IRIS data type
 * @param value - The raw value from the database
 * @param upperType - Uppercase data type string
 * @returns Formatted string for display
 */
export function formatDateTimeValue(value: unknown, upperType: string): string {
    if (!value) {
        return String(value);
    }

    try {
        const date = new Date(value as string | number);
        if (isNaN(date.getTime())) {
            return String(value);
        }

        // TIME only - show time portion
        if (upperType.includes('TIME') && !upperType.includes('TIMESTAMP') && !upperType.includes('DATETIME')) {
            return date.toLocaleTimeString();
        }
        // DATE only - show date portion
        if (upperType === 'DATE') {
            return date.toLocaleDateString();
        }
        // TIMESTAMP/DATETIME - show both date and time
        return date.toLocaleString();
    } catch {
        return String(value);
    }
}

/**
 * Format a numeric value for display with thousands separators
 * @param value - Numeric value
 * @param dataType - Column data type
 * @returns Formatted number string
 */
export function formatNumericValue(value: unknown, dataType: string): string {
    const num = Number(value);
    if (isNaN(num)) {
        return String(value);
    }

    const upperType = dataType.toUpperCase();

    // Integer types - no decimal places
    if (['INTEGER', 'SMALLINT', 'BIGINT', 'TINYINT'].some(t => upperType.includes(t))) {
        return Math.round(num).toLocaleString();
    }

    // Decimal/float types - preserve decimal places but use locale formatting
    return num.toLocaleString(undefined, { maximumFractionDigits: 10 });
}

/**
 * Parse user time input in various formats
 * Supports: HH:MM:SS, HH:MM, 12-hour with AM/PM
 * @param input - User input string
 * @returns Parsed time parts or null if invalid
 */
export function parseUserTimeInput(input: string): ITimeParts | null {
    if (!input || input.trim() === '') {
        return null;
    }

    const trimmed = input.trim();

    // Try HH:MM:SS (24-hour with seconds)
    const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (fullMatch) {
        const hours = parseInt(fullMatch[1]);
        const minutes = parseInt(fullMatch[2]);
        const seconds = parseInt(fullMatch[3]);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
            return { hours, minutes, seconds };
        }
    }

    // Try HH:MM (24-hour, no seconds)
    const shortMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (shortMatch) {
        const hours = parseInt(shortMatch[1]);
        const minutes = parseInt(shortMatch[2]);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return { hours, minutes, seconds: 0 };
        }
    }

    // Try 12-hour format with AM/PM (optional seconds)
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|a|p)\.?$/i);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1]);
        const minutes = parseInt(ampmMatch[2]);
        const seconds = ampmMatch[3] ? parseInt(ampmMatch[3]) : 0;
        const meridian = ampmMatch[4].toUpperCase();
        const isPM = meridian === 'PM' || meridian === 'P';

        // Validate 12-hour range
        if (hours < 1 || hours > 12) {
            return null;
        }

        // Convert to 24-hour
        if (isPM && hours !== 12) {
            hours += 12;
        }
        if (!isPM && hours === 12) {
            hours = 0;
        }

        if (minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
            return { hours, minutes, seconds };
        }
    }

    return null;
}

/**
 * Format time object for IRIS storage (HH:MM:SS)
 * @param time - Time parts object
 * @returns HH:MM:SS formatted string
 */
export function formatTimeForIRIS(time: ITimeParts): string {
    const { hours, minutes, seconds } = time;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parse user date input in various formats
 * Supports: YYYY-MM-DD (ISO), DD-MM-YYYY (EU), MM/DD/YYYY (US), natural language
 * @param input - User input string
 * @returns Parsed Date or null if invalid
 */
export function parseUserDateInput(input: string): Date | null {
    if (!input || input.trim() === '') {
        return null;
    }

    const trimmed = input.trim();

    // Try ISO format first: YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try DD-MM-YYYY (with dash separator - EU convention)
    const euDashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (euDashMatch) {
        const day = parseInt(euDashMatch[1]);
        const month = parseInt(euDashMatch[2]);
        const year = parseInt(euDashMatch[3]);
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Try MM/DD/YYYY (with slash separator - US convention)
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
        const month = parseInt(usMatch[1]);
        const day = parseInt(usMatch[2]);
        const year = parseInt(usMatch[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        // If first number > 12, try as DD/MM/YYYY
        if (month > 12 && day >= 1 && day <= 12) {
            const date = new Date(year, day - 1, month);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
    }

    // Try natural language via Date.parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

/**
 * Format a Date object for IRIS storage (YYYY-MM-DD)
 * @param date - Date object
 * @returns YYYY-MM-DD formatted string
 */
export function formatDateForIRIS(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse user timestamp input in various formats
 * Supports: ISO with T separator, space-separated date+time, date-only (defaults to 00:00:00)
 * @param input - User input string
 * @returns Parsed timestamp parts or null if invalid
 */
export function parseUserTimestampInput(input: string): ITimestampParts | null {
    if (!input || input.trim() === '') {
        return null;
    }

    const trimmed = input.trim();

    // Try ISO format with T separator: YYYY-MM-DDTHH:MM:SS
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (isoMatch) {
        const date = parseUserDateInput(isoMatch[1]);
        const time = parseUserTimeInput(isoMatch[2]);
        if (date && time) {
            return { date, time };
        }
    }

    // Try space-separated: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
    const spaceSplit = trimmed.split(/\s+/);
    if (spaceSplit.length >= 2) {
        const lastPart = spaceSplit[spaceSplit.length - 1];
        const secondLastPart = spaceSplit.length >= 3 ? spaceSplit[spaceSplit.length - 2] : null;

        // Handle "Feb 1, 2026 2:30 PM" style
        if (lastPart.match(/^(AM|PM|am|pm|a|p)\.?$/i) && secondLastPart && secondLastPart.includes(':')) {
            const timePart = secondLastPart + ' ' + lastPart;
            const datePart = spaceSplit.slice(0, -2).join(' ');
            const date = parseUserDateInput(datePart);
            const time = parseUserTimeInput(timePart);
            if (date && time) {
                return { date, time };
            }
        } else if (lastPart.includes(':')) {
            const timePart = lastPart;
            const datePart = spaceSplit.slice(0, -1).join(' ');
            const date = parseUserDateInput(datePart);
            const time = parseUserTimeInput(timePart);
            if (date && time) {
                return { date, time };
            }
        }
    }

    // Try date-only input - default time to 00:00:00
    const dateOnly = parseUserDateInput(trimmed);
    if (dateOnly) {
        return { date: dateOnly, time: { hours: 0, minutes: 0, seconds: 0 } };
    }

    return null;
}

/**
 * Format timestamp for IRIS storage (YYYY-MM-DD HH:MM:SS)
 * @param date - Date object
 * @param time - Time parts object
 * @returns YYYY-MM-DD HH:MM:SS formatted string
 */
export function formatTimestampForIRIS(date: Date, time: ITimeParts): string {
    const datePart = formatDateForIRIS(date);
    const timePart = formatTimeForIRIS(time);
    return `${datePart} ${timePart}`;
}

/**
 * Parse and validate numeric input
 * @param input - User input string
 * @param isInteger - Whether integer type (no decimals allowed)
 * @returns Parse result or null for empty input
 */
export function parseNumericInput(input: string, isInteger: boolean): INumericParseResult | null {
    if (!input || input.trim() === '') {
        return null;
    }

    // Remove any existing thousands separators
    const cleaned = input.trim().replace(/,/g, '');

    const num = Number(cleaned);
    if (isNaN(num)) {
        return { valid: false, error: 'Invalid number' };
    }

    if (isInteger && !Number.isInteger(num)) {
        return { valid: true, value: Math.round(num), rounded: true };
    }

    return { valid: true, value: num };
}
