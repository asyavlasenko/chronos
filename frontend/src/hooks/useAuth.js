import { useContext } from 'react';
import { AuthContext } from '../app/providers/AuthProvider';

export default function useAuth() {
  return useContext(AuthContext);
}
