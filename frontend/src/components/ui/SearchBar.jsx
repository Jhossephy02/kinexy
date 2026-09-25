import React from 'react';
export default function SearchBar({ value = '', onChange, onSubmit, inputRef, placeholder = 'Buscar perfiles...' }) {
  return <form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); onSubmit?.(value); }}><svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input ref={inputRef} type="search" value={value} onChange={event => onChange?.(event.target.value)} placeholder={placeholder} aria-label={placeholder} /><button type="submit">Buscar</button></form>;
}
