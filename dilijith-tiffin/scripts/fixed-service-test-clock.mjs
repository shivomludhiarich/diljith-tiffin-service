// Keep API fixtures on a service day; Sunday behavior has separate regression cases.
const NativeDate = Date;
let instant = NativeDate.parse('2026-10-22T00:00:00+05:30');
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
};
Object.defineProperty(globalThis.Date, 'name', { value: 'Date' });

export const setTestNow = value => { instant = NativeDate.parse(value); };
