import Client from 'ssh2-sftp-client';

export const sftp = new Client();

export const connectFTP = async () =>
  sftp.connect({
    host: process.env.FTP_HOST,
    port: Number(process.env.FTP_PORT),
    username: process.env.FTP_USERNAME,
    password: process.env.FTP_PASSWORD,
  });
