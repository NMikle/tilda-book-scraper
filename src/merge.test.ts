import { describe, it, expect } from 'vitest';
import { parseArgs, fixImagePaths, generateTocEntry, ChapterMeta } from './merge.js';

describe('parseArgs', () => {
  it('returns default name when no args provided', () => {
    expect(parseArgs([])).toEqual({ name: 'Book' });
  });

  it('parses --name flag', () => {
    expect(parseArgs(['--name', 'My Book'])).toEqual({ name: 'My Book' });
  });

  it('handles name with spaces', () => {
    expect(parseArgs(['--name', 'My Amazing Book Title'])).toEqual({ name: 'My Amazing Book Title' });
  });

  it('ignores unknown flags', () => {
    expect(parseArgs(['--unknown', 'value', '--name', 'Test'])).toEqual({ name: 'Test' });
  });

  it('uses default when --name has no value', () => {
    expect(parseArgs(['--name'])).toEqual({ name: 'Book' });
  });

  it('uses last --name value when multiple provided', () => {
    expect(parseArgs(['--name', 'First', '--name', 'Second'])).toEqual({ name: 'Second' });
  });
});

describe('fixImagePaths', () => {
  it('converts ../images/ to ./images/', () => {
    const input = '![alt](../images/photo.jpg)';
    expect(fixImagePaths(input)).toBe('![alt](./images/photo.jpg)');
  });

  it('handles multiple image references', () => {
    const input = '![a](../images/1.jpg)\n![b](../images/2.jpg)';
    expect(fixImagePaths(input)).toBe('![a](./images/1.jpg)\n![b](./images/2.jpg)');
  });

  it('preserves other paths unchanged', () => {
    const input = '![alt](./other/path.jpg)';
    expect(fixImagePaths(input)).toBe('![alt](./other/path.jpg)');
  });

  it('handles content without images', () => {
    const input = '# Chapter 1\n\nSome text content.';
    expect(fixImagePaths(input)).toBe('# Chapter 1\n\nSome text content.');
  });

  it('handles mixed content', () => {
    const input = '# Title\n\n![img](../images/test.jpg)\n\nText after image.';
    expect(fixImagePaths(input)).toBe('# Title\n\n![img](./images/test.jpg)\n\nText after image.');
  });
});

describe('generateTocEntry', () => {
  it('generates numbered markdown link', () => {
    const chapter: ChapterMeta = {
      index: 0,
      title: 'Introduction',
      url: 'https://example.com/intro',
      filename: '001-introduction.md',
    };
    expect(generateTocEntry(chapter)).toBe('1. [Introduction](#introduction)');
  });

  it('handles Cyrillic titles', () => {
    const chapter: ChapterMeta = {
      index: 4,
      title: 'Скелетные мышцы',
      url: 'https://example.com/muscles',
      filename: '005-muscles.md',
    };
    expect(generateTocEntry(chapter)).toBe('5. [Скелетные мышцы](#скелетные-мышцы)');
  });

  it('handles titles with special characters', () => {
    const chapter: ChapterMeta = {
      index: 9,
      title: 'Chapter 10: The End (Final)',
      url: 'https://example.com/end',
      filename: '010-end.md',
    };
    expect(generateTocEntry(chapter)).toBe('10. [Chapter 10: The End (Final)](#chapter-10-the-end-final)');
  });

  it('handles titles with trailing spaces', () => {
    const chapter: ChapterMeta = {
      index: 1,
      title: 'Title with space ',
      url: 'https://example.com/test',
      filename: '002-test.md',
    };
    expect(generateTocEntry(chapter)).toBe('2. [Title with space ](#title-with-space)');
  });

  it('preserves hyphens in titles', () => {
    const chapter: ChapterMeta = {
      index: 33,
      title: 'Митохондрии - строение',
      url: 'https://example.com/mito',
      filename: '034-mito.md',
    };
    expect(generateTocEntry(chapter)).toBe('34. [Митохондрии - строение](#митохондрии---строение)');
  });
});
