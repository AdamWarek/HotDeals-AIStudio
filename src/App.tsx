import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Home />
      </AuthProvider>
    </ThemeProvider>
  );
}
