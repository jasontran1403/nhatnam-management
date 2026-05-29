import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import App from './App.jsx'

// StrictMode removed: it causes double-invoke of effects which interacts
// badly with portal-based components (SplashScreen) on some browsers/extensions
// causing "insertBefore: node is not a child" errors in production.
createRoot(document.getElementById('root')).render(<App />)
