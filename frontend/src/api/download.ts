import axios from "axios";

export const downloadApi = async (body: any) => {
    const {path, token} = body
    return axios
      .get('https://kale67.world/download' + path + token)
      .then((res) => {
        return res
      })
      .catch((error) => {
        console.log(error);
        return error
      });
  };
  