/** Name of each role's dashboard (website header button) and the page it opens first. */
export const PORTAL = { customer: 'My dashboard', dsa: 'DSA portal', tip: 'TIP portal', admin: 'Admin portal' } as const;
export const LANDING = { customer: '/portal/requests', dsa: '/portal/home', tip: '/portal/home', admin: '/portal/home' } as const;
