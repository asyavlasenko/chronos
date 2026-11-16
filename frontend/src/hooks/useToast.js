import { useContext } from 'react';
import { ToastContext } from '../app/providers/ToastProvider';

export default function useToast() {
  return useContext(ToastContext);
}
