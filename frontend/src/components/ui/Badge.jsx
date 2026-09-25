import React from 'react';

export default function Badge({ text, variant = 'default' }) { return <span className={`badge badge--${variant}`}>{text}</span>; }
export function Stat({ label, value }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }
