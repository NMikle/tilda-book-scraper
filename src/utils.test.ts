import { describe, it, expect } from 'vitest';
import {
  globToRegex,
  transformTildaImageUrl,
  sanitizeFilename,
  getBaseUrl,
  generateAnchor,
  deduplicateContentParts,
  validateUrl,
  validateBookMeta,
} from './utils.js';

describe('globToRegex', () => {
  it('matches exact strings', () => {
    const regex = globToRegex('hello');
    expect(regex.test('hello')).toBe(true);
    expect(regex.test('hello!')).toBe(false);
    expect(regex.test('say hello')).toBe(false);
  });

  it('handles * wildcard (matches anything except /)', () => {
    const regex = globToRegex('*.html');
    expect(regex.test('page.html')).toBe(true);
    expect(regex.test('index.html')).toBe(true);
    expect(regex.test('.html')).toBe(true);
    expect(regex.test('path/page.html')).toBe(false);
  });

  it('handles ** wildcard (matches anything including /)', () => {
    // ** matches any characters including /
    const regex = globToRegex('**page*.html');
    expect(regex.test('page1.html')).toBe(true);
    expect(regex.test('https://example.com/page123.html')).toBe(true);
    expect(regex.test('https://example.com/path/page456.html')).toBe(true);

    // **/file means "slash then file" at any path depth
    const regex2 = globToRegex('**/page*.html');
    expect(regex2.test('/page1.html')).toBe(true);
    expect(regex2.test('https://example.com/page123.html')).toBe(true);
    expect(regex2.test('page1.html')).toBe(false);  // no leading /
  });

  it('handles ? wildcard (matches single char)', () => {
    const regex = globToRegex('page?.html');
    expect(regex.test('page1.html')).toBe(true);
    expect(regex.test('pageA.html')).toBe(true);
    expect(regex.test('page.html')).toBe(false);
    expect(regex.test('page12.html')).toBe(false);
  });

  it('escapes regex special characters', () => {
    const regex = globToRegex('file.name+test.html');
    expect(regex.test('file.name+test.html')).toBe(true);
    expect(regex.test('fileXname+test.html')).toBe(false);
  });

  it('handles URL patterns', () => {
    const regex = globToRegex('*/page*.html');
    expect(regex.test('https://example.com/page123.html')).toBe(false); // * doesn't match /

    const regex2 = globToRegex('**/page*.html');
    expect(regex2.test('https://example.com/page123.html')).toBe(true);
  });
});

describe('transformTildaImageUrl', () => {
  it('transforms placeholder URLs to actual image URLs', () => {
    const placeholder = 'https://thb.tildacdn.com/tild3836-6132-4862-a436-623432383435/-/empty/photo.jpg';
    const expected = 'https://static.tildacdn.com/tild3836-6132-4862-a436-623432383435/photo.jpg';
    expect(transformTildaImageUrl(placeholder)).toBe(expected);
  });

  it('returns non-placeholder URLs unchanged', () => {
    const directUrl = 'https://static.tildacdn.com/tild1234/image.png';
    expect(transformTildaImageUrl(directUrl)).toBe(directUrl);
  });

  it('returns non-Tilda URLs unchanged', () => {
    const externalUrl = 'https://example.com/image.png';
    expect(transformTildaImageUrl(externalUrl)).toBe(externalUrl);
  });

  it('handles various image extensions', () => {
    const png = 'https://thb.tildacdn.com/tild1234/-/empty/image.png';
    expect(transformTildaImageUrl(png)).toBe('https://static.tildacdn.com/tild1234/image.png');

    const jpg = 'https://thb.tildacdn.com/tild1234/-/empty/photo.jpg';
    expect(transformTildaImageUrl(jpg)).toBe('https://static.tildacdn.com/tild1234/photo.jpg');

    const webp = 'https://thb.tildacdn.com/tild1234/-/empty/image.webp';
    expect(transformTildaImageUrl(webp)).toBe('https://static.tildacdn.com/tild1234/image.webp');
  });
});

describe('sanitizeFilename', () => {
  it('converts to lowercase and replaces special chars with dashes', () => {
    expect(sanitizeFilename('Hello World!')).toBe('hello-world');
  });

  it('handles Cyrillic text', () => {
    expect(sanitizeFilename('Привет Мир')).toBe('привет-мир');
  });

  it('removes leading and trailing dashes', () => {
    expect(sanitizeFilename('---test---')).toBe('test');
  });

  it('truncates to 50 characters', () => {
    const longTitle = 'This is a very long title that exceeds fifty characters limit';
    expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(50);
  });

  it('handles mixed content', () => {
    expect(sanitizeFilename('Chapter 1: Введение (Introduction)')).toBe('chapter-1-введение-introduction');
  });

  it('collapses multiple special chars into single dash', () => {
    expect(sanitizeFilename('test...file___name')).toBe('test-file-name');
  });
});

