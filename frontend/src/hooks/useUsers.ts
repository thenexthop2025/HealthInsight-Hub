import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userAPI } from '../services/api';
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserEntity,
  UserListParams,
  PaginatedResponse,
  UserListResponse,
} from '../types/user';

export type UserFilters = UserListParams;

export function useUsers(filters?: UserFilters) {
  return useQuery<UserListResponse>(['users', filters], async () => {
    const res = await userAPI.getUsers(filters);
    return res.data;
  });
}

export function useUserMutations() {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries('users');

  const createUser = useMutation((data: CreateUserPayload) => userAPI.createUser(data), {
    onSuccess: invalidate,
  });
  const updateUser = useMutation(
    ({ id, data }: { id: number; data: UpdateUserPayload }) => userAPI.updateUser(id, data),
    { onSuccess: invalidate }
  );
  const deleteUser = useMutation((id: number) => userAPI.deleteUser(id), { onSuccess: invalidate });
  const updateStatus = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) => userAPI.updateStatus(id, is_active),
    { onSuccess: invalidate }
  );
  const updateRole = useMutation(
    ({ id, role }: { id: number; role: UserEntity['role'] }) => userAPI.updateRole(id, role),
    { onSuccess: invalidate }
  );
  const resetPassword = useMutation(
    ({ id, new_password }: { id: number; new_password: string }) => userAPI.resetPassword(id, new_password),
    { onSuccess: invalidate }
  );

  return { createUser, updateUser, deleteUser, updateStatus, updateRole, resetPassword };
}
