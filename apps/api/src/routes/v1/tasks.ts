import { Router } from 'express';
import type { ApiSuccess, TaskListItem } from '@gc3/types';
import { formatIssues, taskIdParamsSchema, updateTaskSchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { taskRepository } from '../../repositories/task.repository';

/**
 * Internal task items.
 *
 * Staff-only: a task is the pod's own breakdown of a request, so there is no
 * client-facing read path at all. Creation and listing live on the request
 * (`/service-requests/:id/tasks`); this router owns mutations by task id, because
 * an assignee needs to progress their own item without knowing the request.
 */
export const tasksRouter: Router = Router();

tasksRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  if (!organizationId) {
    throw ApiError.badRequest('Tenant scope is required', [
      { path: 'x-organization-id', message: 'Missing tenant scope' },
    ]);
  }

  return organizationId;
}

/** PATCH /tasks/:taskId — progress, rename, reassign, re-date, retire. */
tasksRouter.patch('/:taskId', requirePermission('task:manage'), async (request, response) => {
  const params = taskIdParamsSchema.safeParse(request.params);
  const body = updateTaskSchema.safeParse(request.body);

  if (!params.success) {
    throw ApiError.badRequest('Invalid task id', formatIssues(params.error));
  }

  if (!body.success) {
    throw ApiError.badRequest('Invalid task payload', formatIssues(body.error));
  }

  const updated = await taskRepository.updateScoped(
    scopeOf(request.organizationId),
    params.data.taskId,
    {
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.description !== undefined ? { description: body.data.description } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.assigneeId !== undefined ? { assigneeId: body.data.assigneeId } : {}),
      ...(body.data.podId !== undefined ? { podId: body.data.podId } : {}),
      ...(body.data.dueAt !== undefined ? { dueAt: body.data.dueAt } : {}),
    },
  );

  if (!updated) {
    throw ApiError.notFound('Task not found');
  }

  const payload: ApiSuccess<TaskListItem> = { success: true, data: updated };
  response.status(200).json(payload);
});