describe('getBaseUrl', () => {
  it('extracts protocol and host from URL', () => {
    expect(getBaseUrl('https://example.com/path/to/page')).toBe('https://example.com');
  });

  it('preserves port if present', () => {
    expect(getBaseUrl('http://localhost:3000/page')).toBe('http://localhost:3000');
  });

  it('handles URLs with query strings', () => {
    expect(getBaseUrl('https://example.com/page?foo=bar')).toBe('https://example.com');
  });

  it('handles URLs with fragments', () => {
    expect(getBaseUrl('https://example.com/page#section')).toBe('https://example.com');
  });

  it('throws for invalid URLs', () => {
    expect(() => getBaseUrl('not-a-url')).toThrow();
  });
});

describe('generateAnchor', () => {
  it('converts to lowercase and replaces spaces with dashes', () => {
    expect(generateAnchor('Hello World')).toBe('hello-world');
  });

  it('handles Cyrillic text', () => {
    expect(generateAnchor('Скелетные мышцы и их функции')).toBe('скелетные-мышцы-и-их-функции');
  });

  it('strips trailing spaces and punctuation (fixes broken TOC links)', () => {
    // These are the actual problematic titles from the book
    expect(generateAnchor('Опорно-двигательная система, суставы, фасции '))
      .toBe('опорно-двигательная-система-суставы-фасции');
    expect(generateAnchor('Нейромышечный синапс '))
      .toBe('нейромышечный-синапс');
    expect(generateAnchor('Фазы нейропластичности '))
      .toBe('фазы-нейропластичности');
  });

  it('strips leading spaces and punctuation', () => {
    expect(generateAnchor(' Leading space')).toBe('leading-space');
    expect(generateAnchor('...Title')).toBe('title');
  });

  it('handles punctuation at end of title', () => {
    expect(generateAnchor('Система скелетных рычагов, моменты сил, типы рычагов.'))
      .toBe('система-скелетных-рычагов-моменты-сил-типы-рычагов');
  });

  it('handles parentheses in titles', () => {
    expect(generateAnchor('Миотатический рефлекс (рефлекс на растяжение)'))
      .toBe('миотатический-рефлекс-рефлекс-на-растяжение');
    expect(generateAnchor('Центральное (ЦНС) утомление '))
      .toBe('центральное-цнс-утомление');
  });

  it('preserves hyphens from original title (GitHub/CommonMark style)', () => {
    // Space-hyphen-space becomes three hyphens (space→hyphen, original hyphen, space→hyphen)
    expect(generateAnchor('Title - with dash')).toBe('title---with-dash');
    expect(generateAnchor('Митохондрии - строение')).toBe('митохондрии---строение');
  });

  it('handles mixed content', () => {
    expect(generateAnchor('Chapter 1: Introduction (Part 1)'))
      .toBe('chapter-1-introduction-part-1');
  });
});

