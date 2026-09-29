import ReactDOM from 'react-dom/client';
import './styles.css';
import './studio-light.css';
async function boot(){
 try{if(!localStorage.getItem('shotcraft-desktop-project-v1')){const r=await fetch('/api/autosave');const p=await r.json();if(p?.tracks)localStorage.setItem('shotcraft-desktop-project-v1',JSON.stringify(p))}}catch{}
 const {App}=await import('./App');ReactDOM.createRoot(document.getElementById('root')!).render(<App/>);
}
boot();
