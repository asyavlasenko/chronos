import { useCallback, useEffect, useRef, useState } from 'react';
import * as drawingsApi from '../api/drawings.api';
import { parseApiError } from '../api/errors';
import useToast from './useToast';

const LOCAL_ID_PREFIX = 'local-';
const NOT_FOUND_STATUS = 404;
let localSequence = 0;

const isLocalId = (id) => String(id).startsWith(LOCAL_ID_PREFIX);

export default function useDrawings({ from, to }) {
  const { notifyError } = useToast();
  const [drawings, setDrawings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const drawingsRef = useRef(drawings);
  const pendingCreations = useRef(new Map());
  const serverIdsByLocalId = useRef(new Map());
  const fromMs = from.getTime();
  const toMs = to.getTime();

  drawingsRef.current = drawings;

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    drawingsApi
      .listDrawings({ from: new Date(fromMs), to: new Date(toMs) })
      .then((list) => {
        if (!isActive) return;
        setDrawings((current) => [...list, ...current.filter((drawing) => drawing.isPending)]);
        setError(null);
      })
      .catch((err) => {
        if (!isActive) return;
        setDrawings((current) => current.filter((drawing) => drawing.isPending));
        setError(parseApiError(err).message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [fromMs, toMs]);

  const resolveServerId = useCallback(async (id) => {
    if (!isLocalId(id)) return id;
    const creation = pendingCreations.current.get(id);
    if (creation) return creation;
    return serverIdsByLocalId.current.get(id) || null;
  }, []);

  const toSavedDrawing = useCallback((drawing) => {
    if (!isLocalId(drawing.id)) return drawing;
    const serverId = serverIdsByLocalId.current.get(drawing.id);
    if (!serverId) return null;
    const { isPending, ...saved } = drawing;
    return { ...saved, id: serverId };
  }, []);

  const addDrawing = useCallback(
    ({ color, width, points }) => {
      localSequence += 1;
      const localId = `${LOCAL_ID_PREFIX}${localSequence}`;
      const stroke = { color, width, points };
      setDrawings((list) => [...list, { ...stroke, id: localId, isPending: true }]);

      const creation = drawingsApi
        .createDrawing(stroke)
        .then((created) => {
          serverIdsByLocalId.current.set(localId, created.id);
          setDrawings((list) =>
            list
              .filter((drawing) => drawing.id !== created.id)
              .map((drawing) => (drawing.id === localId ? { ...created, localId } : drawing)),
          );
          return created.id;
        })
        .catch((err) => {
          setDrawings((list) => list.filter((drawing) => drawing.id !== localId));
          notifyError(err);
          return null;
        })
        .finally(() => pendingCreations.current.delete(localId));

      pendingCreations.current.set(localId, creation);
      return localId;
    },
    [notifyError],
  );

  const removeDrawing = useCallback(
    async (id) => {
      const isTarget = (drawing) =>
        drawing.id === id || drawing.id === serverIdsByLocalId.current.get(id);
      const removed = drawingsRef.current.find(isTarget) || null;
      setDrawings((list) => list.filter((drawing) => !isTarget(drawing)));

      try {
        const serverId = await resolveServerId(id);
        if (serverId) await drawingsApi.deleteDrawing(serverId);
        return true;
      } catch (err) {
        if (parseApiError(err).status === NOT_FOUND_STATUS) return true;
        const restored = removed ? toSavedDrawing(removed) : null;
        if (restored) setDrawings((list) => [...list, restored]);
        notifyError(err);
        return false;
      }
    },
    [resolveServerId, toSavedDrawing, notifyError],
  );

  const clearDrawings = useCallback(async () => {
    const snapshot = drawingsRef.current;
    setDrawings([]);

    try {
      await Promise.all([...pendingCreations.current.values()]);
      await drawingsApi.clearDrawings({ from: new Date(fromMs), to: new Date(toMs) });
      return true;
    } catch (err) {
      setDrawings(snapshot.map(toSavedDrawing).filter(Boolean));
      notifyError(err);
      return false;
    }
  }, [fromMs, toMs, toSavedDrawing, notifyError]);

  return { drawings, addDrawing, removeDrawing, clearDrawings, isLoading, error };
}
