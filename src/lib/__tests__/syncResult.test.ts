import { describe, expect, it } from 'vitest';

import { appliedOperationIds, rejectedOperationErrors } from '../syncResult';

describe('sync push result helpers', () => {
  it('extracts applied operation ids', () => {
    expect(
      [...appliedOperationIds([{ client_operation_id: 'op-1' }, { client_operation_id: null }, {}])],
    ).toEqual(['op-1']);
  });

  it('maps rejected operations to visible errors', () => {
    const errors = rejectedOperationErrors([
      {
        client_operation_id: 'op-conflict',
        code: 'CONFLICT',
        message: 'Serverstand ist neuer.',
        server_entity: { id: 'defect-1' },
      },
      {
        client_operation_id: 'op-detail',
        detail: 'Operation wird noch nicht unterstuetzt.',
      },
    ]);

    expect(errors.get('op-conflict')).toBe('Konflikt: Serverstand ist neuer.');
    expect(errors.get('op-detail')).toBe('Operation wird noch nicht unterstuetzt.');
  });
});
