import { createRoot } from 'react-dom/client';
import { NhostProvider } from '@nhost/react';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { nhost } from './lib/nhost';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <NhostProvider nhost={nhost}>
    <NhostApolloProvider nhost={nhost}>
      <App />
    </NhostApolloProvider>
  </NhostProvider>
);
