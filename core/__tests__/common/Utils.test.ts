import {
  getCurrentDate,
  parseDate,
  parseIntOrThrow,
} from '../../src/common/Utils';

describe('Int parser', () => {
  it('parses numbers', () => {
    expect(parseIntOrThrow('1234')).toBe(1234);
  });

  it('returns a proper error', () => {
    expect(() => parseIntOrThrow('dfd')).toThrow(Error);
  });
});

describe('Current date', () => {
  it('is returned', () => {
    const currentDate = getCurrentDate();
    expect(currentDate.length).toBe(10);
    expect(currentDate.split('-')).toHaveLength(3);
  });
  it('can be parsed', () => {
    expect(parseDate('2021-12-20').toMillis()).toBe(1639958400000);
  });
});
