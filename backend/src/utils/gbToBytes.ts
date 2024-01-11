export const gbToBytes = (gb?: number) =>
  gb ? gb * 1024 * 1024 * 1024 : 500 * 1024 * 1024 * 1024;
