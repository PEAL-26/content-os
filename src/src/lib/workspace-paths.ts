/**
 * Builds a workspace-scoped URL: /<workspaceId>/<section>
 * e.g. workspacePath(id, 'articles') => /<id>/articles
 */
export function workspacePath(
    workspaceId: string,
    section?: string
): string {
    const clean = (section ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
    return clean ? `/${workspaceId}/${clean}` : `/${workspaceId}`;
}

/**
 * Known non-workspace top-level paths (never treated as a workspace slug/id).
 */
export const GLOBAL_PATHS = [
    '/login',
    '/register',
    '/onboarding',
] as const;

/**
 * Returns the workspaceId carried by the URL for workspace-scoped routes,
 * or null when the first path segment is not a workspace.
 */
export function getWorkspaceIdFromPath(pathname: string): string | null {
    if (GLOBAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return null;
    }
    const first = pathname.split('/')[1];
    return first && first.length > 0 ? first : null;
}