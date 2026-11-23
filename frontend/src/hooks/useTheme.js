import { useContext } from 'react';
import { ThemeContext } from '../app/providers/ThemeProvider';

export default function useTheme() {
  return useContext(ThemeContext);
}
