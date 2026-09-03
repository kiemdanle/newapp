import { act, renderHook } from '@testing-library/react-native';
import { usePantryScope } from '../../src/store/pantryScope';
import { useActiveRecords, patchLocalRecord } from '../../src/api/records';
import { database } from '../../src/db/index';
import { triggerSyncSoon } from '../../src/db/triggers';
import { Q } from '@nozbe/watermelondb';

describe('PantryScope Store and Query Mechanics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      usePantryScope.getState().setScope('all', null);
    });
  });

  describe('usePantryScope store', () => {
    it('initializes with scope="all" and householdId=null', () => {
      const { result } = renderHook(() => usePantryScope());
      expect(result.current.scope).toBe('all');
      expect(result.current.householdId).toBeNull();
    });

    it('transitions to personal scope and clears householdId', () => {
      const { result } = renderHook(() => usePantryScope());
      act(() => {
        result.current.setScope('personal');
      });
      expect(result.current.scope).toBe('personal');
      expect(result.current.householdId).toBeNull();
    });

    it('transitions to household scope with householdId', () => {
      const { result } = renderHook(() => usePantryScope());
      act(() => {
        result.current.setScope('household', 'hh-123');
      });
      expect(result.current.scope).toBe('household');
      expect(result.current.householdId).toBe('hh-123');
    });

    it('transitions back to all scope', () => {
      const { result } = renderHook(() => usePantryScope());
      act(() => {
        result.current.setScope('household', 'hh-456');
      });
      act(() => {
        result.current.setScope('all');
      });
      expect(result.current.scope).toBe('all');
      expect(result.current.householdId).toBeNull();
    });
  });

  describe('useActiveRecords query condition construction', () => {
    it('queries active records without household_id condition when scope is "all"', () => {
      const queryMock = jest.fn().mockReturnValue({
        observe: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
      });
      const recordsCol = {
        query: queryMock,
      };
      jest.spyOn(database, 'get').mockReturnValue(recordsCol as any);

      act(() => {
        usePantryScope.getState().setScope('all');
      });

      renderHook(() => useActiveRecords());

      expect(queryMock).toHaveBeenCalledWith(
        Q.where('status', 'active'),
        Q.where('pending_delete', false),
      );
    });

    it('queries active records constrained to household_id = null when scope is "personal"', () => {
      const queryMock = jest.fn().mockReturnValue({
        observe: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
      });
      const recordsCol = {
        query: queryMock,
      };
      jest.spyOn(database, 'get').mockReturnValue(recordsCol as any);

      act(() => {
        usePantryScope.getState().setScope('personal');
      });

      renderHook(() => useActiveRecords());

      expect(queryMock).toHaveBeenCalledWith(
        Q.where('status', 'active'),
        Q.where('pending_delete', false),
        Q.where('household_id', null),
      );
    });

    it('queries active records constrained to household_id = householdId when scope is "household"', () => {
      const queryMock = jest.fn().mockReturnValue({
        observe: () => ({ subscribe: () => ({ unsubscribe: jest.fn() }) }),
      });
      const recordsCol = {
        query: queryMock,
      };
      jest.spyOn(database, 'get').mockReturnValue(recordsCol as any);

      act(() => {
        usePantryScope.getState().setScope('household', 'hh-999');
      });

      renderHook(() => useActiveRecords());

      expect(queryMock).toHaveBeenCalledWith(
        Q.where('status', 'active'),
        Q.where('pending_delete', false),
        Q.where('household_id', 'hh-999'),
      );
    });
  });

  describe('patchLocalRecord with householdId', () => {
    it('updates householdId, sets pendingSync=true, and calls triggerSyncSoon', async () => {
      const recMock = {
        householdId: null as string | null,
        pendingSync: false,
        update: jest.fn(async (cb: (r: any) => void) => {
          cb(recMock);
        }),
      };
      const recordsCol = {
        find: jest.fn().mockResolvedValue(recMock),
      };
      jest.spyOn(database, 'get').mockReturnValue(recordsCol as any);

      await patchLocalRecord('rec-1', { householdId: 'hh-abc' });

      expect(recordsCol.find).toHaveBeenCalledWith('rec-1');
      expect(recMock.update).toHaveBeenCalled();
      expect(recMock.householdId).toBe('hh-abc');
      expect(recMock.pendingSync).toBe(true);
      expect(triggerSyncSoon).toHaveBeenCalled();
    });

    it('clears householdId to null when moving to personal pantry', async () => {
      const recMock = {
        householdId: 'hh-abc' as string | null,
        pendingSync: false,
        update: jest.fn(async (cb: (r: any) => void) => {
          cb(recMock);
        }),
      };
      const recordsCol = {
        find: jest.fn().mockResolvedValue(recMock),
      };
      jest.spyOn(database, 'get').mockReturnValue(recordsCol as any);

      await patchLocalRecord('rec-2', { householdId: null });

      expect(recMock.householdId).toBeNull();
      expect(recMock.pendingSync).toBe(true);
      expect(triggerSyncSoon).toHaveBeenCalled();
    });
  });
});
