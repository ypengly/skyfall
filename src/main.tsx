import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Note: no <React.StrictMode> — it double-mounts effects, which would create two WebGL games.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
