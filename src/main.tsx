import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import './styles.css'
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>)
