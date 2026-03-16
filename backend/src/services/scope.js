function resolveWorkspaceId(req) {
  // Current INVOX deployments treat companyId as the workspace boundary.
  // This helper centralizes the logic so multi-workspace can be added later.
  if (!req?.user?.companyId) return null;
  return String(req.user.companyId);
}

function withWorkspaceScope(filter, workspaceId) {
  if (!workspaceId) return filter;
  const workspaceMatch = {
    $or: [{ workspaceId }, { workspaceId: { $exists: false } }, { workspaceId: null }]
  };
  if (!filter || Object.keys(filter).length === 0) return workspaceMatch;
  if (filter.$and) return { ...filter, $and: [...filter.$and, workspaceMatch] };
  return { $and: [filter, workspaceMatch] };
}

module.exports = { resolveWorkspaceId, withWorkspaceScope };

