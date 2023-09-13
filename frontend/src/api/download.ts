import axios from "axios";

export const downloadApi = async (url: any) => {
  axios.get(url)
  .then((response) => {
    return response
  })
  .catch((error) => {
    console.error('Axios error:', error);
  });
  };
  