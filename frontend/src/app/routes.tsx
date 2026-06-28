import { createBrowserRouter } from 'react-router';
import { InputPage } from './pages/InputPage';
import { ResultsPage } from './pages/ResultsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: InputPage,
  },
  {
    path: '/results',
    Component: ResultsPage,
  },
]);
