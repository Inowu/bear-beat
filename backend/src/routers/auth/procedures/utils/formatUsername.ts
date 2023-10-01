export const stripNonAlphabetic = (username: string) => {
  return username.replace(/[^a-zA-Z0-9]/g, '');
};
