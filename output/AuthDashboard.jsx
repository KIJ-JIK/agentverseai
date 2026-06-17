import React, { useState, useEffect } from 'react';

export default function AuthDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-slate-400">Loading {entity} Module...</div>;

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
      <h3 className="text-xl font-bold text-cyan-400 mb-4">Auth Service Panel</h3>
      <div className="text-white bg-slate-950 p-4 rounded-lg mb-4 border border-slate-850">
        <pre className="overflow-x-auto">{JSON.stringify(data, null, 2)}</pre>
      </div>
      <button 
        onClick={() => setLoading(true)}
        className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded text-slate-950 font-bold transition-all">
        Refresh Auth
      </button>
    </div>
  );
}