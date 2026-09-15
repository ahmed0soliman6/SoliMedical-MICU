import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, Query, DocumentData, getDocs } from 'firebase/firestore';
import { firestore } from './firebase.ts';

export function useFirestoreQuery<T>(q: Query<DocumentData>) {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: T[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...doc.data(), id: doc.id } as unknown as T);
        });
        setData(results);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore Query Error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [q]); // NOTE: q should be memoized or it will retrigger

  return { data, loading, error };
}

export function useFirestoreCollection<T>(collectionName: string) {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    const colRef = collection(firestore, collectionName);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const results: T[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...doc.data(), id: doc.id } as unknown as T);
        });
        setData(results);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

  return { data, loading, error };
}
