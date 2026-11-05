export interface UserEntity {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'doctor' | 'researcher' | 'public_health' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}

export type UserListResponse = PaginatedResponse<UserEntity> | UserEntity[];

export interface UserListParams {
  q?: string;
  role?: string;
  active?: boolean;
  skip?: number;
  limit?: number;
  sort?: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  full_name: string;
  role: UserEntity['role'];
  password: string;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  full_name?: string;
  role?: UserEntity['role'];
  is_active?: boolean;
}
