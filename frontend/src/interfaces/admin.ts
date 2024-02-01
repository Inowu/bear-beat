export interface IAdminUser {
    email: string;
    username: string;
    active: number;
    id: number;
    registered_on: Date;
    blocked: boolean;
}