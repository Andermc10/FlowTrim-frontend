import { routes } from './app.routes';
import { mobileLinks, navGroups } from './workspace-nav';

/** EP-12 D9: el menú agrupado sigue llevando a cada pantalla del workspace y Hoy es la portada. */
describe('workspace navigation', () => {
  const workspacePaths = routes
    .find((route) => route.path === 'app')!
    .children!.filter((route) => route.loadComponent && !route.path!.includes('/'))
    .map((route) => (route.path ? `/app/${route.path}` : '/app'));

  it('links every top-level workspace screen exactly once', () => {
    const linked = navGroups.flatMap((group) => group.links.map((link) => link.path));

    expect([...linked].sort()).toEqual([...workspacePaths].sort());
    expect(new Set(linked).size).toBe(linked.length);
  });

  it('starts with the daily group and Today as the home', () => {
    expect(navGroups[0].labelKey).toBe('nav.group.daily');
    expect(navGroups[0].links[0]).toEqual(expect.objectContaining({ path: '/app', labelKey: 'nav.today', exact: true }));
  });

  it('keeps four shortcuts on mobile, all part of the full menu', () => {
    const all = navGroups.flatMap((group) => group.links.map((link) => link.path));

    expect(mobileLinks).toHaveLength(4);
    expect(mobileLinks.every((link) => all.includes(link.path))).toBe(true);
  });
});
