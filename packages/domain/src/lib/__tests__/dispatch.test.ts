import { describe, it, expect } from 'vitest';
import { selectBestDriver, shouldAutoAssign, type NearbyDriver } from '../dispatch';

const mockDrivers: NearbyDriver[] = [
  { driverId: '1', profileId: 'p1', displayName: 'Carlos', rating: 4.5, distanceKm: 3.2, latitude: 23.1, longitude: -82.3 },
  { driverId: '2', profileId: 'p2', displayName: 'Maria', rating: 4.8, distanceKm: 5.1, latitude: 23.2, longitude: -82.4 },
  { driverId: '3', profileId: 'p3', displayName: 'Jose', rating: 4.2, distanceKm: 1.5, latitude: 23.0, longitude: -82.2 }
];

describe('selectBestDriver', () => {
  it('returns null for empty list', () => {
    expect(selectBestDriver([])).toBeNull();
  });

  it('selects closest driver by default', () => {
    const best = selectBestDriver(mockDrivers);
    expect(best?.driverId).toBe('3');
    expect(best?.distanceKm).toBe(1.5);
  });

  it('selects highest rated when preferHigherRated', () => {
    const best = selectBestDriver(mockDrivers, { preferHigherRated: true });
    expect(best?.driverId).toBe('2');
    expect(best?.rating).toBe(4.8);
  });

  it('selects closest when preferCloser is true', () => {
    const best = selectBestDriver(mockDrivers, { preferCloser: true });
    expect(best?.driverId).toBe('3');
  });
});

describe('shouldAutoAssign', () => {
  it('returns false when autoAssign is disabled', () => {
    const result = shouldAutoAssign(new Date(), {
      autoAssignEnabled: false,
      maxWaitMinutes: 5,
      driverQuotesEnabled: false
    });
    expect(result).toBe(false);
  });

  it('returns true when quotes disabled and auto enabled', () => {
    const result = shouldAutoAssign(new Date(), {
      autoAssignEnabled: true,
      maxWaitMinutes: 5,
      driverQuotesEnabled: false
    });
    expect(result).toBe(true);
  });

  it('returns false when quotes enabled and wait time not exceeded', () => {
    const result = shouldAutoAssign(new Date(), {
      autoAssignEnabled: true,
      maxWaitMinutes: 5,
      driverQuotesEnabled: true
    });
    expect(result).toBe(false);
  });

  it('returns true when quotes enabled and wait time exceeded', () => {
    const fiveMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const result = shouldAutoAssign(fiveMinutesAgo, {
      autoAssignEnabled: true,
      maxWaitMinutes: 5,
      driverQuotesEnabled: true
    });
    expect(result).toBe(true);
  });
});
