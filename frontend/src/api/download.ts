import axios from "axios";

export const downloadApi = async (body: any) => {
    const {path, token} = body
    const route = "https://kale67.world/download?path=" +encodeURIComponent(path)+'&token='+ token;
    console.log(route);
    return axios
      .get(route)
      .then((res) => {
        return res
      })
      .catch((error) => {
        console.log(error);
        return error
      });
  };
  