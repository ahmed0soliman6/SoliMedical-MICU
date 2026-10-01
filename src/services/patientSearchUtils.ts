/**
 * Soli Medical MICU (ICU-Sync) - Patient Search & Normalization Utilities
 * 
 * Provides deterministic text normalization, National ID hashing,
 * and exact search query helpers matching the Firestore Patient-Centric SSOT.
 */

import { toEnglishDigits } from './numberUtils.ts';

// Arabic Diacritics (Tashkeel) regex
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;

/**
 * Normalizes an Arabic or English full name for deterministic search index matching.
 * - Strips all Arabic diacritics / tashkeel
 * - Unifies Alef variations (أ, إ, آ, ٱ -> ا)
 * - Unifies Taa Marbuta (ة -> ه)
 * - Unifies Yaa / Alef Maqsura (ى -> ي)
 * - Replaces multiple spaces with a single space
 * - Lowercases Latin characters
 */
export function normalizeArabicName(input: string | null | undefined): string {
  if (!input) return '';
  let normalized = input.trim().toLowerCase();

  // Strip diacritics
  normalized = normalized.replace(ARABIC_DIACRITICS_REGEX, '');

  // Unify Alef forms
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // Unify Taa Marbuta
  normalized = normalized.replace(/ة/g, 'ه');

  // Unify Alef Maqsura
  normalized = normalized.replace(/ى/g, 'ي');

  // Normalize spaces & punctuation
  normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extracts the last 4 digits of a National ID or MRN string, normalized to standard English numerals.
 */
export function extractLast4(input: string | null | undefined): string {
  if (!input) return '';
  const digitsOnly = toEnglishDigits(input).replace(/\D/g, '');
  if (digitsOnly.length <= 4) return digitsOnly;
  return digitsOnly.slice(-4);
}

/**
 * Computes SHA-256 hash using Web Crypto API (or fallback).
 */
export async function computeSha256Hash(text: string): Promise<string> {
  if (!text) return '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback for non-crypto environment
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}
