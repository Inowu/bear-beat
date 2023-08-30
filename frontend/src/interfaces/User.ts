export interface IUser {
    email: string;
    exp: number;
    iat: number;
    id: number;
    phone: string;
    profileImg: string | null;
    role: string;
    username: string;
  }
  export interface IQuota{
    available: number;
    used: number;
  }