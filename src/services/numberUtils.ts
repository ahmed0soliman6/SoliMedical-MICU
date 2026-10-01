/**
 * Number & Digit Normalization Utility
 * Ensures all numbers in the application are standardized to English / Western numerals (0-9).
 * Automatically converts Eastern Arabic digits (٠-٩) and Persian digits (۰-۹) to standard English digits.
 */

const ARABIC_PERSIAN_DIGITS_MAP: Record<string, string> = {
  '٠': '0', '۰': '0',
  '١': '1', '۱': '1',
  '٢': '2', '۲': '2',
  '٣': '3', '۳': '3',
  '٤': '4', '۴': '4',
  '٥': '5', '۵': '5',
  '٦': '6', '۶': '6',
  '٧': '7', '۷': '7',
  '٨': '8', '۸': '8',
  '٩': '9', '۹': '9',
  '٫': '.',
  '٬': ',',
  '،': ',',
};

const ARABIC_DIGIT_REGEX = /[٠-٩۰-۹٫]/g;

/**
 * Converts any string or number containing Eastern Arabic digits to English/Western digits.
 */
export const toEnglishDigits = (input: string | number | null | undefined): string => {
  if (input === null || input === undefined) return '';
  const str = String(input);
  if (!ARABIC_DIGIT_REGEX.test(str)) {
    return str;
  }
  return str.replace(ARABIC_DIGIT_REGEX, (char) => ARABIC_PERSIAN_DIGITS_MAP[char] || char);
};

/**
 * Safely parses an input containing Arabic or English digits into a float.
 */
export const parseEnglishFloat = (input: string | number | null | undefined): number => {
  if (input === null || input === undefined || input === '') return NaN;
  const normalized = toEnglishDigits(input).trim();
  return parseFloat(normalized);
};

/**
 * Safely parses an input containing Arabic or English digits into an integer.
 */
export const parseEnglishInt = (input: string | number | null | undefined, radix = 10): number => {
  if (input === null || input === undefined || input === '') return NaN;
  const normalized = toEnglishDigits(input).trim();
  return parseInt(normalized, radix);
};

/**
 * Initializes a global DOM listener on document inputs/textareas to automatically
 * convert typed Eastern Arabic numerals to standard English numerals in real time.
 */
export const initGlobalArabicNumeralConverter = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;
    
    const tagName = target.tagName?.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea') return;
    if (target.type === 'password' || target.type === 'file') return;

    const val = target.value;
    if (val && ARABIC_DIGIT_REGEX.test(val)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const converted = toEnglishDigits(val);
      
      if (converted !== val) {
        target.value = converted;
        
        // Restore cursor position if possible
        if (start !== null && end !== null) {
          try {
            target.setSelectionRange(start, end);
          } catch {
            // Some input types (e.g. number) may throw on setSelectionRange
          }
        }
        
        // Trigger synthetic input event for React state synchronization
        const inputEvent = new Event('input', { bubbles: true });
        target.dispatchEvent(inputEvent);
      }
    }
  };

  document.addEventListener('input', handleInput, true);
};
