export interface JwtPayload {
  userId: string;
  businessId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
