import React from 'react';
import { plans } from '../../data/plans.js';

export default function PlanCard({ plan, onSelect }) { return <article className={`plan-card plan-card--${plan.name.toLowerCase()}`}><span className="plan-badge">{plan.badge}</span><h3>{plan.name}</h3><strong>{plan.price}</strong><div className="plan-features">{plan.features.map((feature) => <p key={feature}>✓ {feature}</p>)}</div><button type="button" onClick={() => onSelect?.(plan)}>Elegir plan</button></article>; }
export function PlansSection({ onSelect }) { return <section className="plan-grid">{plans.map((plan) => <PlanCard key={plan.name} plan={plan} onSelect={onSelect} />)}</section>; }
