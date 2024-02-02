export type RemoveUsersJob = {
  userCustomerIds: Array<{
    stripe: string;
    conekta: string;
  }>;
};
