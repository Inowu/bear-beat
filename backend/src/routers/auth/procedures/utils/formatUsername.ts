export const stripNonAlphabetic = (username: string) => {
  return username.replace(/[^a-zA-Z]/g, '');
};
