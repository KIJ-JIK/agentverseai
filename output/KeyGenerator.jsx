import React, { useState } from 'react';

export default function KeyGenerator({ onKeySubmit }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (key.trim()) {
      onKeySubmit(key);
      setKey('');
    }
  };

  return (
    <div className="p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
      <h3 className="text-xl font-bold text-sky-400 mb-4">Band API Key Registration</h3>
      <form onSubmit={handleSubmit} className="flex gap-4">
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter Band API Key"
          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
        />
        <button type="submit" className="bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded font-bold">
          Register Key
        </button>
      </form>
    </div>
  );
}