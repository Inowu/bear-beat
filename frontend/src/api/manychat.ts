import { IManychat } from "../interfaces/api";
import trpc from "../api";

export const manychatApi = async (tag: IManychat) => {
  try {
    const manychat = await trpc.users.addManyChatTagToUser.mutate({ tag });
    return manychat;
  } catch (error: any) {
    throw Error(error.message);
  }
};
