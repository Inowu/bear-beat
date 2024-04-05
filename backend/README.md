### Deploying to production (https://thebearbeatapi.lat)

In order to enable zero-downtime deploys, the current deployment scheme consists of having two pm2 processes running (formerly docker containers): `bearbeat-blue` and `bearbeat-green`, these two instances run on port `5000` and `6000` respectively. To deploy a new version of the server, changes from the repository are pulled and the non-active instance is restarted with the new changes (If the active instance is `bearbeat-blue`, `bearbeat-green` gets restarted and vice versa).

##### How to know which pm2 instance is currently active

1. Check the nginx configuration (`/etc/nginx/sites-enabled/thebearbeatapi.lat)`, specifically the `proxy_pass` statement inside the root location (`/`), if the current url points to port 5000 (`http://localhost:5000`) that means `bearbeat-blue` is the cururently active instance, otherwise it's `bearbeat-green`.
2. Check the logs of both instances with `pm2 logs bearbeat-blue | tail -n 50`. You can make a test request like this: `curl https://thebearbeatapi.lat` and check the logs of both instances to see which is currently active.

##### Steps to deploy

1. Pull new changes with `git pull`
2. After checking what instance is currently active, edit the `PORT` environment variable in the `.env` file. (If the current port is 5000, change it to 6000 and vice versa)
3. Build the application with `npm run build`
4. Restart the pm2 process: `pm2 restart <process-name>`
5. Change the port of the `proxy_pass` statement inside the root location in the nginx configuration file (`/etc/nginx/sites-enabled/thebearbeatapi.lat`)
6. Check if the nginx configuration is valid: `sudo nginx -t`
7. If the previous command is successful, reload the nginx service with: `sudo systemctl reload nginx`

#### Features

##### Checking current OS storage feature

Due to kernel limitations in the previous server which prevented nodejs to make system calls to check current OS storage, this feature was implemented in python using a simple flask server, the implementation can be found at `storage_server`/. This server also managed by pm2 (instance name: `storage`).

##### Dowloading directories feature

This feature works by pushing jobs to a queue backed by redis. Whenever a user wants to download a directory, a worker is spawned (a pm2 process) and a compression job is started, which is instantly processed by the newly spawned worker.
