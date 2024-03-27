import trpc from "../api";
import axios from "axios";

export const manychat = async (tag: any) => {
  try {
    // const files = await trpc.users.addManyChatTagToUser.mutate({})
  } catch (error: any) {
    throw new Error(error.message);
  }
};
