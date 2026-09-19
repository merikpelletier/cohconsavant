import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const finishAuthentication = () => {
    const queryReturnTo = new URLSearchParams(window.location.search).get('returnTo');
    const returnTo = queryReturnTo || sessionStorage.getItem('cochon_savant_return_to');
    sessionStorage.removeItem('cochon_savant_return_to');
    navigate(returnTo?.startsWith('/') ? returnTo : '/', { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        if (password !== passwordConfirmation) throw new Error('Les mots de passe ne correspondent pas.');
        const result = await signup(email.trim(), password, displayName.trim());
        if (result.requiresConfirmation) {
          setNotice('Ton compte est créé. Vérifie ton courriel pour confirmer ton adresse, puis connecte-toi.');
          setMode('login');
          setPassword('');
          setPasswordConfirmation('');
        } else {
          finishAuthentication();
        }
      } else {
        await login(email.trim(), password);
        finishAuthentication();
      }
    } catch (loginError) {
      const message = loginError.message || 'Connexion impossible';
      setError(message === 'Invalid login credentials' ? 'Courriel ou mot de passe incorrect.' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
        <div><h1 className="text-2xl font-semibold">{mode === 'login' ? 'Connexion' : 'Créer mon compte'}</h1><p className="text-sm text-white/60 mt-1">Le Cochon Savant</p></div>
        <div className="grid grid-cols-2 rounded-lg bg-black p-1 border border-white/10">
          <button type="button" onClick={() => { setMode('login'); setError(''); setNotice(''); }} className={`rounded-md px-3 py-2 text-sm ${mode === 'login' ? 'bg-red-600 text-white' : 'text-white/60'}`}>Connexion</button>
          <button type="button" onClick={() => { setMode('signup'); setError(''); setNotice(''); }} className={`rounded-md px-3 py-2 text-sm ${mode === 'signup' ? 'bg-red-600 text-white' : 'text-white/60'}`}>Inscription</button>
        </div>
        {mode === 'signup' && <label className="block space-y-2"><span className="text-sm">Nom affiché</span><input className="w-full rounded-lg bg-black border border-white/20 px-3 py-2" type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></label>}
        <label className="block space-y-2"><span className="text-sm">Courriel</span><input className="w-full rounded-lg bg-black border border-white/20 px-3 py-2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="block space-y-2"><span className="text-sm">Mot de passe</span><input className="w-full rounded-lg bg-black border border-white/20 px-3 py-2" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {mode === 'signup' && <label className="block space-y-2"><span className="text-sm">Confirmer le mot de passe</span><input className="w-full rounded-lg bg-black border border-white/20 px-3 py-2" type="password" autoComplete="new-password" minLength={6} value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required /></label>}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        {notice && <p className="text-sm text-green-400" role="status">{notice}</p>}
        <button className="w-full rounded-lg bg-red-600 px-4 py-2 font-medium disabled:opacity-50" disabled={loading} type="submit">{loading ? 'Traitement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
      </form>
    </main>
  );
}
