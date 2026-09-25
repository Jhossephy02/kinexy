import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppIcon from '../components/ui/AppIcon.jsx';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <main className="page about-kinexy-page" id="main-content" style={{ background: 'var(--black)', color: 'var(--text)', paddingBottom: '80px' }}>
      
      {/* 01. HERO INSTITUCIONAL */}
      <section className="about-hero" style={{ padding: '80px 5% 60px', textAlign: 'center', background: 'radial-gradient(ellipse at 50% 0%, #38192d 0%, var(--black) 70%)', position: 'relative', overflow: 'hidden' }}>
        <span className="eyebrow" style={{ color: '#ff8ca3', letterSpacing: '3px', fontSize: '0.85rem', fontWeight: 'bold' }}>PREMIUM DIGITAL PLATFORM</span>
        <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: '1.1', fontWeight: '700', margin: '20px 0 15px', letterSpacing: '-1.5px' }}>
          La nueva generación premium<br />
          <span style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif', color: '#ffcadf' }}>de Latinoamérica.</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--muted)', maxWidth: '650px', margin: '0 auto 30px', letterSpacing: '2px' }}>
          LIMA — PUCALLPA — PERÚ
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <button className="primary-button" onClick={() => navigate('/profile')} style={{ padding: '14px 28px', fontSize: '1rem' }}>
            Únete como Creadora ↗
          </button>
          <a href="#contacto" className="secondary-button" style={{ padding: '14px 28px', fontSize: '1rem', textDecoration: 'none' }}>
            Contacto directo
          </a>
        </div>
      </section>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 5%' }}>
        
        {/* 02. SOBRE NOSOTROS */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'center' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--red)' }}>02 / SOBRE NOSOTROS</span>
              <h2 style={{ fontSize: '2.2rem', margin: '15px 0 20px', lineHeight: '1.2' }}>Plataformas más profesionales, seguras y estratégicas.</h2>
              <p style={{ color: 'var(--muted)', lineHeight: '1.7', fontSize: '1.05rem' }}>
                En <strong>Kinexy</strong> creemos que la nueva era digital necesita un estándar superior. Nacimos con una visión clara: crear una nueva generación de perfiles premium en Latinoamérica, elevando el estándar de imagen, posicionamiento y crecimiento dentro del mercado digital privado.
              </p>
              <p style={{ color: '#ffcadf', fontSize: '1.1rem', fontWeight: '500', marginTop: '15px' }}>
                Hoy, Kinexy representa exclusividad, confianza y expansión.
              </p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, var(--card), #221722)', padding: '40px', borderRadius: '24px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: '64px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--red)', display: 'block', marginBottom: '10px' }}>k</span>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem' }}>LIMA · PUCALLPA · PERÚ</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>Desarrollo de marcas de alto impacto y posicionamiento nacional e internacional.</p>
            </div>
          </div>
        </section>

        {/* 03. NUESTRA VISIÓN */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="eyebrow" style={{ color: 'var(--red)' }}>03 / NUESTRA VISIÓN</span>
          <h2 style={{ fontSize: '2.2rem', margin: '15px 0 30px' }}>Una nueva oportunidad de alto nivel en Latinoamérica</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '30px', borderRadius: '20px' }}>
              <h3 style={{ color: '#ff8ca3', fontSize: '1.2rem', marginTop: 0 }}>El contexto del mercado</h3>
              <p style={{ color: 'var(--muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                Durante años, otros países han liderado el sector, pero la saturación con miles de anunciantes ha elevado la competencia sin garantía de retorno.
              </p>
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '30px', borderRadius: '20px' }}>
              <h3 style={{ color: '#ff8ca3', fontSize: '1.2rem', marginTop: 0 }}>El potencial de Perú</h3>
              <p style={{ color: 'var(--muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                Identificamos a <strong>Lima y Pucallpa</strong> como ciudades estratégicas con menor saturación, conservando exclusividad, novedad, autenticidad y alta demanda.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #2b1725, var(--card))', border: '1px solid #5a283c', padding: '30px', borderRadius: '20px' }}>
              <h3 style={{ color: '#ffe5eb', fontSize: '1.2rem', marginTop: 0 }}>Rentabilidad real</h3>
              <p style={{ color: '#ffcadf', lineHeight: '1.6', fontSize: '0.95rem' }}>
                Perú representa una alternativa altamente rentable para creadoras que buscan crecer más, destacar y multiplicar sus ingresos.
              </p>
            </div>
          </div>
        </section>

        {/* 04. CRECIMIENTO Y POSICIONAMIENTO */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 40px' }}>
            <span className="eyebrow" style={{ color: 'var(--red)' }}>04 / POSICIONAMIENTO</span>
            <h2 style={{ fontSize: '2.2rem', margin: '15px 0' }}>Descubrir y posicionar a la próxima generación premium</h2>
            <p style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>No buscamos simplemente publicar perfiles; buscamos construir presencia, exclusividad y rentabilidad a largo plazo.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {[
              ['01', 'Posicionamiento rápido', 'Ingresa temprano en un mercado emergente con espacio real para crecer.'],
              ['02', 'Generación de comunidad', 'Crea audiencia fiel que valore tu contenido exclusivo.'],
              ['03', 'Valor comercial alto', 'Aumenta tu tarifa y posiciona tu marca personal.'],
              ['04', 'Referente regional', 'Conviértete en icono de una nueva etapa del mercado latinoamericano.']
            ].map(([num, title, desc]) => (
              <div key={num} style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '25px', borderRadius: '18px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--red)', fontFamily: 'Georgia, serif' }}>{num}</span>
                <h4 style={{ fontSize: '1.1rem', margin: '10px 0 8px' }}>{title}</h4>
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 05. ¿QUÉ OFRECEMOS? (LANZAMIENTO) */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'linear-gradient(135deg, #301726, #18121a)', border: '1px solid #6e304b', borderRadius: '28px', padding: '45px 5%', textAlign: 'center' }}>
            <span className="eyebrow" style={{ color: '#ff9ebb', letterSpacing: '2px' }}>05 / ETAPA DE EXPANSIÓN</span>
            <h2 style={{ fontSize: '2.4rem', margin: '15px 0 10px', color: '#ffffff' }}>Programa de Lanzamiento Kinexy</h2>
            <p style={{ color: '#ffcadf', fontSize: '1.1rem', marginBottom: '30px' }}>
              Nuestro objetivo inicial no es cobrar; nuestro objetivo es ayudarte a crecer.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', textAlign: 'left' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <strong style={{ color: '#4ade80', display: 'block', fontSize: '1.1rem', marginBottom: '6px' }}>1 Mes Gratis</strong>
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>Acceso completo a la plataforma Kinexy para perfiles seleccionados.</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <strong style={{ color: '#4ade80', display: 'block', fontSize: '1.1rem', marginBottom: '6px' }}>0 Pagos Iniciales</strong>
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>Sin cuotas los primeros 2 meses durante la etapa de expansión.</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <strong style={{ color: '#4ade80', display: 'block', fontSize: '1.1rem', marginBottom: '6px' }}>Acceso Prioritario</strong>
                <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>Inclusión prioritaria en campañas estratégicas de crecimiento.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 06. PRODUCCIÓN Y BENEFICIOS EXCLUSIVOS */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <span className="eyebrow" style={{ color: 'var(--red)' }}>06 / PRODUCCIÓN Y ALIANZAS</span>
          <h2 style={{ fontSize: '2.2rem', margin: '15px 0 30px' }}>Producción Audiovisual & Convenios Privados</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '30px', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#ffcadf' }}>Producción de Contenido</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                Estándares audiovisuales modernos enfocados en viralización, engagement, presencia premium y crecimiento orgánico sostenible.
              </p>
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '30px', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#ffcadf' }}>Convenios de Locación</h3>
              <ul style={{ color: 'var(--muted)', fontSize: '0.92rem', paddingLeft: '20px', lineHeight: '1.8', margin: 0 }}>
                <li>Suites premium y departamentos modernos (Lima y Pucallpa).</li>
                <li>Ambientes seguros y discretos.</li>
                <li>Soporte logístico y facilidades de traslado para creadoras.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 07. ATENCIÓN A AGENCIAS E INDUSTRIAS */}
        <section className="about-section" style={{ padding: '60px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'linear-gradient(135deg, #281622, #181219)', border: '1px solid #5d2840', borderRadius: '24px', padding: '40px 5%' }}>
            <span className="eyebrow" style={{ color: '#ff8ca3', letterSpacing: '2px' }}>✦ REGISTRO CORPORATIVO & AGENCIAS</span>
            <h2 style={{ fontSize: '2rem', margin: '12px 0 15px', color: '#ffffff' }}>Atención Directa para Industrias y Agencias de Modelaje</h2>
            <p style={{ color: 'var(--muted)', fontSize: '1rem', lineHeight: '1.6', maxWidth: '750px', marginBottom: '20px' }}>
              Si eres una empresa, agencia de representación o industria que desea registrar y promocionar a sus modelos en Kinexy, el proceso se realiza mediante <strong>trato directo personalizado</strong> con nuestro equipo directivo.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ffcadf', display: 'block', marginBottom: '4px' }}>Gestión de Catálogo</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Asignación de ejecutivos de cuenta para carga masiva de perfiles y verificación prioritaria.</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <strong style={{ color: '#ffcadf', display: 'block', marginBottom: '4px' }}>Convenios B2B</strong>
                <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Paquetes corporativos de promoción, campañas en redes y espacios exclusivos en Lima y Pucallpa.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 08. SEGURIDAD Y CONTACTO (CIERRE) */}
        <section id="contacto" className="about-section" style={{ padding: '60px 0 20px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ color: 'var(--red)' }}>08 / SELECCIÓN Y TRATO DIRECTO</span>
          <h2 style={{ fontSize: '2.5rem', margin: '15px 0 10px' }}>Únete a la nueva generación</h2>
          <p style={{ color: 'var(--muted)', maxWidth: '600px', margin: '0 auto 30px', fontSize: '1.05rem' }}>
            Las vacantes son limitadas y los perfiles son evaluados de manera selectiva. Comunícate directamente con nuestro personal oficial.
          </p>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '40px', borderRadius: '24px', maxWidth: '600px', margin: '0 auto' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>CONTACTO DIRECTO INSTITUCIONAL & AGENCIAS</span>
            <h3 style={{ fontSize: '1.8rem', color: 'var(--red)', margin: '10px 0 15px' }}>+51 981 367 412</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', color: '#ffcadf' }}>Atención Presencial y remota: Lima · Pucallpa · KINEXY.PE</p>
            
            <button className="primary-button" onClick={() => navigate('/profile')} style={{ width: '100%', padding: '14px' }}>
              Postular mi perfil o contactar personal
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}
