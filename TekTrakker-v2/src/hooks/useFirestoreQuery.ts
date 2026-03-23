
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import firebase from 'firebase/compat/app';

interface Filter {
    field: string;
    operator: firebase.firestore.WhereFilterOp;
    value: any;
}

interface UseFirestoreQueryProps {
    collection: string;
    organizationId?: string;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Filter[];
}

export function useFirestoreQuery<T>(props: UseFirestoreQueryProps) {
    const [data, setData] = useState<T[]>([]);
    const [lastDoc, setLastDoc] = useState<firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData> | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async (isInitial = false, currentLastDoc: firebase.firestore.QueryDocumentSnapshot | null = null) => {
        if (!props.organizationId) return;
        setLoading(true);
        setError(null);

        try {
            let query = db.collection(props.collection)
                .where('organizationId', '==', props.organizationId);

            if (props.filters) {
                props.filters.forEach(f => {
                    if (f.value !== undefined && f.value !== '') {
                        query = query.where(f.field, f.operator, f.value);
                    }
                });
            }

            if (props.orderBy) {
                query = query.orderBy(props.orderBy, props.orderDirection || 'desc');
            } else {
                query = query.orderBy('createdAt', 'desc');
            }

            if (!isInitial && currentLastDoc) {
                query = query.startAfter(currentLastDoc);
            }

            query = query.limit(props.limit || 20);

            const snapshot = await query.get();
            const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as T[];

            if (isInitial) {
                setData(docs);
            } else {
                setData(prev => [...prev, ...docs]);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === (props.limit || 20));

        } catch (err: any) {
            console.error("Firestore Query Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [props.collection, props.organizationId, JSON.stringify(props.filters), props.orderBy, props.orderDirection, props.limit]);

    useEffect(() => {
        setData([]);
        setLastDoc(null);
        setHasMore(true);
        loadData(true, null);
    }, [loadData]);

    const loadMore = () => {
        if (!loading && hasMore) {
            loadData(false, lastDoc);
        }
    };

    const refresh = () => {
        loadData(true, null);
    };

    return { data, loading, hasMore, loadMore, error, refresh };
}
