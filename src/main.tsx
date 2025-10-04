// Import Trusted Types policy first (must be before any other imports)
import './trustedTypes'

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
