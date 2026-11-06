import { useContext } from 'react';
import { ModalsContext } from '../app/providers/ModalsProvider';

/** { quickCreate, openQuickCreate, closeQuickCreate, detailsEventId, openDetails, closeDetails } */
export default function useModals() {
  return useContext(ModalsContext);
}
