import { useContext } from 'react';
import { ModalsContext } from '../app/providers/ModalsProvider';

export default function useModals() {
  return useContext(ModalsContext);
}
