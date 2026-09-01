export type AccountStatus = 0 | 1 | 2;

export interface UserRow {
  user_id: string;
  nickname: string;
  email: string;
  phone: string | null;
  registered_at: Date;
  password_bcrypt: string;
  status: AccountStatus;
}

export interface PublicUser {
  userId: string;
  nickname: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  status: AccountStatus;
}

export function toPublicUser(user: UserRow): PublicUser {
  return {
    userId: user.user_id,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    registeredAt: user.registered_at.toISOString(),
    status: user.status,
  };
}