describe('deduplicateContentParts', () => {
  it('removes exact duplicate text content', () => {
    const parts = [
      '<p>Hello world</p>',
      '<p>Unique content</p>',
      '<p>Hello world</p>',  // duplicate
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('<p>Hello world</p>');
    expect(result[1]).toBe('<p>Unique content</p>');
  });

  it('removes duplicates with different HTML structure but same text', () => {
    const parts = [
      '<p class="foo">Same text</p>',
      '<div>Unique</div>',
      '<span class="bar">Same text</span>',  // same text, different markup
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });

  it('preserves images (does not filter them as empty content)', () => {
    const parts = [
      '<img src="image1.jpg" alt="">',
      '<p>Some text</p>',
      '<img src="image2.jpg" alt="">',
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(3);
  });

  it('deduplicates images by src attribute', () => {
    const parts = [
      '<img src="same-image.jpg" alt="">',
      '<p>Text between</p>',
      '<img src="same-image.jpg" alt="different alt">',  // same src, different alt
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });

  it('filters out empty strings', () => {
    const parts = ['', '   ', '<p>Content</p>', '\n\t'];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('<p>Content</p>');
  });

  it('preserves order (keeps first occurrence)', () => {
    const parts = ['<p>First</p>', '<p>Second</p>', '<p>First</p>', '<p>Third</p>'];
    const result = deduplicateContentParts(parts);
    expect(result).toEqual(['<p>First</p>', '<p>Second</p>', '<p>Third</p>']);
  });

  it('handles content with Cyrillic text', () => {
    const parts = [
      '<p>В программе: физиология</p>',
      '<p>Уникальный контент</p>',
      '<p>В программе: физиология</p>',  // duplicate
    ];
    const result = deduplicateContentParts(parts);
    expect(result).toHaveLength(2);
  });
});

describe('setupSignalHandlers', () => {
  it('is exported from utils', async () => {
    const utils = await import('./utils.js');
    expect(typeof utils.setupSignalHandlers).toBe('function');
  });
});

describe('onInterrupt', () => {
  it('is exported from utils', async () => {
    const utils = await import('./utils.js');
    expect(typeof utils.onInterrupt).toBe('function');
  });
});

describe('validateUrl', () => {
  it('accepts valid http URLs', () => {
    expect(validateUrl('http://example.com')).toEqual({ isValid: true });
    expect(validateUrl('http://example.com/path')).toEqual({ isValid: true });
    expect(validateUrl('http://example.com:8080/path')).toEqual({ isValid: true });
  });

  it('accepts valid https URLs', () => {
    expect(validateUrl('https://example.com')).toEqual({ isValid: true });
    expect(validateUrl('https://example.com/path/to/page')).toEqual({ isValid: true });
    expect(validateUrl('https://sub.example.com')).toEqual({ isValid: true });
  });

  it('rejects empty or missing URLs', () => {
    expect(validateUrl('')).toEqual({ isValid: false, error: 'URL is required' });
    expect(validateUrl(null as unknown as string)).toEqual({ isValid: false, error: 'URL is required' });
    expect(validateUrl(undefined as unknown as string)).toEqual({ isValid: false, error: 'URL is required' });
  });

  it('rejects invalid URL format', () => {
    expect(validateUrl('not-a-url')).toEqual({ isValid: false, error: 'Invalid URL format' });
    expect(validateUrl('example.com')).toEqual({ isValid: false, error: 'Invalid URL format' });
    expect(validateUrl('://missing-protocol.com')).toEqual({ isValid: false, error: 'Invalid URL format' });
  });

  it('rejects non-http/https protocols', () => {
    expect(validateUrl('ftp://example.com')).toEqual({ isValid: false, error: 'URL must use http or https protocol' });
    expect(validateUrl('file:///path/to/file')).toEqual({ isValid: false, error: 'URL must use http or https protocol' });
    expect(validateUrl('mailto:test@example.com')).toEqual({ isValid: false, error: 'URL must use http or https protocol' });
  });
});

describe('validateBookMeta', () => {
  const validMeta = {
    scrapedAt: '2024-01-01T00:00:00.000Z',
    startUrl: 'https://example.com/book',
    chapters: [
      { index: 0, title: 'Chapter 1', url: 'https://example.com/ch1', filename: '001-chapter-1.md' },
      { index: 1, title: 'Chapter 2', url: 'https://example.com/ch2', filename: '002-chapter-2.md' },
    ],
  };

  it('accepts valid meta.json structure', () => {
    expect(validateBookMeta(validMeta)).toEqual({ isValid: true });
  });

  it('accepts meta with empty chapters array', () => {
    const meta = { ...validMeta, chapters: [] };
    expect(validateBookMeta(meta)).toEqual({ isValid: true });
  });

  it('rejects null or non-object', () => {
    expect(validateBookMeta(null)).toEqual({ isValid: false, error: 'meta.json must be an object' });
    expect(validateBookMeta(undefined)).toEqual({ isValid: false, error: 'meta.json must be an object' });
    expect(validateBookMeta('string')).toEqual({ isValid: false, error: 'meta.json must be an object' });
    expect(validateBookMeta(123)).toEqual({ isValid: false, error: 'meta.json must be an object' });
  });

  it('rejects missing scrapedAt', () => {
    const meta = { startUrl: 'https://example.com', chapters: [] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'Missing or invalid field: scrapedAt (expected string)' });
  });

  it('rejects invalid scrapedAt type', () => {
    const meta = { ...validMeta, scrapedAt: 123 };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'Missing or invalid field: scrapedAt (expected string)' });
  });

  it('rejects missing startUrl', () => {
    const meta = { scrapedAt: '2024-01-01', chapters: [] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'Missing or invalid field: startUrl (expected string)' });
  });

  it('rejects missing chapters array', () => {
    const meta = { scrapedAt: '2024-01-01', startUrl: 'https://example.com' };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'Missing or invalid field: chapters (expected array)' });
  });

  it('rejects chapters that is not an array', () => {
    const meta = { scrapedAt: '2024-01-01', startUrl: 'https://example.com', chapters: 'not-array' };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'Missing or invalid field: chapters (expected array)' });
  });

  it('rejects chapter that is not an object', () => {
    const meta = { scrapedAt: '2024-01-01', startUrl: 'https://example.com', chapters: [null] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0] must be an object' });
  });

  it('rejects chapter that is a primitive value', () => {
    const meta = { scrapedAt: '2024-01-01', startUrl: 'https://example.com', chapters: ['string-chapter'] };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0] must be an object' });
  });

  it('rejects chapter with missing index', () => {
    const meta = {
      ...validMeta,
      chapters: [{ title: 'Ch1', url: 'https://example.com', filename: '001.md' }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0].index must be a number' });
  });

  it('rejects chapter with missing title', () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, url: 'https://example.com', filename: '001.md' }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0].title must be a string' });
  });

  it('rejects chapter with missing url', () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, title: 'Ch1', filename: '001.md' }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0].url must be a string' });
  });

  it('rejects chapter with missing filename', () => {
    const meta = {
      ...validMeta,
      chapters: [{ index: 0, title: 'Ch1', url: 'https://example.com' }],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[0].filename must be a string' });
  });

  it('reports correct index for invalid chapter', () => {
    const meta = {
      ...validMeta,
      chapters: [
        { index: 0, title: 'Ch1', url: 'https://example.com', filename: '001.md' },
        { index: 1, title: 'Ch2', url: 'https://example.com' }, // missing filename
      ],
    };
    expect(validateBookMeta(meta)).toEqual({ isValid: false, error: 'chapters[1].filename must be a string' });
  });
});
