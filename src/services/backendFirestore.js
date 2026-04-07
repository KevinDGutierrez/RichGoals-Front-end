import apiClient from './apiClient';

export const db = { __type: 'backend-db' };

export const arrayUnion = (...values) => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values) => ({ __op: 'arrayRemove', values });

export const doc = (_db, ...segments) => ({
  path: segments.join('/'),
  id: segments[segments.length - 1],
});

export const collection = (_db, ...segments) => ({
  path: segments.join('/'),
});

export const where = (field, op, value) => ({
  field,
  op,
  value,
});

export const query = (collectionRef, ...filters) => ({
  collectionPath: collectionRef.path,
  filters,
});

function makeDocSnapshot(payload, fallbackPath) {
  return {
    id: payload?.id || fallbackPath?.split('/').pop(),
    ref: { path: payload?.refPath || fallbackPath },
    exists: () => !!payload?.exists,
    data: () => payload?.data || null,
  };
}

export async function getDoc(docRef) {
  const { data } = await apiClient.get('/firestore/document', {
    params: { path: docRef.path },
  });

  return makeDocSnapshot(data, docRef.path);
}

export async function setDoc(docRef, value, options = {}) {
  await apiClient.put('/firestore/document', {
    path: docRef.path,
    data: value,
    merge: !!options.merge,
  });
}

export async function updateDoc(docRef, value) {
  await apiClient.patch('/firestore/document', {
    path: docRef.path,
    data: value,
  });
}

export async function deleteDoc(docRef) {
  await apiClient.delete('/firestore/document', {
    data: { path: docRef.path },
  });
}

export async function getDocs(queryRef) {
  const { data } = await apiClient.post('/firestore/query', queryRef);

  return {
    docs: (data.docs || []).map((item) =>
      makeDocSnapshot(item, item.refPath)
    ),
  };
}

export function onSnapshot(docRef, onNext, onError) {
  let stopped = false;
  let intervalId = null;
  let last = null;
  let pulling = false;

  const stop = () => {
    stopped = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const pull = async () => {
    if (stopped || pulling) return;

    pulling = true;

    try {
      const snap = await getDoc(docRef);

      if (stopped) return;

      const serialized = JSON.stringify({
        exists: snap.exists(),
        data: snap.data(),
      });

      if (serialized !== last) {
        last = serialized;
        onNext?.(snap);
      }
    } catch (error) {
      if (stopped) return;

      const status = error?.response?.status;

      // Si la sesión ya no es válida, detenemos el polling silenciosamente.
      if (status === 401) {
        stop();
        return;
      }

      onError?.(error);
    } finally {
      pulling = false;
    }
  };

  pull();

  intervalId = setInterval(() => {
    if (!stopped) {
      pull();
    }
  }, 2000);

  return stop;
}