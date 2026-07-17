import { describe, it, expect } from 'vitest';
import { canTransition, getNextStates, isActiveStatus, isOngoingStatus, canCancel } from '../state-machine';

describe('canTransition', () => {
  const validTransitions: Array<[string, string, boolean]> = [
    ['requested', 'quoted', true],
    ['requested', 'confirmed', true],
    ['requested', 'cancelled', true],
    ['requested', 'driver_assigned', false],
    ['quoted', 'confirmed', true],
    ['quoted', 'cancelled', true],
    ['quoted', 'driver_assigned', false],
    ['confirmed', 'driver_assigned', true],
    ['confirmed', 'cancelled', true],
    ['confirmed', 'in_progress', false],
    ['driver_assigned', 'arriving', true],
    ['driver_assigned', 'cancelled', true],
    ['driver_assigned', 'in_progress', false],
    ['arriving', 'in_progress', true],
    ['arriving', 'cancelled', true],
    ['arriving', 'completed', false],
    ['in_progress', 'completed', true],
    ['in_progress', 'cancelled', false],
    ['completed', 'cancelled', false],
    ['completed', 'requested', false],
    ['cancelled', 'requested', false],
    ['cancelled', 'completed', false]
  ];

  it.each(validTransitions)('from %s to %s should be %s', (from, to, expected) => {
    expect(canTransition(from as Parameters<typeof canTransition>[0], to as Parameters<typeof canTransition>[1])).toBe(expected);
  });

  it('rejects unknown statuses', () => {
    expect(canTransition('unknown' as Parameters<typeof canTransition>[0], 'completed' as Parameters<typeof canTransition>[1])).toBe(false);
  });
});

describe('getNextStates', () => {
  it('returns next states for requested', () => {
    const next = getNextStates('requested');
    expect(next).toContain('quoted');
    expect(next).toContain('confirmed');
    expect(next).toContain('cancelled');
    expect(next).not.toContain('completed');
  });

  it('returns empty for completed', () => {
    expect(getNextStates('completed')).toEqual([]);
  });

  it('returns empty for cancelled', () => {
    expect(getNextStates('cancelled')).toEqual([]);
  });

  it('returns driver_assigned, cancelled for confirmed', () => {
    const next = getNextStates('confirmed');
    expect(next).toContain('driver_assigned');
    expect(next).toContain('cancelled');
  });
});

describe('isActiveStatus', () => {
  it('returns true for non-terminal states', () => {
    expect(isActiveStatus('requested')).toBe(true);
    expect(isActiveStatus('in_progress')).toBe(true);
  });

  it('returns false for terminal states', () => {
    expect(isActiveStatus('completed')).toBe(false);
    expect(isActiveStatus('cancelled')).toBe(false);
  });
});

describe('isOngoingStatus', () => {
  it('returns true for driver_assigned, arriving, in_progress', () => {
    expect(isOngoingStatus('driver_assigned')).toBe(true);
    expect(isOngoingStatus('arriving')).toBe(true);
    expect(isOngoingStatus('in_progress')).toBe(true);
  });

  it('returns false for pre-assignment states', () => {
    expect(isOngoingStatus('requested')).toBe(false);
    expect(isOngoingStatus('confirmed')).toBe(false);
  });
});

describe('canCancel', () => {
  it('customer can cancel requested/quoted/confirmed', () => {
    expect(canCancel('customer', 'requested')).toBe(true);
    expect(canCancel('customer', 'quoted')).toBe(true);
    expect(canCancel('customer', 'confirmed')).toBe(true);
    expect(canCancel('customer', 'driver_assigned')).toBe(false);
    expect(canCancel('customer', 'in_progress')).toBe(false);
  });

  it('driver can cancel driver_assigned/arriving', () => {
    expect(canCancel('driver', 'driver_assigned')).toBe(true);
    expect(canCancel('driver', 'arriving')).toBe(true);
    expect(canCancel('driver', 'requested')).toBe(false);
    expect(canCancel('driver', 'confirmed')).toBe(false);
  });

  it('admin can cancel any active status', () => {
    expect(canCancel('tenant_admin', 'requested')).toBe(true);
    expect(canCancel('tenant_admin', 'in_progress')).toBe(true);
    expect(canCancel('tenant_admin', 'completed')).toBe(false);
  });
});
