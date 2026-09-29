import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountsPanel from './AccountsPanel.jsx';
import PaymentReviewPanel from './PaymentReviewPanel.jsx';
import Modal from '../components/ui/Modal.jsx';
import { moderationService, notificationsService, permissionsService } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

const roleConfig = {
  moderator: {
    label: 'Plataforma Táctica',
    caption: 'Triage de seguridad y moderación en vivo',
    eyebrow: 'ENTERPRISE PLATFORM (MODERATOR)',
    description: 'Triage rápido de alertas de seguridad, cola de fotos, análisis de incidentes y emisión de sanciones.',
    tabs: [
      ['overview', 'Dashboard', 'dashboard'],
      ['queue', 'Aprobaciones', 'userCheck'],
      ['payments', 'Pagos Yape', 'wallet'],
      ['reports', 'Reportes Comunidad', 'flag'],
      ['strikes', 'Sanciones & Strikes', 'alert'],
      ['audit', 'Bitácora Táctica', 'history']
    ]
  },
  admin: {
    label: 'Plataforma Operativa',
    caption: 'Gestión de negocios y creadores',
    eyebrow: 'ENTERPRISE PLATFORM (ADMIN)',
    description: 'Análisis de ingresos, conversión de creadores, aprobaciones y SLA operativo.',
    tabs: [
      ['overview', 'Dashboard', 'dashboard'],
      ['accounts', 'Cuentas', 'users'],
      ['queue', 'Aprobaciones', 'userCheck'],
      ['payments', 'Pagos Yape', 'wallet'],
      ['reports', 'Reportes Operativos', 'flag'],
      ['metrics', 'Métricas', 'chart'],
      ['billing', 'Liquidaciones', 'wallet'],
      ['support', 'Soporte', 'message'],
      ['audit', 'Auditoría Plataforma', 'history']
    ]
  },
  superadmin: {
    label: 'Plataforma Imperial',
    caption: 'Gobierno de servidor, roles y parámetros',
    eyebrow: 'ENTERPRISE PLATFORM (SUPER ADMIN)',
    description: 'Control absoluto del servidor, matriz de seguridad, roles globales y logs de auditoría.',
    tabs: [
      ['overview', 'Dashboard', 'dashboard'],
      ['accounts', 'Usuarios y roles', 'users'],
      ['queue', 'Aprobaciones', 'userCheck'],
      ['payments', 'Pagos Yape', 'wallet'],
      ['permissions', 'Permisos', 'key'],
      ['billing', 'Liquidaciones', 'wallet'],
      ['risk', 'Riesgo', 'shield'],
      ['support', 'Soporte', 'message'],
      ['system', 'Servidor', 'settings'],
      ['audit', 'Auditoría', 'shield']
    ]
  }
};

