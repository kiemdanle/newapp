import { useState, useEffect } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database, RecordModel } from '../../db';
import { useSessionStore } from '../../auth/session-store';

/**
 * Returns the count of active pantry items created by the current user across
 * both personal and shared household pantries. Excludes items pending deletion
 * and items created by other household members.
 */
export function useMyActiveRecordCount(): number {
  const currentUserId = useSessionStore((s) => s.user?.id);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const col = database.get<RecordModel>('records');
    const userClause = currentUserId
      ? Q.or(Q.where('user_id', currentUserId), Q.where('user_id', null))
      : Q.where('user_id', null);

    const query = col.query(
      Q.where('status', 'active'),
      Q.where('pending_delete', false),
      userClause,
    );
    if (typeof query?.observeCount === 'function') {
      const sub = query.observeCount().subscribe((c: number) => {
        setCount(c);
      });
      return () => {
        sub?.unsubscribe?.();
      };
    }

    if (typeof query?.observe === 'function') {
      const sub = query.observe().subscribe((records: RecordModel[]) => {
        setCount(Array.isArray(records) ? records.length : 0);
      });
      return () => {
        sub?.unsubscribe?.();
      };
    }

    if (typeof query?.fetch === 'function') {
      let isMounted = true;
      query.fetch().then((records: RecordModel[]) => {
        if (isMounted) setCount(Array.isArray(records) ? records.length : 0);
      }).catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [currentUserId]);

  return count;
}
