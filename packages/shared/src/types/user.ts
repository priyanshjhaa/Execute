export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name?: string;
}

export interface UpdateUserDTO {
  name?: string;
}
