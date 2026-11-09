import { describe, expect, it } from 'vitest';

import { clientIp, trustedHops } from './client-ip';


describe('clientIp', () => {
  it('proxysiz (hops=0) — sarlavhaga ishonilmaydi', () => {
    expect(clientIp('1.2.3.4', 0)).toBeNull();
    expect(clientIp(null, 1)).toBeNull();
  });

  it('bitta proxy — o‘ngdagi yozuv olinadi, mijoz qo‘shgan soxta chap qism e’tiborsiz', () => {
    expect(clientIp('10.0.0.5', 1)).toBe('10.0.0.5');
    expect(clientIp('6.6.6.6, 10.0.0.5', 1)).toBe('10.0.0.5');
    expect(clientIp('6.6.6.6,7.7.7.7 , 10.0.0.5', 1)).toBe('10.0.0.5');
  });

  it('ikki proxy — o‘ngdan ikkinchi', () => {
    expect(clientIp('6.6.6.6, 10.0.0.5, 172.16.0.1', 2)).toBe('10.0.0.5');
  });

  it('yozuv yetmasa yoki manzil buzuq bo‘lsa — null', () => {
    expect(clientIp('10.0.0.5', 2)).toBeNull();
    expect(clientIp('not an ip', 1)).toBeNull();
  });

  it('IPv6', () => {
    expect(clientIp('::ffff:10.0.0.5', 1)).toBe('::ffff:10.0.0.5');
  });
});

describe('trustedHops', () => {
  it('yo‘q yoki noto‘g‘ri qiymat — 0', () => {
    expect(trustedHops(undefined)).toBe(0);
    expect(trustedHops('abc')).toBe(0);
    expect(trustedHops('-1')).toBe(0);
    expect(trustedHops('1')).toBe(1);
  });
});