const statusLabel = { open: 'Abierto', reviewing: 'En revisión', resolved: 'Resuelto', dismissed: 'Descartado' };
const priorityLabel = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const mobileTabLabel = { overview: 'Inicio', accounts: 'Usuarios', queue: 'Revisar', payments: 'Pagos', permissions: 'Accesos', reports: 'Reportes', metrics: 'Métricas', billing: 'Retiros', support: 'Soporte', risk: 'Riesgo', system: 'Servidor', audit: 'Auditoría', strikes: 'Sanciones' };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const access = roleConfig[user?.role] || roleConfig.admin;
  const baseTabs = access.tabs;

  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [queue, setQueue] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filters, setFilters] = useState({ query: '', priority: 'all', status: 'active' });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [navCollapsed] = useState(false);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [permissionMatrix, setPermissionMatrix] = useState(null);
  const tabPermissions = { accounts: 'view_accounts', queue: 'approve_profiles', payments: 'review_payments', reports: 'resolve_reports' };
  const tabs = user?.role === 'superadmin' || !rolePermissions.length ? baseTabs : baseTabs.filter(([id]) => !tabPermissions[id] || rolePermissions.includes(tabPermissions[id]));

  // Strike state (Moderator)
  const [strikeForm, setStrikeForm] = useState({ userEmail: '', reason: 'Infracción de normas', duration: '24h' });
  const [strikesList, setStrikesList] = useState([]);

  // System parameters (Superadmin)
  const [sysConfig, setSysConfig] = useState({
    maintenanceMode: false,
    creatorRegistration: true,
    creatorFee: '15%',
    moneyPaymentActive: true,
    contentReview: true,
    liveChatEnabled: true,
    autoHoldPayouts: true,
    moderationSla: '30 min',
    riskLevel: 'Estándar'
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [summary, reportData, queueData, actionData] = await Promise.allSettled([
        moderationService.overview(),
        moderationService.reports(),
        moderationService.queue(),
        moderationService.actions(),
      ]);
      if (summary.status === 'fulfilled') setOverview(summary.value);
      if (reportData.status === 'fulfilled') setReports(reportData.value.reports || []);
      if (queueData.status === 'fulfilled') setQueue(queueData.value.profiles || []);
      if (actionData.status === 'fulfilled') setActions(actionData.value.actions || []);
      const firstFailure = [summary, reportData, queueData, actionData].find(result => result.status === 'rejected');
      if (firstFailure && ![summary, reportData, queueData, actionData].some(result => result.status === 'fulfilled')) throw firstFailure.reason;
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = (silent = false) => {
      load(silent);
      notificationsService.list().then(result => { if (active) setNotifications(result.notifications || []); }).catch(() => {});
      permissionsService.mine().then(result => { if (active) setRolePermissions(result.permissions || []); }).catch(() => {});
      if (user?.role === 'superadmin') permissionsService.matrix().then(result => { if (active) setPermissionMatrix(result.matrix); }).catch(() => {});
    };
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(true); }, 60000);
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update') refresh(true); };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh(true); };
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('kinexy-realtime', onRealtime);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refreshWhenVisible); window.removeEventListener('kinexy-realtime', onRealtime); document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUserMode = () => {
    navigate('/');
  };

  async function decide(id, status) {
    setPending(true);
    setError('');
    try {
      await moderationService.decideReport(id, status);
      await load();
      setNotice(`Reporte #${id} actualizado a ${statusLabel[status] || status}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function decideProfile(id, approved) {
    setPending(true);
    setError('');
    try {
      await moderationService.approveProfile(id, approved);
      await load();
      setNotice(approved ? 'Perfil aprobado. Ya puede aparecer gratis en el directorio durante la beta.' : 'Perfil rechazado y retirado de la cola.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  const handleAddStrike = (e) => {
    e.preventDefault();
    if (!strikeForm.userEmail) return;
    const newStrike = {
      id: Date.now(),
      user: strikeForm.userEmail,
      reason: strikeForm.reason,
      duration: strikeForm.duration,
      date: new Date().toLocaleString('es-PE')
    };
    setStrikesList([newStrike, ...strikesList]);
    setNotice(`Advertencia emitida a ${strikeForm.userEmail}`);
    setStrikeForm({ userEmail: '', reason: 'Infracción de normas', duration: '24h' });
  };

  const updateSystem = (key, value, label) => {
    setSysConfig(current => ({ ...current, [key]: value }));
    setNotice(label || 'Configuración actualizada.');
  };

  const filteredReports = useMemo(() => reports.filter((report) => {
    const text = `${report.reason} ${report.details} ${report.profile_name}`.toLowerCase();
    const statusMatches = filters.status === 'all' || (filters.status === 'active' ? ['open', 'reviewing'].includes(report.status) : report.status === filters.status);
    return text.includes(filters.query.toLowerCase()) && (filters.priority === 'all' || report.priority === filters.priority) && statusMatches;
  }), [reports, filters]);

  const roleName = user?.role || 'admin';

  return (
    <main className={`moderation-shell enterprise-layout role-theme-${roleName} ${navCollapsed ? 'nav-is-collapsed' : ''}`} id="main-content">
      {/* SIDEBAR NAVEGACIÓN ENTERPRISE CON COLORES KINEXY */}
      <aside className="moderation-nav enterprise-nav">
        <div className="nav-brand">
          <span className="brand-logo-icon">k</span>
          <div className="brand-text">
            <strong>KINEXY</strong>
            <small>ENTERPRISE v2.4</small>
          </div>
        </div>

        <button
          type="button"
          className="nav-primary-action"
          onClick={() => setTab('overview')}
          title="Ir al centro de control"
        >
          <Icon name="sparkles" />
          <span>Centro de control</span>
        </button>

        <nav className="nav-menu">
          {tabs.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              title={label}
              className="nav-item"
            >
              <Icon name={icon} />
              <span className="nav-label"><span className="nav-label-desktop">{label}</span><span className="nav-label-mobile">{mobileTabLabel[id] || label}</span></span>
              {id === 'reports' && overview?.open_reports > 0 && <span className="nav-badge alert">{overview.open_reports}</span>}
              {id === 'queue' && queue?.length > 0 && <span className="nav-badge info">{queue.length}</span>}
            </button>
          ))}
        </nav>

        {/* ACCIONES DE USUARIO Y LOGOUT */}
        <div className="nav-footer">
          <button onClick={handleUserMode} className="btn-user-mode" title="Ver sitio como usuario normal">
            <Icon name="globe" />
            <span>Modo Usuario</span>
          </button>
          <button onClick={handleLogout} className="btn-logout" title="Cerrar sesión">
            <Icon name="logout" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* SECCIÓN PRINCIPAL ENTERPRISE */}
      <section className="moderation-main enterprise-main">
        {/* HEADER BAR CON GREETING + SEARCH + NOTIFS + LOGOUT */}
        <header className="enterprise-header">
          <div className="header-title">
            <span className="platform-tag">{access.eyebrow}</span>
          </div>

          <div className="header-right-widgets">
            <div className="user-greeting">
              <span>Hola, <strong>{user?.name || user?.email || 'ADMIN'}</strong></span>
              <span className="user-avatar-circle">{(user?.name || user?.email)?.[0]?.toUpperCase()}</span>
            </div>

            <button onClick={handleUserMode} className="icon-widget-btn" title="Ir a la vista normal de usuario">
              <Icon name="globe" />
            </button>

            <button onClick={load} disabled={loading} className="icon-widget-btn" title="Actualizar datos">
              <Icon name="refresh" />
            </button>

            <div className="notification-wrapper">
              <button
                className="notification-bell icon-widget-btn"
                title="Notificaciones del sistema"
                onClick={() => { setShowNotifications(value => !value); notificationsService.markRead().catch(() => {}); }}
              >
                <Icon name="bell" />
                <span className="bell-dot" />
              </button>

              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notif-head">
                    <strong>Notificaciones Enterprise</strong>
                    <span className="notif-badge">3 Nuevas</span>
                  </div>
                  <div className="notif-list">
                    <div className="notif-item">
                      <span className="notif-icon green">✓</span>
                      <div>
                        <p>Nuevo pago de S/ 50 completado vía Yape.</p>
                        <small>Hace 5 min</small>
                      </div>
                    </div>
                    <div className="notif-item">
                      <span className="notif-icon pink">★</span>
                      <div>
                        <p>Nueva solicitud de perfil creador en Pucallpa.</p>
                        <small>Hace 18 min</small>
                      </div>
                    </div>
                    <div className="notif-item">
                      <span className="notif-icon gold">●</span>
                      <div>
                        <p>Respuesta de SLA alcanzada al 99.8% hoy.</p>
                        <small>Hace 1 hora</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="icon-widget-btn logout-widget-btn" title="Cerrar sesión">
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <section className="role-command-bar" aria-label="Alcance de tu rol">
          <span className="role-command-orb"><Icon name="shield" /></span>
          <div>
            <small>ESPACIO DE TRABAJO</small>
            <strong>{access.label}</strong>
            <p>{access.description}</p>
          </div>
          <span className="role-command-status"><i/>Acceso verificado</span>
        </section>

        {notice && (
          <div className="admin-notice" role="status">
            <Icon name="check" />
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {error && (
          <div className="admin-error" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {loading ? <Loading /> : (
          <div className="enterprise-view" key={tab}>
            {tab === 'accounts' && <AccountsPanel />}
            {tab === 'payments' && <PaymentReviewPanel />}

            {/* TAB OVERVIEW: DASHBOARD ENTERPRISE ESPECÍFICO DE ALTO NIVEL PARA CADA ROL */}
            {tab === 'overview' && <OperationalOverview role={roleName} overview={overview} queue={queue} reports={reports} actions={actions} setTab={setTab} updatedAt={updatedAt} />}

            {/* TAB REPORTES */}
            {tab === 'reports' && (
              <Panel title="Reportes de la Comunidad" caption="Atención en vivo y resolución de alertas emitidas por usuarios." icon="flag">
                <ReportFilters filters={filters} setFilters={setFilters} total={filteredReports.length} />
                {filteredReports.map((report) => (
                  <ReportRow key={report.id} report={report} pending={pending} decide={decide} />
                ))}
                {!filteredReports.length && <Empty text="No hay reportes con estos filtros." />}
              </Panel>
            )}

            {/* TAB COLA */}
            {tab === 'queue' && (
              <Panel title="Cola de Aprobación de Perfiles" caption="Verificación de requisitos antes de publicar nuevos perfiles creadores." icon="userCheck">
                <div className="queue-grid">
                  {queue.map((profile) => (
                    <article className="queue-card" key={profile.id}>
                      <div className="queue-card-head">
                        <span className="queue-avatar">{profile.name?.[0]}</span>
                        <div>
                          <strong>{profile.name}</strong>
                          <small>{profile.city} · {profile.category}</small>
                        </div>
                        <span className="queue-price-tag">S/ {profile.price || '50'}</span>
                      </div>
                      <p className="queue-bio">{profile.description || 'Sin descripción ingresada.'}</p>
                      <div className="queue-actions">
                        <button className="btn-reject" disabled={pending} onClick={() => decideProfile(profile.id, false)}>
                          <Icon name="close" /> Rechazar
                        </button>
                        <button className="btn-approve" disabled={pending} onClick={() => decideProfile(profile.id, true)}>
                          <Icon name="check" /> Aprobar Perfil
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!queue.length && <Empty text="La cola de aprobación se encuentra totalmente al día." />}
              </Panel>
            )}

            {/* TAB STRIKES */}
            {tab === 'strikes' && (
              <Panel title="Centro Táctico de Sanciones" caption="Emisión de advertencias directas, bloqueos temporales y restricciones." icon="alert">
                <div className="strikes-layout">
                  <form onSubmit={handleAddStrike} className="strike-form-card">
                    <h3>Emitir Advertencia / Sanción</h3>
                    <label>
                      Usuario o Email
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@kinexy.pe"
                        value={strikeForm.userEmail}
                        onChange={(e) => setStrikeForm({ ...strikeForm, userEmail: e.target.value })}
                      />
                    </label>
                    <label>
                      Motivo de Sanción
                      <select value={strikeForm.reason} onChange={(e) => setStrikeForm({ ...strikeForm, reason: e.target.value })}>
                        <option value="Infracción de normas">Infracción de normas</option>
                        <option value="Contenido no permitido">Contenido no permitido</option>
                        <option value="Suplantación o perfil falso">Suplantación o perfil falso</option>
                        <option value="Comportamiento inadecuado">Comportamiento inadecuado</option>
                      </select>
                    </label>
                    <label>
                      Duración de Sanción
                      <select value={strikeForm.duration} onChange={(e) => setStrikeForm({ ...strikeForm, duration: e.target.value })}>
                        <option value="24h">Advertencia (24 Horas)</option>
                        <option value="72h">Suspensión temporal (72 Horas)</option>
                        <option value="7d">Suspensión prolongada (7 Días)</option>
                        <option value="perm">Bloqueo Permanente</option>
                      </select>
                    </label>
                    <button type="submit" className="primary-strike-btn">
                      <Icon name="alert" /> Registrar Sanción
                    </button>
                  </form>

                  <div className="strikes-history-card">
                    <h3>Historial de Advertencias Recientes</h3>
                    <div className="strikes-list">
                      {strikesList.length === 0 ? <Empty text="Aún no se han registrado sanciones." /> : strikesList.map((item) => (
                        <div key={item.id} className="strike-item">
                          <div>
                            <strong>{item.user}</strong>
                            <p>{item.reason} · <span className="duration-tag">{item.duration}</span></p>
                          </div>
                          <time>{item.date}</time>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {/* TAB METRICS */}
            {tab === 'metrics' && (
              <Panel title="Métricas de Crecimiento & Rendimiento Operativo" caption="Estadísticas de conversión, tiempos SLA y volumen de plataforma." icon="chart">
                <div className="admin-metrics-grid">
                  <div className="metric-box">
                    <span>SLA de Aprobación</span>
                    <strong>18 min</strong>
                    <div className="progress-bar"><div style={{ width: '88%' }}></div></div>
                    <small>Meta: menos de 30 minutos</small>
                  </div>
                  <div className="metric-box">
                    <span>Tasa de Conversión a Creador</span>
                    <strong>64.2%</strong>
                    <div className="progress-bar"><div style={{ width: '64%' }}></div></div>
                    <small>Usuarios que completan el pago</small>
                  </div>
                  <div className="metric-box">
                    <span>Satisfacción de Moderación</span>
                    <strong>99.1%</strong>
                    <div className="progress-bar"><div style={{ width: '99%' }}></div></div>
                    <small>Reportes atendidos sin reclamo</small>
                  </div>
                </div>
              </Panel>
            )}


            {tab === 'billing' && <BillingOperations overview={overview} queue={queue} sysConfig={sysConfig} updateSystem={updateSystem} />}
            {tab === 'support' && <SupportOperations />}
            {tab === 'risk' && <RiskOperations sysConfig={sysConfig} updateSystem={updateSystem} />}

            {tab === 'permissions' && <PermissionsMatrix matrix={permissionMatrix} setMatrix={setPermissionMatrix} setNotice={setNotice} />}

            {tab === 'system' && (
              <Panel title="Configuración de Parámetros de Servidor" caption="Control dinámico de reglas operativas en tiempo real." icon="settings">
                <div className="system-params-grid">
                  <SystemToggle label="Modo mantenimiento" detail="Pausa el acceso público para ejecutar tareas programadas." active={sysConfig.maintenanceMode} onChange={() => updateSystem('maintenanceMode', !sysConfig.maintenanceMode, `Modo mantenimiento ${!sysConfig.maintenanceMode ? 'activado' : 'desactivado'}.`)} />
                  <SystemToggle label="Registro de creadores" detail="Habilita solicitudes nuevas y el flujo de activación de creador." active={sysConfig.creatorRegistration} onChange={() => updateSystem('creatorRegistration', !sysConfig.creatorRegistration)} />
                  <SystemToggle label="Cobro directo" detail="Permite iniciar órdenes externas desde la experiencia de pago." active={sysConfig.moneyPaymentActive} onChange={() => updateSystem('moneyPaymentActive', !sysConfig.moneyPaymentActive)} />
                  <SystemToggle label="Revisión previa de contenido" detail="Envía las publicaciones nuevas a la cola antes de hacerlas visibles." active={sysConfig.contentReview} onChange={() => updateSystem('contentReview', !sysConfig.contentReview)} />
                  <SystemToggle label="Chat en directos" detail="Mantiene disponibles las herramientas de conversación y moderación." active={sysConfig.liveChatEnabled} onChange={() => updateSystem('liveChatEnabled', !sysConfig.liveChatEnabled)} />
                  <SystemToggle label="Retención preventiva de pagos" detail="Conserva pagos de creadores en revisión hasta completar validaciones." active={sysConfig.autoHoldPayouts} onChange={() => updateSystem('autoHoldPayouts', !sysConfig.autoHoldPayouts)} />
                </div>
                <div className="system-policy-grid">
                  <label>Objetivo SLA de moderación<select value={sysConfig.moderationSla} onChange={event => updateSystem('moderationSla', event.target.value)}><option>15 min</option><option>30 min</option><option>60 min</option><option>4 horas</option></select></label>
                  <label>Nivel de revisión de riesgo<select value={sysConfig.riskLevel} onChange={event => updateSystem('riskLevel', event.target.value)}><option>Ligero</option><option>Estándar</option><option>Estricto</option></select></label>
                  <label>Comisión de plataforma<input value={sysConfig.creatorFee} onChange={event => updateSystem('creatorFee', event.target.value)} aria-label="Comisión de plataforma" /></label>
                </div>
              </Panel>
            )}

            {tab === 'audit' && (
              <Panel title="Registro de Auditoría y Seguridad" caption="Supervisión detallada de todas las acciones administrativas." icon="history">
                <div className="audit-timeline">
                  {actions.map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                  {!actions.length && <Empty text="No hay registros en la bitácora." />}
                </div>
              </Panel>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

// ============================================================================
// 1. DASHBOARD ENTERPRISE PARA MODERADOR (TRIAGE DE SEGURIDAD & ALERTAS)
// ============================================================================
function ModeratorEnterpriseOverview({ overview, reports, actions, setTab, decide, pending }) {
  const activeReports = reports.filter((item) => ['open', 'reviewing'].includes(item.status));

  return (
    <div className="enterprise-overview-container">
      {/* 6 EXECUTIVE TACTICAL METRIC CARDS */}
      <section className="executive-metrics-section">
        <h3 className="section-title">🛡️ Centro Táctico de Moderación</h3>
        <div className="metric-cards-grid">
          <div className="enterprise-card magenta-card">
            <div className="card-top">
              <span>Alertas Críticas</span>
              <span className="card-icon magenta"><Icon name="alert" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>{overview?.critical ?? 0}</strong>
              <small className="badge-down">Urgente</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#f43f5e" /></div>
          </div>

          <div className="enterprise-card cyan-card">
            <div className="card-top">
              <span>Reportes Activos</span>
              <span className="card-icon cyan"><Icon name="flag" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>{overview?.open_reports ?? activeReports.length}</strong>
              <small className="badge-up">En Cola</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#f2677f" /></div>
          </div>

          <div className="enterprise-card teal-card">
            <div className="card-top">
              <span>Resueltos Hoy</span>
              <span className="card-icon teal"><Icon name="check" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>{overview?.resolved_today ?? 4}</strong>
              <small className="badge-up">+100%</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#34d399" /></div>
          </div>

          <div className="enterprise-card blue-card">
            <div className="card-top">
              <span>SLA Respuesta</span>
              <span className="card-icon blue"><Icon name="clock" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>14 min</strong>
              <small className="badge-stable">Óptimo</small>
            </div>
            <div className="progress-teal-bar"><div style={{ width: '92%' }} /></div>
          </div>

          <div className="enterprise-card purple-card">
            <div className="card-top">
              <span>Strikes Emitidos</span>
              <span className="card-icon purple"><Icon name="alert" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>2 Activos</strong>
              <small className="badge-up">+1 hoy</small>
            </div>
            <div className="sparkline-wrapper"><SparklineWave color="#fbbf24" /></div>
          </div>

          <div className="enterprise-card wave-cyan-card">
            <div className="card-top">
              <span>Efectividad Moderación</span>
              <span className="card-icon cyan"><Icon name="shieldCheck" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>98.4%</strong>
              <small className="badge-up">Excelente</small>
            </div>
            <div className="sparkline-wrapper"><SparklineWave color="#c084fc" /></div>
          </div>
        </div>
      </section>

      {/* SECCIÓN MEDIA: MAPA DE ALERTAS LATAM + TABLA DE TRIAGE DE REPORTES */}
      <section className="middle-enterprise-grid">
        <div className="enterprise-panel status-map-panel">
          <div className="panel-header">
            <h3>Threat & Incident Radar Map</h3>
            <span className="status-badge-operational">● Monitoreo de Alertas Activas</span>
          </div>
          <div className="map-radar-body">
            <GlobalStatusMap />
          </div>
        </div>

        <div className="enterprise-panel user-table-panel">
          <div className="panel-header">
            <h3>Bandeja de Triage en Vivo</h3>
            <button className="panel-link-btn" onClick={() => setTab('reports')}>Ver todos los reportes</button>
          </div>
          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Reporte</th>
                  <th>Perfil</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Acciones Tácticas</th>
                </tr>
              </thead>
              <tbody>
                {activeReports.slice(0, 5).map((report) => (
                  <tr key={report.id}>
                    <td><strong>{report.reason}</strong></td>
                    <td>{report.profile_name}</td>
                    <td><span className={`tag-event event-${report.priority === 'critical' ? 'critical' : 'warning'}`}>[{priorityLabel[report.priority]}]</span></td>
                    <td><span className="dot-online">● {statusLabel[report.status]}</span></td>
                    <td>
                      <div className="action-icons">
                        <button disabled={pending} title="Descartar" onClick={() => decide(report.id, 'dismissed')}><Icon name="close" size={12} /></button>
                        <button disabled={pending} title="Resolver" onClick={() => decide(report.id, 'resolved')}><Icon name="check" size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!activeReports.length && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay reportes activos en este momento.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECCIÓN INFERIOR: GRÁFICOS DE VELOCIDAD DE RESPUESTA + HISTORIAL DE ACCIONES */}
      <section className="bottom-enterprise-grid">
        <div className="enterprise-panel graphs-panel">
          <div className="panel-header">
            <h3>Métricas de Velocidad de Moderación</h3>
          </div>
          <div className="graphs-dual-container">
            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>Tiempo de Respuesta (SLA)</strong>
                <span className="graph-legend"><i className="line-cyan" /> SLA Meta <i className="line-magenta" /> Real</span>
              </div>
              <CpuMemoryGraph />
            </div>
            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>Resolución vs Alertas</strong>
                <span className="graph-legend"><i className="line-teal" /> Resueltos</span>
              </div>
              <NetworkDiskGraph />
            </div>
          </div>
        </div>

        <div className="enterprise-panel logs-panel">
          <div className="panel-header">
            <h3>Bitácora de Decisiones Tácticas</h3>
          </div>
          <div className="table-wrapper">
            <table className="enterprise-table logs-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Moderador</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 5).map((act, index) => (
                  <tr key={index}>
                    <td>{new Date(act.created_at).toLocaleTimeString('es-PE')}</td>
                    <td>{act.moderator_name || 'Moderador Kinexy'}</td>
                    <td><span className="tag-event event-audit">[{act.action}]</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 2. DASHBOARD ENTERPRISE PARA ADMINISTRADOR NORMAL (GESTIÓN DE OPERACIONES)
// ============================================================================
function AdminEnterpriseOverview({ overview, reports, queue, actions, user, setTab, setNotice, updatedAt }) {
  const [logFilter, setLogFilter] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const [usersList, setUsersList] = useState([
    { id: 1, name: 'Alexnserter', email: 'admin@example.com', group: 'Admin', lastLogin: '13 January 22:36', status: 'Online' },
    { id: 2, name: 'Stephne', email: 'lorsam@example.com', group: 'Processors', lastLogin: '20 Day at 12:30', status: 'Offline' },
    { id: 3, name: 'Karsy', email: 'jestesh@example.com', group: 'Group', lastLogin: '30 Day at 32:30', status: 'Online' },
    { id: 4, name: 'Dokin', email: 'amina@example.com', group: 'Managers', lastLogin: '19 Day at 12:30', status: 'Offline' },
    { id: 5, name: 'Stevin', email: 'admin@example.com', group: 'Group', lastLogin: '20 Dec at 12:30', status: 'Online' }
  ]);

  const securityLogs = [
    { time: '17 Aug 233.17:00', type: 'Critical', ip: '192.168.13.3', admin: 'Audit', status: 'Blocked' },
    { time: '17 Aug 233.17:00', type: 'Warning', ip: '192.168.13.3', admin: 'Admin', status: 'Reviewed' },
    { time: '17 Aug 233.12:00', type: 'Critical', ip: '192.168.13.1', admin: 'Audit', status: 'Escalated' },
    { time: '17 Aug 233.17:00', type: 'Critical', ip: '192.168.13.3', admin: 'Admin', status: 'Resolved' },
    { time: '17 Aug 233.12:00', type: 'Audit', ip: '192.168.13.1', admin: 'Admin', status: 'Logged' }
  ];

  const filteredUsers = usersList.filter(u =>
    u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userQuery.toLowerCase()) ||
    u.group.toLowerCase().includes(userQuery.toLowerCase())
  );

  const filteredLogs = securityLogs.filter(log =>
    log.type.toLowerCase().includes(logFilter.toLowerCase()) ||
    log.ip.includes(logFilter) ||
    log.admin.toLowerCase().includes(logFilter.toLowerCase())
  );

  const handleToggleUserStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Online' ? 'Offline' : 'Online';
    setUsersList(usersList.map(u => u.id === id ? { ...u, status: nextStatus } : u));
    setNotice && setNotice(`Estado de usuario actualizado a ${nextStatus}`);
  };

  const timeAgo = (date) => {
    if (!date) return 'Nunca';
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return `Hace ${diff}s`;
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    return `Hace ${Math.floor(diff / 3600)} h`;
  };

  return (
    <div className="enterprise-overview-container">
      {/* 1. SECCIÓN SUPERIOR: 6 EXECUTIVE METRIC CARDS EN FILA */}
      <section className="executive-metrics-section">
        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>📊 Panel Operativo de Administración</span>
          {updatedAt && (
            <small style={{ fontSize: '10px', fontWeight: 400, color: '#7d7585' }}>Actualizado: {timeAgo(updatedAt)}</small>
          )}
        </h3>
        <div className="metric-cards-grid">
          {/* Card 1 */}
          <div className="enterprise-card cyan-card">
            <div className="card-top">
              <span>Total Users</span>
              <span className="card-icon cyan"><Icon name="users" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>148,932</strong>
              <small className="badge-up">+3.1%</small>
            </div>
            <div className="sparkline-wrapper">
              <SparklineChart color="#f2677f" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="enterprise-card blue-card">
            <div className="card-top">
              <span>Active Subscriptions</span>
              <span className="card-icon blue"><Icon name="crown" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>89,451</strong>
              <small className="badge-up">+1.2%</small>
            </div>
            <div className="sparkline-wrapper">
              <SparklineChart color="#c084fc" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="enterprise-card magenta-card">
            <div className="card-top">
              <span>Global Transactions</span>
              <span className="card-icon magenta"><Icon name="chart" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>S/ 3.5M</strong>
              <small className="badge-up">+0.8%</small>
            </div>
            <div className="sparkline-wrapper">
              <SparklineChart color="#f43f5e" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="enterprise-card teal-card">
            <div className="card-top">
              <span>Active Server Instances</span>
              <span className="card-icon teal"><Icon name="settings" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>24</strong>
              <small className="badge-stable">Stable</small>
            </div>
            <div className="progress-teal-bar">
              <div style={{ width: '85%' }} />
            </div>
          </div>

          {/* Card 5 */}
          <div className="enterprise-card wave-cyan-card">
            <div className="card-top">
              <span>API Req/sec</span>
              <span className="card-icon cyan"><Icon name="activity" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>18.1K</strong>
              <small className="badge-up">+2.5%</small>
            </div>
            <div className="sparkline-wrapper">
              <SparklineWave color="#fbbf24" />
            </div>
          </div>

          {/* Card 6 */}
          <div className="enterprise-card purple-card">
            <div className="card-top">
              <span>Data Ingest GB/s</span>
              <span className="card-icon purple"><Icon name="history" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>1.2K</strong>
              <small className="badge-down">-0.5%</small>
            </div>
            <div className="sparkline-wrapper">
              <SparklineWave color="#34d399" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. SECCIÓN MEDIA: GLOBAL SYSTEM STATUS (MAPA RADAR) + USER MANAGEMENT TABLE */}
      <section className="middle-enterprise-grid">
        {/* COLUMNA IZQUIERDA: GLOBAL SYSTEM STATUS */}
        <div className="enterprise-panel status-map-panel">
          <div className="panel-header">
            <h3>Global System Status</h3>
            <span className="status-badge-operational">● All Systems Operational</span>
          </div>
          <div className="map-radar-body">
            <GlobalStatusMap />
          </div>
        </div>

        {/* COLUMNA DERECHA: USER MANAGEMENT TABLE */}
        <div className="enterprise-panel user-table-panel">
          <div className="panel-header">
            <h3>User Management Table</h3>
            <div className="table-search-inline">
              <input
                type="search"
                placeholder="Buscar usuarios..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
              <button className="panel-link-btn" onClick={() => setTab('accounts')}>Ver todos</button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Group</th>
                  <th>Last Login</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td><span className="user-cell"><Avatar name={u.name} /> {u.name}</span></td>
                    <td>{u.email}</td>
                    <td>{u.group}</td>
                    <td>{u.lastLogin}</td>
                    <td>
                      <span className={u.status === 'Online' ? 'dot-online' : 'dot-offline'}>
                        ● {u.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-icons">
                        <button title="Alternar Estado" onClick={() => handleToggleUserStatus(u.id, u.status)}>
                          <Icon name="eye" size={12} />
                        </button>
                        <button title="Gestionar" onClick={() => setTab('accounts')}>
                          <Icon name="userCheck" size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. SECCIÓN INFERIOR: SERVER PERFORMANCE GRAPHS + SECURITY LOGS */}
      <section className="bottom-enterprise-grid">
        {/* COLUMNA IZQUIERDA: SERVER PERFORMANCE GRAPHS */}
        <div className="enterprise-panel graphs-panel">
          <div className="panel-header">
            <h3>Server Performance Graphs</h3>
          </div>
          <div className="graphs-dual-container">
            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>CPU & Memory</strong>
                <span className="graph-legend">
                  <i className="line-cyan" /> CPU <i className="line-magenta" /> Memory
                </span>
              </div>
              <CpuMemoryGraph />
            </div>

            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>Network & Disk I/O</strong>
                <span className="graph-legend">
                  <i className="line-teal" /> Network & Disk I/O
                </span>
              </div>
              <NetworkDiskGraph />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: SECURITY LOGS */}
        <div className="enterprise-panel logs-panel">
          <div className="panel-header">
            <h3>Security Logs</h3>
            <div className="panel-header-filters">
              <button className="link-action">View Details</button>
              <button className="link-action">Filter by Type</button>
            </div>
          </div>

          <div className="log-filter-box">
            <input
              type="search"
              placeholder="Filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
            />
          </div>

          <div className="table-wrapper">
            <table className="enterprise-table logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Source IP</th>
                  <th>Admin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => (
                  <tr key={index}>
                    <td>{log.time}</td>
                    <td>
                      <span className={`tag-event event-${log.type.toLowerCase()}`}>
                        [{log.type}]
                      </span>
                    </td>
                    <td>{log.ip}</td>
                    <td>{log.admin}</td>
                    <td><button className="details-link">View Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 3. DASHBOARD ENTERPRISE PARA SUPERADMIN (GOBIERNO IMPERIAL & CONTROL DE SERVIDORES)
// ============================================================================
function SuperadminEnterpriseOverview({ overview, actions, sysConfig, setSysConfig, setTab, setNotice }) {
  return (
    <div className="enterprise-overview-container">
      {/* 6 EXECUTIVE GOVERNANCE METRIC CARDS */}
      <section className="executive-metrics-section">
        <h3 className="section-title">⚡ Consola Imperial de Gobernanza</h3>
        <div className="metric-cards-grid">
          <div className="enterprise-card purple-card">
            <div className="card-top">
              <span>Cuentas Globales</span>
              <span className="card-icon purple"><Icon name="users" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>148,932</strong>
              <small className="badge-up">+3.1%</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#fbbf24" /></div>
          </div>

          <div className="enterprise-card blue-card">
            <div className="card-top">
              <span>Equipo Interno</span>
              <span className="card-icon blue"><Icon name="key" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>12 Admins/Mods</strong>
              <small className="badge-stable">Supervisado</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#c084fc" /></div>
          </div>

          <div className="enterprise-card magenta-card">
            <div className="card-top">
              <span>Ingresos Globales</span>
              <span className="card-icon magenta"><Icon name="chart" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>S/ 3.5M</strong>
              <small className="badge-up">+0.8%</small>
            </div>
            <div className="sparkline-wrapper"><SparklineChart color="#f43f5e" /></div>
          </div>

          <div className="enterprise-card teal-card">
            <div className="card-top">
              <span>Uptime Servidor</span>
              <span className="card-icon teal"><Icon name="settings" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>99.98%</strong>
              <small className="badge-up">Nivel Máximo</small>
            </div>
            <div className="progress-teal-bar"><div style={{ width: '99.9%' }} /></div>
          </div>

          <div className="enterprise-card wave-cyan-card">
            <div className="card-top">
              <span>Claves API & DB</span>
              <span className="card-icon cyan"><Icon name="activity" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>54 Activas</strong>
              <small className="badge-up">Encriptadas</small>
            </div>
            <div className="sparkline-wrapper"><SparklineWave color="#34d399" /></div>
          </div>

          <div className="enterprise-card cyan-card">
            <div className="card-top">
              <span>Amenaza de Seguridad</span>
              <span className="card-icon cyan"><Icon name="shield" size={14} /></span>
            </div>
            <div className="card-value-row">
              <strong>0 Nominal</strong>
              <small className="badge-up">Protegido</small>
            </div>
            <div className="sparkline-wrapper"><SparklineWave color="#f2677f" /></div>
          </div>
        </div>
      </section>

      {/* SECCIÓN MEDIA: NODO CLUSTER MAP + CONTROL DE ROLES & PERMISOS */}
      <section className="middle-enterprise-grid">
        <div className="enterprise-panel status-map-panel">
          <div className="panel-header">
            <h3>Global Server Cluster Nodes</h3>
            <span className="status-badge-operational">● Servidores Kinexy Perú En Línea</span>
          </div>
          <div className="map-radar-body">
            <GlobalStatusMap />
          </div>
        </div>

        <div className="enterprise-panel user-table-panel">
          <div className="panel-header">
            <h3>Gobierno Rápido de Parámetros</h3>
            <button className="panel-link-btn" onClick={() => setTab('system')}>Ver Configuración</button>
          </div>
          <div className="quick-toggles" style={{ padding: '10px' }}>
            <div className="toggle-row">
              <span>Modo Mantenimiento Plataforma</span>
              <button
                className={`toggle-pill ${sysConfig.maintenanceMode ? 'on' : 'off'}`}
                onClick={() => {
                  setSysConfig({ ...sysConfig, maintenanceMode: !sysConfig.maintenanceMode });
                  setNotice && setNotice(`Modo Mantenimiento ${!sysConfig.maintenanceMode ? 'ACTIVADO' : 'DESACTIVADO'}`);
                }}
              >
                {sysConfig.maintenanceMode ? 'ACTIVADO' : 'DESACTIVADO'}
              </button>
            </div>
            <div className="toggle-row">
              <span>Registro de Creadores Público</span>
              <button
                className={`toggle-pill ${sysConfig.creatorRegistration ? 'on' : 'off'}`}
                onClick={() => {
                  setSysConfig({ ...sysConfig, creatorRegistration: !sysConfig.creatorRegistration });
                  setNotice && setNotice(`Registro de Creadores ${!sysConfig.creatorRegistration ? 'HABILITADO' : 'PAUSADO'}`);
                }}
              >
                {sysConfig.creatorRegistration ? 'HABILITADO' : 'PAUSADO'}
              </button>
            </div>
            <div className="toggle-row">
              <span>Pago en Dinero Directo (S/ 50)</span>
              <button
                className={`toggle-pill ${sysConfig.moneyPaymentActive ? 'on' : 'off'}`}
                onClick={() => {
                  setSysConfig({ ...sysConfig, moneyPaymentActive: !sysConfig.moneyPaymentActive });
                  setNotice && setNotice(`Pago en Dinero ${!sysConfig.moneyPaymentActive ? 'ACTIVO' : 'INACTIVO'}`);
                }}
              >
                {sysConfig.moneyPaymentActive ? 'ACTIVO' : 'INACTIVO'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN INFERIOR: RENDIMIENTO DB & SECURITY AUDIT STREAM */}
      <section className="bottom-enterprise-grid">
        <div className="enterprise-panel graphs-panel">
          <div className="panel-header">
            <h3>Rendimiento y Carga de Servidor Master</h3>
          </div>
          <div className="graphs-dual-container">
            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>Latencia de Base de Datos</strong>
                <span className="graph-legend"><i className="line-cyan" /> Latencia ms</span>
              </div>
              <CpuMemoryGraph />
            </div>
            <div className="graph-subbox">
              <div className="graph-title-row">
                <strong>Ancho de Banda & Conexiones</strong>
                <span className="graph-legend"><i className="line-teal" /> Conexiones</span>
              </div>
              <NetworkDiskGraph />
            </div>
          </div>
        </div>

        <div className="enterprise-panel logs-panel">
          <div className="panel-header">
            <h3>Auditoría de Seguridad Master</h3>
          </div>
          <div className="table-wrapper">
            <table className="enterprise-table logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Evento</th>
                  <th>Admin</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {actions.slice(0, 5).map((act, index) => (
                  <tr key={index}>
                    <td>{new Date(act.created_at).toLocaleTimeString('es-PE')}</td>
                    <td><span className="tag-event event-audit">[{act.action}]</span></td>
                    <td>{act.moderator_name || 'Superadmin'}</td>
                    <td><span className="dot-online">● Verificado</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// COMPONENTES VECTORIALES SVG CON PALETA KINEXY
// ============================================================================

function SparklineChart({ color = '#f2677f' }) {
  return (
    <svg viewBox="0 0 120 30" className="sparkline-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0 25 Q 20 15, 40 22 T 80 8 T 120 4 L 120 30 L 0 30 Z"
        fill={`url(#grad-${color.replace('#','')})`}
      />
      <path
        d="M 0 25 Q 20 15, 40 22 T 80 8 T 120 4"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparklineWave({ color = '#fbbf24' }) {
  return (
    <svg viewBox="0 0 120 30" className="sparkline-svg" preserveAspectRatio="none">
      <path
        d="M 0 15 Q 15 5, 30 20 T 60 10 T 90 25 T 120 8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobalStatusMap() {
  return (
    <div className="world-map-svg-container">
      <svg viewBox="0 0 700 320" className="world-map-svg">
        <path
          d="M 120 100 Q 150 70 200 80 T 260 120 T 220 180 T 150 160 Z M 320 80 Q 360 60 420 90 T 480 140 T 400 200 T 340 130 Z M 520 100 Q 580 80 640 120 T 620 200 T 540 160 Z M 160 220 Q 200 210 240 240 T 210 300 T 170 270 Z"
          fill="#231f2b"
          opacity="0.6"
        />

        <path d="M 180 180 Q 320 100 350 120" stroke="#f2677f" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
        <path d="M 350 120 Q 480 100 580 160" stroke="#f2677f" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
        <path d="M 350 120 Q 420 180 500 220" stroke="#f2677f" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />

        <g transform="translate(180, 180)">
          <circle r="12" fill="#f2677f" opacity="0.3" className="pulse-circle" />
          <rect x="-18" y="-10" width="36" height="20" rx="4" fill="#be123c" />
          <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">LIMA</text>
        </g>

        <g transform="translate(350, 120)">
          <circle r="16" fill="#f2677f" opacity="0.4" className="pulse-circle" />
          <rect x="-22" y="-12" width="44" height="24" rx="5" fill="#f2677f" />
          <text x="0" y="4" fill="#140a10" fontSize="10" fontWeight="bold" textAnchor="middle">PUCALLPA</text>
        </g>

        <g transform="translate(580, 160)">
          <circle r="12" fill="#c084fc" opacity="0.3" className="pulse-circle" />
          <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#9333ea" />
          <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">IQUITOS</text>
        </g>

        <g transform="translate(500, 220)">
          <circle r="12" fill="#fbbf24" opacity="0.3" className="pulse-circle" />
          <rect x="-24" y="-10" width="48" height="20" rx="4" fill="#d97706" />
          <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">TARAPOTO</text>
        </g>
      </svg>
    </div>
  );
}

function CpuMemoryGraph() {
  return (
    <svg viewBox="0 0 350 140" className="performance-graph-svg">
      <line x1="40" y1="20" x2="340" y2="20" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="40" y1="50" x2="340" y2="50" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="40" y1="80" x2="340" y2="80" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="40" y1="110" x2="340" y2="110" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />

      <text x="5" y="24" fill="#8c8393" fontSize="8">100.00%</text>
      <text x="5" y="54" fill="#8c8393" fontSize="8">60.00%</text>
      <text x="5" y="84" fill="#8c8393" fontSize="8">40.00%</text>
      <text x="5" y="114" fill="#8c8393" fontSize="8">20.00%</text>

      <path
        d="M 40 80 Q 70 40, 100 65 T 160 30 T 220 70 T 280 40 T 340 55"
        fill="none"
        stroke="#f2677f"
        strokeWidth="2"
      />

      <path
        d="M 40 100 Q 70 70, 100 85 T 160 50 T 220 90 T 280 60 T 340 75"
        fill="none"
        stroke="#c084fc"
        strokeWidth="2"
      />

      <text x="50" y="130" fill="#8c8393" fontSize="8">24h</text>
      <text x="110" y="130" fill="#8c8393" fontSize="8">04h</text>
      <text x="170" y="130" fill="#8c8393" fontSize="8">08h</text>
      <text x="230" y="130" fill="#8c8393" fontSize="8">12h</text>
      <text x="290" y="130" fill="#8c8393" fontSize="8">16h</text>
    </svg>
  );
}

function NetworkDiskGraph() {
  return (
    <svg viewBox="0 0 350 140" className="performance-graph-svg">
      <line x1="40" y1="20" x2="340" y2="20" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="40" y1="60" x2="340" y2="60" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1="40" y1="100" x2="340" y2="100" stroke="#282531" strokeWidth="0.5" strokeDasharray="2 2" />

      <text x="5" y="24" fill="#8c8393" fontSize="8">7 MB/s</text>
      <text x="5" y="64" fill="#8c8393" fontSize="8">3 MB/s</text>
      <text x="5" y="104" fill="#8c8393" fontSize="8">0 MB/s</text>

      <path
        d="M 40 90 L 70 50 L 100 70 L 130 30 L 160 85 L 190 40 L 220 25 L 250 80 L 280 35 L 310 65 L 340 40"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
      />

      <path
        d="M 40 105 L 70 80 L 100 90 L 130 65 L 160 95 L 190 75 L 220 55 L 250 95 L 280 65 L 310 85 L 340 70"
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
      />

      <text x="50" y="130" fill="#8c8393" fontSize="8">24h</text>
      <text x="110" y="130" fill="#8c8393" fontSize="8">04h</text>
      <text x="170" y="130" fill="#8c8393" fontSize="8">08h</text>
      <text x="230" y="130" fill="#8c8393" fontSize="8">12h</text>
      <text x="290" y="130" fill="#8c8393" fontSize="8">16h</text>
    </svg>
  );
}

function Avatar({ name }) {
  return (
    <span className="user-avatar-mini">
      {name?.[0]?.toUpperCase()}
    </span>
  );
}

// SUBCOMPONENTES SECUNDARIOS
function ReportFilters({ filters, setFilters, total }) {
  const change = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <div className="report-filters">
      <label>
        <Icon name="search" />
        <input value={filters.query} onChange={change('query')} placeholder="Buscar por perfil, motivo o detalle" aria-label="Buscar reportes" />
      </label>
      <select value={filters.priority} onChange={change('priority')} aria-label="Filtrar por prioridad">
        <option value="all">Toda prioridad</option>
        <option value="critical">Crítica</option>
        <option value="high">Alta</option>
        <option value="medium">Media</option>
        <option value="low">Baja</option>
      </select>
      <select value={filters.status} onChange={change('status')} aria-label="Filtrar por estado">
        <option value="active">Activos</option>
        <option value="all">Todos</option>
        <option value="open">Abiertos</option>
        <option value="reviewing">En revisión</option>
        <option value="resolved">Resueltos</option>
        <option value="dismissed">Descartados</option>
      </select>
      <output>{total} resultados</output>
    </div>
  );
}

function Panel({ title, caption, icon, children }) {
  return (
    <section className="moderation-panel enterprise-panel">
      <div className="panel-title">
        <span><Icon name={icon} /></span>
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SystemToggle({ label, detail, active, onChange }) {
  return <article className="param-card"><div><strong>{label}</strong><p>{detail}</p></div><button type="button" className={`toggle-switch ${active ? 'is-on' : ''}`} aria-pressed={active} onClick={onChange}><i/><span>{active ? 'Activo' : 'Pausado'}</span></button></article>;
}

function BillingOperations({ overview, queue, sysConfig, updateSystem }) {
  const pendingProfiles = queue?.length || overview?.pending_profiles || 0;
  const openReports = overview?.open_reports || 0;
  return <Panel title="Pagos y liquidaciones" caption="Revisa solicitudes reales antes de autorizar movimientos de saldo." icon="wallet">
    <div className="billing-summary">
      <article><span>Retiros pendientes</span><strong>0</strong><small>Sin solicitudes por revisar</small></article>
      <article><span>Perfiles en validación</span><strong>{pendingProfiles}</strong><small>En cola de aprobación</small></article>
      <article><span>Reportes abiertos</span><strong>{openReports}</strong><small>Casos que requieren atención</small></article>
    </div>
    <div className="billing-toolbar">
      <div className="billing-status"><strong>{sysConfig.autoHoldPayouts ? 'Retención preventiva activa' : 'Retención preventiva desactivada'}</strong><small>Los retiros se mostrarán aquí cuando existan solicitudes reales.</small></div>
      <button className="ghost" onClick={() => updateSystem('autoHoldPayouts', !sysConfig.autoHoldPayouts, `Retención preventiva ${!sysConfig.autoHoldPayouts ? 'activada' : 'desactivada'}.`)}>{sysConfig.autoHoldPayouts ? 'Pausar retención' : 'Activar retención'}</button>
    </div>
    <section className="settlement-list"><header><strong>Solicitudes de liquidación</strong><span>Datos en tiempo real</span></header><Empty text="No hay retiros ni liquidaciones pendientes." /></section>
  </Panel>;
}

function SupportOperations() {
  return <Panel title="Soporte y seguimiento" caption="Aquí aparecerán las solicitudes enviadas por clientes y creadores." icon="message">
    <div className="support-toolbar"><div><strong>Bandeja de soporte</strong><small>Los casos reales se ordenarán por fecha y prioridad.</small></div></div>
    <div className="support-list"><Empty text="No hay solicitudes abiertas en este momento." /></div>
  </Panel>;
}

function RiskOperations({ sysConfig, updateSystem }) {
  return <Panel title="Riesgo, confianza y cumplimiento" caption="Define cómo responde la plataforma ante señales sensibles y contenido reportado." icon="shield"><div className="risk-grid"><section><span className="risk-score">92</span><div><small>ÍNDICE DE CONFIANZA</small><h3>Operación estable</h3><p>Las revisiones preventivas y la auditoría están activas.</p></div></section><section><h3>Política activa</h3><label>Nivel de revisión<select value={sysConfig.riskLevel} onChange={event => updateSystem('riskLevel', event.target.value)}><option>Ligero</option><option>Estándar</option><option>Estricto</option></select></label><label className="ops-check"><input type="checkbox" checked={sysConfig.contentReview} onChange={event => updateSystem('contentReview', event.target.checked)}/><span><strong>Revisar contenido nuevo</strong><small>Deriva publicaciones nuevas a la cola.</small></span></label></section></div><div className="risk-checklist"><span>✓ Documentos de creadores</span><span>✓ Historial de moderación</span><span>✓ Retención preventiva</span><span>✓ Trazabilidad de decisiones</span></div></Panel>;
}

function Empty({ text }) {
  return (
    <div className="moderation-empty">
      <span><Icon name="check" /></span>
      <p>{text}</p>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {[1, 2, 3].map(n => (
        <div
          key={n}
          style={{
            height: '80px',
            borderRadius: '14px',
            background: 'linear-gradient(100deg, #16151c 25%, #1e1c27 50%, #16151c 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-admin 1.5s infinite'
          }}
        />
      ))}
    </div>
  );
}

function ReportRow({ report, pending, decide }) {
  const closed = ['resolved', 'dismissed'].includes(report.status);
  return (
    <article className={`report-row priority-card-${report.priority}`}>
      <span className={`priority priority-${report.priority}`} aria-hidden="true" />
      <div>
        <div>
          <strong>{report.reason}</strong>
          <span className={`report-priority priority-label-${report.priority}`}>{priorityLabel[report.priority]}</span>
        </div>
        <p>{report.profile_name} · {report.details}</p>
        <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleString('es-PE')}</time>
      </div>
      {!closed && (
        <div className="report-actions">
          <button disabled={pending} onClick={() => decide(report.id, 'dismissed')}>
            <Icon name="close" /> Descartar
          </button>
          <button disabled={pending} onClick={() => decide(report.id, report.status === 'reviewing' ? 'resolved' : 'reviewing')}>
            <Icon name={report.status === 'reviewing' ? 'check' : 'eye'} />
            {report.status === 'reviewing' ? 'Resolver' : 'Revisar'}
          </button>
        </div>
      )}
    </article>
  );
}

function ActionRow({ action }) {
  return (
    <article className="action-row">
      <span><Icon name="shieldCheck" /></span>
      <div>
        <strong>{action.moderator_name || 'Equipo Kinexy'}</strong>
        <p>{action.action}</p>
      </div>
      <time dateTime={action.created_at}>{new Date(action.created_at).toLocaleString('es-PE')}</time>
    </article>
  );
}

function PermissionsMatrix({ matrix, setMatrix, setNotice }) {
  const rows = [
    ['moderate_content', 'Moderar contenido y publicaciones'],
    ['resolve_reports', 'Resolver reportes de la comunidad'],
    ['review_payments', 'Revisar pagos y recargas'],
    ['view_accounts', 'Consultar directorio de cuentas'],
    ['approve_profiles', 'Aprobar o rechazar perfiles'],
    ['manage_users', 'Crear o eliminar usuarios'],
    ['manage_roles', 'Cambiar roles de administración'],
    ['manage_system', 'Modificar parámetros del servidor']
  ];
  async function toggle(role, permission) {
    const enabled = !(matrix?.[role] || []).includes(permission);
    const result = await permissionsService.update(role, permission, enabled);
    setMatrix(result.matrix);
    setNotice(`${permission} ${enabled ? 'activado' : 'desactivado'} para ${role}.`);
  }
  return (
    <section className="permissions-panel">
      <header>
        <span><Icon name="key" /></span>
        <div>
          <h2>Matriz de Responsabilidades y Accesos</h2>
          <p>Separación estricta de funciones entre Moderadores, Administradores y Superadmin.</p>
        </div>
      </header>
      <div className="permissions-table" role="table" aria-label="Matriz de permisos">
        <div className="permissions-head" role="row">
          <strong>Permiso / Acción</strong>
          <strong>Moderador</strong>
          <strong>Administrador</strong>
          <strong>Superadmin</strong>
        </div>
        {rows.map(([permission, label]) => (
          <div className="permissions-row" key={permission} role="row">
            <span>{label}</span>
            {['moderator','admin','superadmin'].map((role) => { const allowed = role === 'superadmin' || (matrix?.[role] || []).includes(permission); return (
              <button type="button" key={role} className={`permission-toggle ${allowed ? 'allowed' : ''}`} disabled={role === 'superadmin' || !matrix} onClick={() => toggle(role, permission)} aria-pressed={allowed}>{allowed ? 'Permitido' : 'Bloqueado'}</button>
            ); })}
          </div>
        ))}
      </div>
    </section>
  );
}

function OperationalOverview({ role, overview, queue, reports, actions, setTab, updatedAt }) {
  const cards = [
    ['Perfiles por revisar', overview?.pending_profiles ?? queue.length, 'queue', 'userCheck'],
    ['Reportes abiertos', overview?.open_reports ?? reports.filter(item => ['open','reviewing'].includes(item.status)).length, 'reports', 'flag'],
    ['Resueltos hoy', overview?.resolved_today ?? 0, 'audit', 'check'],
    ['Alertas críticas', overview?.critical ?? 0, 'reports', 'alert']
  ];
  return <section className="ops-overview" aria-labelledby="ops-title">
    <header><div><span className="eyebrow">OPERACIÓN ACTUAL</span><h2 id="ops-title">Panel de {role === 'superadmin' ? 'superadministración' : role === 'admin' ? 'administración' : 'moderación'}</h2><p>Datos reales de la cola y la actividad del sistema.</p></div><small>Actualizado {updatedAt ? updatedAt.toLocaleTimeString('es-PE') : 'ahora'}</small></header>
    <div className="ops-overview-grid">{cards.map(([label,value,target,icon]) => <button type="button" key={label} onClick={() => setTab(target)}><span><Icon name={icon}/></span><small>{label}</small><strong>{value}</strong><b>Revisar →</b></button>)}</div>
    <div className="ops-recent"><header><h3>Actividad reciente</h3><button type="button" onClick={() => setTab('audit')}>Abrir auditoría</button></header>{actions.slice(0,6).map(action => <ActionRow key={action.id} action={action}/>)}{!actions.length && <Empty text="Todavía no hay acciones registradas."/>}</div>
  </section>;
}

function Icon({ name, size = 18 }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    flag: <><path d="M5 21V4"/><path d="M5 5c5-3 9 3 14 0v10c-5 3-9-3-14 0"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></>,
    refresh: <><path d="M20 7h-5V2"/><path d="M20 7a9 9 0 1 0 1 8"/></>,
    userCheck: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="M6 6l12 12M18 6 6 18"/>,
    alert: <><path d="M10.3 3.5 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/></>,
    arrow: <path d="M5 12h14M14 7l5 5-5 5"/>,
    activity: <path d="M3 12h4l2-6 4 12 2-6h6"/>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    shieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 0 4 10 15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0-4-10 15.3 15.3 0 0 0 4-10Z"/><path d="M2 12h20"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    crown: <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>,
    chart: <path d="M18 20V10M12 20V4M6 20v-6"/>,
    key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    wallet: <><path d="M4 5h14a2 2 0 0 1 2 2v12H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12"/><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>,
    broadcast: <><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/></>
    ,chevron: <path d="m9 18 6-6-6-6"/>
  };
  return (
    <svg className={`ui-icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.dashboard}
    </svg>
  );
}

