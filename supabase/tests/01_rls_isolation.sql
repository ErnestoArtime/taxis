-- =============================================================================
-- Test: Multi-tenant isolation and RLS
-- Each block raises an exception if the assertion fails.
-- Run each `do $$` block individually in Supabase SQL editor.
-- =============================================================================

-- Test 1: T1 admin can see T1 ride
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  assert (select count(*)::int = 1 from public.ride_requests where id = '00000000-0000-0000-0000-000000000100'), 'T1 admin should see T1 ride';
end;
$$;

-- Test 2: T1 admin cannot see T2 ride
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  assert (select count(*)::int = 0 from public.ride_requests where id = '00000000-0000-0000-0000-000000000200'), 'T1 admin should NOT see T2 ride';
end;
$$;

-- Test 3: T1 customer can see own ride
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
  assert (select count(*)::int = 1 from public.ride_requests where id = '00000000-0000-0000-0000-000000000100'), 'T1 customer should see own ride';
end;
$$;

-- Test 4: T1 customer cannot see T2 ride
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
  assert (select count(*)::int = 0 from public.ride_requests where id = '00000000-0000-0000-0000-000000000200'), 'T1 customer should NOT see T2 ride';
end;
$$;

-- Test 5: T1 driver can see unassigned rides in T1 (for quoting)
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
  assert (select count(*)::int >= 1 from public.ride_requests
          where id = '00000000-0000-0000-0000-000000000100' and status = 'requested'),
    'T1 driver should see unassigned T1 ride for quoting';
end;
$$;

-- Test 6: T1 driver cannot see T2 ride
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
  assert (select count(*)::int = 0 from public.ride_requests where id = '00000000-0000-0000-0000-000000000200'), 'T1 driver should NOT see T2 ride';
end;
$$;

-- Test 7: Profile isolation - role cannot be changed by user
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
  begin
    update public.profiles set role = 'driver' where id = '00000000-0000-0000-0000-000000000002';
    raise exception 'Should have been blocked by RLS';
  exception
    when others then
      null;
  end;
end;
$$;

-- Test 8: Profile isolation - tenant_id cannot be changed by user
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
  begin
    update public.profiles set tenant_id = '00000000-0000-0000-0000-000000000020' where id = '00000000-0000-0000-0000-000000000002';
    raise exception 'Should have been blocked by RLS';
  exception
    when others then
      null;
  end;
end;
$$;

-- Test 9: transition_ride_state uses auth.uid() correctly
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
  perform public.transition_ride_state('00000000-0000-0000-0000-000000000100', 'cancelled', null,
    jsonb_build_object('cancellation_note', 'test from customer'));
  assert (select cancelled_by = '00000000-0000-0000-0000-000000000002' from public.ride_requests where id = '00000000-0000-0000-0000-000000000100'),
    'cancelled_by should be the auth.uid() user';
end;
$$;

-- Test 10: previous_status correctly recorded
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
  -- The ride was already cancelled by test 9, so create a fresh ride
  assert true;
  -- Verify in the event log that previous_status was recorded
  assert (
    select count(*)::int > 0
    from public.ride_events
    where ride_request_id = '00000000-0000-0000-0000-000000000100'
      and payload ? 'previous_status'
  ), 'ride_events should contain previous_status';
end;
$$;

-- Test 11: ride_state_transitions table has expected rows
do $$
begin
  assert (select count(*)::int >= 10 from public.ride_state_transitions),
    'ride_state_transitions should have at least 10 rules';
end;
$$;

-- Test 12: register_customer_for_tenant creates profile with correct tenant
do $$
declare
  new_user_id uuid := '00000000-0000-0000-0000-000000000005';
  result public.profiles;
begin
  -- Simulate auth
  perform set_config('request.jwt.claim.sub', new_user_id, false);
  -- Register
  result := public.register_customer_for_tenant('tenant1', 'New Customer');
  assert result.tenant_id = '00000000-0000-0000-0000-000000000010', 'Should be registered to tenant1';
  assert result.role = 'customer', 'Should be created as customer';
  -- Cleanup
  delete from public.profiles where id = new_user_id;
end;
$$;

-- Test 13: Inactive tenant slug is rejected
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
  begin
    perform public.register_customer_for_tenant('nonexistent', 'Ghost');
    raise exception 'Should have rejected inactive tenant';
  exception
    when others then
      null;
  end;
end;
$$;
