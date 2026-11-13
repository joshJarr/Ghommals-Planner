import {createRoot} from 'react-dom/client';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import Home from './home/Home';
import GhommalsApp from './ghommals/App';
import CollectorsApp from './collectors/App';
import './ghommals/style.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home/>}/>
      <Route path="/ghommals" element={<GhommalsApp/>}/>
      <Route path="/collectors" element={<CollectorsApp/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </BrowserRouter>,
);
