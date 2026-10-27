/** Enlace del menú del workspace: ruta, clave de traducción e ícono de texto. */
export interface NavLink {
  path: string;
  labelKey: string;
  icon: string;
  /** Solo activo en la ruta exacta (la portada /app, para no marcarse en todas las páginas). */
  exact?: boolean;
}

/** Grupo del menú; sin rótulo para las herramientas finales. */
export interface NavGroup {
  labelKey: string | null;
  links: readonly NavLink[];
}

/**
 * Menú agrupado (EP-12 D9): primero el uso diario (Hoy es la portada), luego las suscripciones (su resumen sigue en
 * /app/summary) y al final analítica e IA. Lo comparten el riel de escritorio y el menú "Más" del móvil.
 */
export const navGroups: readonly NavGroup[] = [
  {
    labelKey: 'nav.group.daily',
    links: [
      { path: '/app', labelKey: 'nav.today', icon: '☀', exact: true },
      { path: '/app/transactions', labelKey: 'nav.transactions', icon: '≡' },
      { path: '/app/calendar', labelKey: 'nav.calendar', icon: '▦' },
      { path: '/app/accounts', labelKey: 'nav.accounts', icon: '◧' },
      { path: '/app/categories', labelKey: 'nav.categories', icon: '◈' },
    ],
  },
  {
    labelKey: 'nav.group.subscriptions',
    links: [
      { path: '/app/summary', labelKey: 'nav.overview', icon: '⌂' },
      { path: '/app/subscriptions', labelKey: 'nav.subscriptions', icon: '◫' },
      { path: '/app/upcoming', labelKey: 'nav.upcoming', icon: '↗' },
      { path: '/app/simulator', labelKey: 'nav.simulator', icon: '✂' },
    ],
  },
  {
    labelKey: 'nav.group.tools',
    links: [
      { path: '/app/analytics', labelKey: 'nav.analyticsReports', icon: '◔' },
      { path: '/app/insights', labelKey: 'nav.insights', icon: '◎' },
    ],
  },
];

/** Accesos directos de la barra inferior móvil (rótulos cortos para 360 px); el resto se abre desde "Más". */
export const mobileLinks: readonly NavLink[] = [
  { path: '/app', labelKey: 'nav.today', icon: '☀', exact: true },
  { path: '/app/transactions', labelKey: 'nav.transactions', icon: '≡' },
  { path: '/app/accounts', labelKey: 'nav.accounts', icon: '◧' },
  { path: '/app/subscriptions', labelKey: 'nav.payments', icon: '◫' },
];
