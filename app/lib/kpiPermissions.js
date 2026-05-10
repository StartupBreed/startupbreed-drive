export const ROLES = { ADMIN: 'admin', MEMBER: 'member' };

// To restrict an action later: remove 'member' from its array
const PERMISSIONS = {
  'kpi:submit':            ['admin', 'member'],
  'kpi:view_team':         ['admin', 'member'],   // flip to ['admin'] when ready
  'kpi:manage_recruiters': ['admin', 'member'],   // flip to ['admin'] when ready
  'kpi:edit_settings':     ['admin', 'member'],   // flip to ['admin'] when ready
};

export function can(role = 'member', action) {
  return PERMISSIONS[action]?.includes(role) ?? false;
}

// Every authenticated user is 'member' for now.
// When you add roles: store role in session.user.role and pass it here.
export function getUserRole(session) {
  return session?.user?.role ?? ROLES.MEMBER;
}
